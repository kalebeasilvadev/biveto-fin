"""Serviço para gerenciamento de parcelas e detecção de duplicatas"""

from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from fastapi import HTTPException, status

from ..models.installment import InstallmentSeries, InstallmentSeriesStatus
from ..models.transaction import Transaction, TransactionType
from ..models.merchant import Merchant
from ..models.user import User


class InstallmentService:
    """Gerencia séries de parcelas e detecta duplicatas"""

    # Tolerância para considerar valores "similares" (5%)
    AMOUNT_TOLERANCE = 0.05

    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_matching_series(
        self,
        user: User,
        merchant_name: str,
        installment_amount: float,
        installment_total: int,
        account_id: int | None = None,
        transaction_date: date | None = None,
        installment_number: int | None = None,
    ) -> InstallmentSeries | None:
        """
        Busca uma série de parcelas existente que corresponda aos critérios.

        Critérios de match:
        - Mesmo merchant (normalizado)
        - Valor similar (±5%)
        - Mesmo total de parcelas
        - Série ainda ativa
        - Data da primeira parcela compatível (se fornecida data e número da parcela)
        """
        normalized_merchant = merchant_name.lower().strip()

        # Calcular range de valor
        min_amount = installment_amount * (1 - self.AMOUNT_TOLERANCE)
        max_amount = installment_amount * (1 + self.AMOUNT_TOLERANCE)

        query = select(InstallmentSeries).where(
            and_(
                InstallmentSeries.user_id == user.id,
                InstallmentSeries.status == InstallmentSeriesStatus.ACTIVE,
                InstallmentSeries.installment_count == installment_total,
                InstallmentSeries.installment_amount >= min_amount,
                InstallmentSeries.installment_amount <= max_amount,
                func.lower(InstallmentSeries.merchant_name) == normalized_merchant,
            )
        )

        # Se account_id fornecido, usar como filtro adicional
        if account_id:
            query = query.where(InstallmentSeries.account_id == account_id)

        result = await self.db.execute(query)
        candidates = list(result.scalars().all())

        if not candidates:
            return None

        # Se temos data e número da parcela, filtrar por compatibilidade de data
        if transaction_date and installment_number:
            # Calcular a data esperada da primeira parcela desta compra
            # Se estou na parcela N com data X, a primeira parcela seria X - (N-1) meses
            expected_first_date = transaction_date - relativedelta(months=installment_number - 1)

            for series in candidates:
                # A série é compatível se a first_installment_date está próxima (±45 dias)
                # da data esperada calculada
                date_diff = abs((series.first_installment_date - expected_first_date).days)
                if date_diff <= 45:
                    return series

            # Nenhuma série com data compatível encontrada
            return None

        # Sem data para validar, retorna a primeira (comportamento antigo)
        return candidates[0] if candidates else None

    async def find_existing_installment(
        self,
        series: InstallmentSeries,
        installment_number: int,
    ) -> Transaction | None:
        """Verifica se uma parcela específica já foi cadastrada na série"""
        result = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.installment_series_id == series.id,
                    Transaction.installment_number == installment_number,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_series_status(
        self,
        series: InstallmentSeries,
    ) -> dict:
        """
        Retorna o status detalhado de uma série de parcelas.

        Retorna:
        - Quais parcelas foram pagas
        - Quais estão pendentes
        - Próxima parcela esperada
        """
        # Buscar todas as transações da série
        result = await self.db.execute(
            select(Transaction).where(
                Transaction.installment_series_id == series.id
            ).order_by(Transaction.installment_number)
        )
        transactions = list(result.scalars().all())

        # Mapear parcelas cadastradas
        registered = {t.installment_number: t for t in transactions}

        # Construir status de cada parcela
        installments_status = []
        for i in range(1, series.installment_count + 1):
            if i in registered:
                t = registered[i]
                installments_status.append({
                    'number': i,
                    'status': 'paid' if t.is_paid else 'registered',
                    'date': t.date.isoformat() if t.date else None,
                    'transaction_id': t.id,
                })
            else:
                # Calcular data esperada
                expected_date = series.first_installment_date + relativedelta(months=i - 1)
                installments_status.append({
                    'number': i,
                    'status': 'pending',
                    'expected_date': expected_date.isoformat(),
                    'transaction_id': None,
                })

        paid_count = sum(1 for s in installments_status if s['status'] == 'paid')

        return {
            'series_id': series.id,
            'description': series.description,
            'merchant_name': series.merchant_name,
            'total_amount': float(series.total_amount),
            'installment_amount': float(series.installment_amount),
            'installment_count': series.installment_count,
            'paid_count': paid_count,
            'remaining_count': series.installment_count - paid_count,
            'remaining_amount': float(series.installment_amount * (series.installment_count - paid_count)),
            'status': series.status,
            'installments': installments_status,
        }

    async def create_series(
        self,
        user: User,
        description: str,
        merchant_name: str,
        installment_amount: float,
        installment_count: int,
        first_installment_date: date,
        account_id: int,
        category_id: int | None = None,
        purchase_date: date | None = None,
    ) -> InstallmentSeries:
        """Cria uma nova série de parcelas"""
        # Obter ou criar merchant
        merchant_id = await self._get_or_create_merchant(merchant_name)

        total_amount = installment_amount * installment_count

        series = InstallmentSeries(
            user_id=user.id,
            description=description,
            merchant_id=merchant_id,
            merchant_name=merchant_name,
            total_amount=total_amount,
            installment_amount=installment_amount,
            installment_count=installment_count,
            purchase_date=purchase_date,
            first_installment_date=first_installment_date,
            account_id=account_id,
            category_id=category_id,
            status=InstallmentSeriesStatus.ACTIVE,
            paid_count=0,
        )

        self.db.add(series)
        await self.db.flush()
        await self.db.refresh(series)

        return series

    async def create_installment_transaction(
        self,
        user: User,
        series: InstallmentSeries,
        installment_number: int,
        transaction_date: date,
        is_paid: bool = True,
        document_id: int | None = None,
    ) -> Transaction:
        """Cria uma transação de parcela vinculada a uma série"""
        # Verificar se parcela já existe
        existing = await self.find_existing_installment(series, installment_number)
        if existing:
            # Usar 409 Conflict para que o frontend trate como "skip e continuar"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Parcela {installment_number}/{series.installment_count} de '{series.description}' (R$ {series.total_amount:.2f}) já cadastrada em {existing.date.strftime('%d/%m/%Y')}"
            )

        transaction = Transaction(
            user_id=user.id,
            account_id=series.account_id,
            category_id=series.category_id,
            merchant_id=series.merchant_id,
            document_id=document_id,
            installment_series_id=series.id,
            type=TransactionType.EXPENSE,
            amount=series.installment_amount,
            date=transaction_date,
            description=f"{series.description} - Parcela {installment_number}/{series.installment_count}",
            installment_number=installment_number,
            installment_total=series.installment_count,
            is_paid=is_paid,
            is_fixed=True,  # Parcelas são consideradas gastos fixos
        )

        self.db.add(transaction)

        # Atualizar contador de parcelas pagas
        if is_paid:
            series.paid_count += 1
            if series.paid_count >= series.installment_count:
                series.status = InstallmentSeriesStatus.COMPLETED

        await self.db.flush()
        await self.db.refresh(transaction)

        return transaction

    async def mark_previous_installments_as_paid(
        self,
        user: User,
        series: InstallmentSeries,
        up_to_installment: int,
    ) -> list[Transaction]:
        """
        Marca parcelas anteriores como pagas (sem documento vinculado).

        Útil para o cenário onde o usuário já pagou parcelas antes de começar
        a usar o sistema.
        """
        created_transactions = []

        for i in range(1, up_to_installment):
            existing = await self.find_existing_installment(series, i)
            if existing:
                continue

            # Calcular data estimada da parcela
            estimated_date = series.first_installment_date + relativedelta(months=i - 1)

            transaction = Transaction(
                user_id=user.id,
                account_id=series.account_id,
                category_id=series.category_id,
                merchant_id=series.merchant_id,
                document_id=None,  # Sem documento
                installment_series_id=series.id,
                type=TransactionType.EXPENSE,
                amount=series.installment_amount,
                date=estimated_date,
                description=f"{series.description} - Parcela {i}/{series.installment_count} (retroativa)",
                installment_number=i,
                installment_total=series.installment_count,
                is_paid=True,
                is_fixed=True,
            )

            self.db.add(transaction)
            series.paid_count += 1
            created_transactions.append(transaction)

        if series.paid_count >= series.installment_count:
            series.status = InstallmentSeriesStatus.COMPLETED

        await self.db.flush()

        return created_transactions

    async def create_future_installments(
        self,
        user: User,
        series: InstallmentSeries,
        from_installment: int,
    ) -> list[Transaction]:
        """
        Cria transações para parcelas futuras (marcadas como não pagas).

        Útil para visualizar compromissos futuros.
        """
        created_transactions = []

        for i in range(from_installment + 1, series.installment_count + 1):
            existing = await self.find_existing_installment(series, i)
            if existing:
                continue

            # Calcular data estimada da parcela
            estimated_date = series.first_installment_date + relativedelta(months=i - 1)

            transaction = Transaction(
                user_id=user.id,
                account_id=series.account_id,
                category_id=series.category_id,
                merchant_id=series.merchant_id,
                document_id=None,
                installment_series_id=series.id,
                type=TransactionType.EXPENSE,
                amount=series.installment_amount,
                date=estimated_date,
                description=f"{series.description} - Parcela {i}/{series.installment_count}",
                installment_number=i,
                installment_total=series.installment_count,
                is_paid=False,  # Parcela futura
                is_fixed=True,
            )

            self.db.add(transaction)
            created_transactions.append(transaction)

        await self.db.flush()

        return created_transactions

    async def get_user_series(
        self,
        user: User,
        status_filter: InstallmentSeriesStatus | None = None,
        limit: int = 50,
    ) -> list[InstallmentSeries]:
        """Lista séries de parcelas do usuário"""
        query = select(InstallmentSeries).where(
            InstallmentSeries.user_id == user.id
        )

        if status_filter:
            query = query.where(InstallmentSeries.status == status_filter)

        query = query.order_by(InstallmentSeries.created_at.desc()).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_series_by_id(
        self,
        user: User,
        series_id: int,
    ) -> InstallmentSeries | None:
        """Obtém uma série por ID"""
        result = await self.db.execute(
            select(InstallmentSeries).where(
                and_(
                    InstallmentSeries.id == series_id,
                    InstallmentSeries.user_id == user.id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def analyze_extracted_item(
        self,
        user: User,
        item: dict,
        account_id: int,
    ) -> dict:
        """
        Analisa um item extraído e verifica se é uma parcela de série existente.

        Retorna informações sobre:
        - Se é uma parcela
        - Se a série já existe
        - Se a parcela específica já foi cadastrada
        - Sugestões de ação
        """
        result = {
            'is_installment': item.get('is_installment', False),
            'series_found': None,
            'series_status': None,
            'installment_exists': False,
            'suggestion': None,
        }

        if not result['is_installment']:
            result['suggestion'] = 'create_single'  # Criar transação única
            return result

        installment_current = item.get('installment_current')
        installment_total = item.get('installment_total')
        amount = item.get('amount', 0)
        description = item.get('description', '')

        # Buscar série existente
        series = await self.find_matching_series(
            user=user,
            merchant_name=description,
            installment_amount=amount,
            installment_total=installment_total,
            account_id=account_id,
        )

        if series:
            result['series_found'] = {
                'id': series.id,
                'description': series.description,
                'merchant_name': series.merchant_name,
                'installment_count': series.installment_count,
                'paid_count': series.paid_count,
            }

            # Verificar se esta parcela específica já existe
            existing = await self.find_existing_installment(series, installment_current)
            if existing:
                result['installment_exists'] = True
                result['suggestion'] = 'skip'  # Pular, já existe
            else:
                # Verificar se há parcelas anteriores não cadastradas
                series_status = await self.get_series_status(series)
                result['series_status'] = series_status

                pending_before = [
                    s for s in series_status['installments']
                    if s['number'] < installment_current and s['status'] == 'pending'
                ]

                if pending_before:
                    result['suggestion'] = 'mark_previous_paid'
                    result['pending_installments'] = pending_before
                else:
                    result['suggestion'] = 'add_to_series'
        else:
            # Série não existe, sugerir criar
            result['suggestion'] = 'create_series'
            result['suggested_series'] = {
                'description': description,
                'merchant_name': description,
                'installment_amount': amount,
                'installment_count': installment_total,
                'current_installment': installment_current,
            }

        return result

    async def _get_or_create_merchant(self, name: str) -> int:
        """Obtém ou cria um merchant pelo nome"""
        normalized = name.lower().strip()
        result = await self.db.execute(
            select(Merchant).where(Merchant.normalized_name == normalized)
        )
        merchant = result.scalar_one_or_none()

        if not merchant:
            merchant = Merchant(name=name, normalized_name=normalized)
            self.db.add(merchant)
            await self.db.flush()

        return merchant.id
