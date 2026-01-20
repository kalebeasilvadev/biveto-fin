from __future__ import annotations
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.transaction import Transaction, TransactionAudit, TransactionType, PaymentMethod
from app.models.merchant import Merchant
from app.models.account import Account
from app.models.user import User
from app.models.household import HouseholdMember
from app.models.recurring import RecurringTransaction
from app.models.credit_card import CreditCard
from app.modules.transactions.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionConfirm
from app.modules.installments.services.installment_service import InstallmentService
from app.modules.credit_cards.services.invoice_service import InvoiceService


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user: User, data: TransactionCreate) -> Transaction:
        # Handle transfer between accounts
        if data.type == TransactionType.TRANSFER:
            return await self._create_transfer(user, data)

        merchant_id = None
        if data.merchant_name:
            merchant_id = await self._get_or_create_merchant(data.merchant_name)

        # Vincular a fatura se for cartao de credito
        credit_card_id = getattr(data, 'credit_card_id', None)
        invoice_id = None
        invoice = None

        # Auto-inferir credit_card_id se account é do tipo credit_card
        if not credit_card_id and data.account_id:
            credit_card_id = await self._get_credit_card_from_account(user, data.account_id)

        if credit_card_id:
            # Buscar cartao de credito
            card_result = await self.db.execute(
                select(CreditCard).where(
                    CreditCard.id == credit_card_id,
                    CreditCard.user_id == user.id,
                )
            )
            credit_card = card_result.scalar_one_or_none()

            if credit_card:
                # Criar servico de invoice e obter/criar fatura para o periodo
                invoice_service = InvoiceService(self.db)
                period = invoice_service.calculate_invoice_period(credit_card, data.date)
                invoice = await invoice_service.get_or_create_invoice(
                    user=user,
                    credit_card=credit_card,
                    reference_month=period['reference_month'],
                    reference_year=period['reference_year'],
                    closing_date=period['closing_date'],
                    due_date=period['due_date'],
                )
                invoice_id = invoice.id

        # Determinar payment_method: usar o informado ou inferir
        payment_method = self._infer_payment_method(data, credit_card_id)

        transaction = Transaction(
            user_id=user.id,
            account_id=data.account_id,
            category_id=data.category_id,
            merchant_id=merchant_id,
            credit_card_id=credit_card_id,
            invoice_id=invoice_id,
            income_source_id=getattr(data, 'income_source_id', None),
            type=data.type,
            payment_method=payment_method,
            amount=data.amount,
            currency=data.currency,
            date=data.date,
            description=data.description,
            notes=data.notes,
            tags=data.tags,
            is_fixed=data.is_fixed,
            ownership_type=data.ownership_type.value if hasattr(data.ownership_type, 'value') else data.ownership_type,
        )
        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)

        # Atualizar total da fatura se houver
        if invoice:
            invoice_service = InvoiceService(self.db)
            await invoice_service.update_invoice_total(invoice)

        # Criar recorrencia se solicitado
        if data.create_recurring and data.recurring_frequency:
            await self._create_recurring_from_transaction(user, data, transaction)

        return transaction

    async def _create_transfer(self, user: User, data: TransactionCreate) -> Transaction:
        """
        Cria uma transferência entre contas, gerando duas transações linkadas.

        A primeira transação (saída) é vinculada à conta de origem.
        A segunda transação (entrada) é vinculada à conta de destino.
        Ambas são linkadas via linked_transaction_id.

        Returns:
            Transaction: A transação de saída (primeira criada)
        """
        destination_account_id = getattr(data, 'destination_account_id', None)

        if not destination_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="destination_account_id é obrigatório para transferências"
            )

        if data.account_id == destination_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conta de origem e destino não podem ser a mesma"
            )

        # Validar que ambas as contas pertencem ao usuário
        household_user_ids = await self._get_household_user_ids(user)

        for acc_id in [data.account_id, destination_account_id]:
            if household_user_ids:
                result = await self.db.execute(
                    select(Account).where(
                        Account.id == acc_id,
                        or_(
                            and_(Account.user_id == user.id, Account.ownership_type == "personal"),
                            and_(Account.user_id.in_(household_user_ids), Account.ownership_type == "household")
                        )
                    )
                )
            else:
                result = await self.db.execute(
                    select(Account).where(Account.id == acc_id, Account.user_id == user.id)
                )
            if not result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Conta {acc_id} não encontrada ou não pertence ao usuário"
                )

        ownership_type = data.ownership_type.value if hasattr(data.ownership_type, 'value') else data.ownership_type
        description = data.description or "Transferência entre contas"

        # Criar transação de SAÍDA (conta origem)
        transfer_out = Transaction(
            user_id=user.id,
            account_id=data.account_id,
            type=TransactionType.TRANSFER.value,
            payment_method=PaymentMethod.BANK_TRANSFER.value,
            amount=data.amount,
            currency=data.currency,
            date=data.date,
            description=description,
            notes=data.notes,
            tags=data.tags,
            is_fixed=False,
            is_paid=True,
            ownership_type=ownership_type,
        )
        self.db.add(transfer_out)
        await self.db.flush()

        # Criar transação de ENTRADA (conta destino)
        transfer_in = Transaction(
            user_id=user.id,
            account_id=destination_account_id,
            type=TransactionType.TRANSFER.value,
            payment_method=PaymentMethod.BANK_TRANSFER.value,
            amount=data.amount,
            currency=data.currency,
            date=data.date,
            description=description,
            notes=data.notes,
            tags=data.tags,
            is_fixed=False,
            is_paid=True,
            ownership_type=ownership_type,
        )
        self.db.add(transfer_in)
        await self.db.flush()

        # Linkar as duas transações bidirecionalmente
        transfer_out.linked_transaction_id = transfer_in.id
        transfer_in.linked_transaction_id = transfer_out.id

        await self.db.flush()
        await self.db.refresh(transfer_out)

        return transfer_out

    async def _create_recurring_from_transaction(
        self, user: User, data: TransactionCreate, transaction: Transaction
    ) -> RecurringTransaction:
        """Cria uma transacao recorrente baseada em uma transacao criada"""
        # Verificar se ja existe recorrencia similar
        existing = await self.db.execute(
            select(RecurringTransaction).where(
                RecurringTransaction.user_id == user.id,
                RecurringTransaction.name == (data.description or data.merchant_name or "Recorrente"),
                RecurringTransaction.amount == data.amount,
                RecurringTransaction.status == "active",
            )
        )
        if existing.scalar_one_or_none():
            return None  # Ja existe, nao criar duplicata

        # Determinar dia do mes ou semana
        day_of_month = data.recurring_day_of_month
        day_of_week = data.recurring_day_of_week

        if data.recurring_frequency == "monthly" and not day_of_month:
            day_of_month = data.date.day  # Usar o dia da transacao

        if data.recurring_frequency == "weekly" and day_of_week is None:
            day_of_week = data.date.weekday()  # Usar o dia da semana da transacao

        recurring = RecurringTransaction(
            user_id=user.id,
            name=data.description or data.merchant_name or "Recorrente",
            description=data.notes,
            amount=data.amount,
            type=data.type.value if hasattr(data.type, 'value') else data.type,
            account_id=data.account_id,
            category_id=data.category_id,
            frequency=data.recurring_frequency,
            day_of_month=day_of_month,
            day_of_week=day_of_week,
            start_date=data.date,
            status="active",
            last_generated_date=data.date,  # Ja foi gerada (a transacao atual)
        )
        self.db.add(recurring)
        await self.db.flush()
        return recurring

    async def confirm_from_document(
        self, user: User, data: TransactionConfirm
    ) -> dict:
        """
        Cria transacao confirmando dados de documento processado.

        Retorna dict com:
        - transaction: Transacao criada
        - series: Serie de parcelas (se aplicavel)
        - created_transactions: Transacoes adicionais criadas (parcelas anteriores/futuras)
        - invoice: Fatura vinculada (se cartao de credito)
        """
        from app.models.document import Document

        # Verificar documento se fornecido
        if data.document_id:
            result = await self.db.execute(
                select(Document).where(
                    Document.id == data.document_id,
                    Document.user_id == user.id,
                )
            )
            document = result.scalar_one_or_none()

            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Documento nao encontrado",
                )

            # Verificar idempotencia - duas verificacoes:
            # 1. Mesmo documento: description + amount (evita re-processar mesmo item)
            # 2. Qualquer documento: description + amount + date (evita duplicatas de PDFs reenviados)
            # NOTA: Se force_duplicate=True, pular verificacoes
            if data.merchant_name and not data.force_duplicate:
                # Verificacao 1: Mesmo documento
                existing_same_doc = await self.db.execute(
                    select(Transaction).where(
                        Transaction.document_id == data.document_id,
                        Transaction.description == data.merchant_name,
                        Transaction.amount == data.amount,
                    )
                )
                if existing_same_doc.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Item ja adicionado: {data.merchant_name}",
                    )

                # Verificacao 2: Qualquer documento do usuario com mesmo description + amount + date
                existing_any_doc = await self.db.execute(
                    select(Transaction).where(
                        Transaction.user_id == user.id,
                        Transaction.description == data.merchant_name,
                        Transaction.amount == data.amount,
                        Transaction.date == data.date,
                    )
                )
                existing_tx = existing_any_doc.scalar_one_or_none()
                if existing_tx:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Transacao ja existe: {data.merchant_name} - R$ {data.amount:.2f} em {data.date.strftime('%d/%m/%Y')}",
                    )

        merchant_id = None
        if data.merchant_name:
            merchant_id = await self._get_or_create_merchant(data.merchant_name)

        result = {
            "transaction": None,
            "series": None,
            "created_transactions": [],
            "invoice": None,
        }

        # Obter cartao de credito e preparar fatura se necessario
        credit_card_id = getattr(data, 'credit_card_id', None)
        credit_card = None
        invoice = None
        invoice_service = None

        # Auto-inferir credit_card_id se account é do tipo credit_card
        if not credit_card_id and data.account_id:
            credit_card_id = await self._get_credit_card_from_account(user, data.account_id)

        if credit_card_id:
            # Buscar cartao de credito
            card_result = await self.db.execute(
                select(CreditCard).where(
                    CreditCard.id == credit_card_id,
                    CreditCard.user_id == user.id,
                )
            )
            credit_card = card_result.scalar_one_or_none()

            if credit_card:
                # Criar servico de invoice
                invoice_service = InvoiceService(self.db)

                # Se invoice_month e invoice_year foram fornecidos (ex: do PDF),
                # usar esses valores em vez de calcular pela data da transacao
                if data.invoice_month and data.invoice_year:
                    # Usar periodo explicito do PDF
                    reference_month = data.invoice_month
                    reference_year = data.invoice_year
                    dates = invoice_service.calculate_invoice_dates(
                        credit_card, reference_month, reference_year
                    )
                    closing_date = dates['closing_date']
                    due_date = dates['due_date']
                else:
                    # Calcular periodo pela data da transacao
                    period = invoice_service.calculate_invoice_period(credit_card, data.date)
                    reference_month = period['reference_month']
                    reference_year = period['reference_year']
                    closing_date = period['closing_date']
                    due_date = period['due_date']

                # Obter ou criar fatura para o periodo
                invoice = await invoice_service.get_or_create_invoice(
                    user=user,
                    credit_card=credit_card,
                    reference_month=reference_month,
                    reference_year=reference_year,
                    closing_date=closing_date,
                    due_date=due_date,
                )
                result["invoice"] = invoice

        # Se e uma transacao parcelada
        if data.is_installment and data.installment_current and data.installment_total:
            installment_service = InstallmentService(self.db)

            # Verificar se serie ja existe ou criar nova
            series = None
            if data.installment_series_id:
                series = await installment_service.get_series_by_id(
                    user, data.installment_series_id
                )
                if not series:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Serie de parcelas nao encontrada",
                    )
            else:
                # Tentar encontrar serie existente
                # Passa a data e numero da parcela para validacao de compatibilidade
                series = await installment_service.find_matching_series(
                    user=user,
                    merchant_name=data.merchant_name or data.description or "Compra",
                    installment_amount=data.amount,
                    installment_total=data.installment_total,
                    account_id=data.account_id,
                    transaction_date=data.date,
                    installment_number=data.installment_current,
                )

            # Se nao encontrou, criar nova serie
            if not series:
                # Calcular a data da primeira parcela baseado na parcela atual
                # Se estamos na parcela N com data X, a primeira parcela foi em X - (N-1) meses
                from dateutil.relativedelta import relativedelta
                first_installment_date = data.date - relativedelta(months=data.installment_current - 1)

                print(f"[TX_SVC] Criando serie de parcelas:")
                print(f"[TX_SVC]   data.date={data.date}, installment={data.installment_current}/{data.installment_total}")
                print(f"[TX_SVC]   first_installment_date calculado={first_installment_date}")
                print(f"[TX_SVC]   invoice_month/year={data.invoice_month}/{data.invoice_year}")
                if credit_card:
                    print(f"[TX_SVC]   credit_card closing_day={credit_card.closing_day}, due_day={credit_card.due_day}")

                series = await installment_service.create_series(
                    user=user,
                    description=data.description or data.merchant_name or "Compra parcelada",
                    merchant_name=data.merchant_name or data.description or "Compra",
                    installment_amount=data.amount,
                    installment_count=data.installment_total,
                    first_installment_date=first_installment_date,
                    account_id=data.account_id,
                    category_id=data.category_id,
                    credit_card_id=credit_card_id,
                )

            result["series"] = series

            # Se solicitado, marcar parcelas anteriores como pagas
            if data.mark_previous_as_paid and data.installment_current > 1:
                previous_transactions = await installment_service.mark_previous_installments_as_paid(
                    user=user,
                    series=series,
                    up_to_installment=data.installment_current,
                )
                result["created_transactions"].extend(previous_transactions)

            # Verificar se existe parcela projetada (is_paid=False) para confirmar
            existing_installment = await installment_service.find_existing_installment(
                series, data.installment_current
            )

            if existing_installment and not existing_installment.is_paid:
                # Confirmar parcela projetada ao inves de criar nova
                transaction = await installment_service.confirm_existing_installment(
                    user=user,
                    series=series,
                    installment_number=data.installment_current,
                    document_id=data.document_id,
                    actual_amount=data.amount,
                    actual_date=data.date,
                )
                result["transaction"] = transaction
                result["was_projected"] = True  # Flag indicando que confirmou projecao

                # Atualizar invoice_id se necessario
                if invoice and transaction.invoice_id != invoice.id:
                    transaction.invoice_id = invoice.id
                    await self.db.flush()

            elif existing_installment and existing_installment.is_paid:
                # Parcela ja confirmada - verificar se e duplicata ou forcar
                if not data.force_duplicate:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Parcela {data.installment_current}/{data.installment_total} ja confirmada em {existing_installment.date.strftime('%d/%m/%Y')}"
                    )
                # Se force_duplicate, criar nova transacao
                transaction = await installment_service.create_installment_transaction(
                    user=user,
                    series=series,
                    installment_number=data.installment_current,
                    transaction_date=data.date,
                    is_paid=True,
                    document_id=data.document_id,
                    credit_card_id=credit_card_id,
                    invoice_id=invoice.id if invoice else None,
                    force_duplicate=True,
                )
                result["transaction"] = transaction
            else:
                # Criar nova transacao da parcela atual
                transaction = await installment_service.create_installment_transaction(
                    user=user,
                    series=series,
                    installment_number=data.installment_current,
                    transaction_date=data.date,
                    is_paid=True,
                    document_id=data.document_id,
                    credit_card_id=credit_card_id,
                    invoice_id=invoice.id if invoice else None,
                    force_duplicate=data.force_duplicate,
                )
                result["transaction"] = transaction

                # Se solicitado, criar parcelas futuras (apenas se criou nova transacao)
                if data.create_future_installments:
                    future_transactions = await installment_service.create_future_installments(
                        user=user,
                        series=series,
                        from_installment=data.installment_current,
                        # Passar o mês/ano da fatura atual para calcular faturas futuras corretamente
                        current_invoice_month=data.invoice_month,
                        current_invoice_year=data.invoice_year,
                    )
                    result["created_transactions"].extend(future_transactions)

        else:
            # Transacao simples (nao parcelada)
            # Primeiro, verificar se existe uma transacao projetada (futura) que corresponda
            existing_projected = await self._find_matching_projected_transaction(
                user=user,
                merchant_name=data.merchant_name or data.description,
                amount=data.amount,
                transaction_date=data.date,
                credit_card_id=credit_card_id,
            )

            if existing_projected:
                # Atualizar a transacao existente ao inves de criar nova
                existing_projected.document_id = data.document_id
                existing_projected.is_paid = True
                if data.category_id:
                    existing_projected.category_id = data.category_id
                if merchant_id:
                    existing_projected.merchant_id = merchant_id
                if data.description:
                    existing_projected.description = data.description

                await self.db.flush()
                await self.db.refresh(existing_projected)
                result["transaction"] = existing_projected
                result["was_projected"] = True  # Flag para indicar que atualizou uma projecao
            else:
                # Determinar payment_method
                payment_method = self._infer_payment_method(data, credit_card_id)

                # Determinar tipo da transacao (EXPENSE ou INCOME)
                # Prioridade: extracted_transaction_type do LLM > inferencia por descricao
                transaction_type = self._determine_transaction_type(data)

                transaction = Transaction(
                    user_id=user.id,
                    account_id=data.account_id,
                    document_id=data.document_id,
                    category_id=data.category_id,
                    merchant_id=merchant_id,
                    credit_card_id=credit_card_id,
                    invoice_id=invoice.id if invoice else None,
                    income_source_id=getattr(data, 'income_source_id', None),
                    type=transaction_type,
                    payment_method=payment_method,
                    amount=data.amount,
                    date=data.date,
                    description=data.description,
                    tags=data.tags,
                    is_fixed=data.is_fixed,
                    ownership_type=data.ownership_type.value if hasattr(data.ownership_type, 'value') else data.ownership_type,
                )
                self.db.add(transaction)
                await self.db.flush()
                await self.db.refresh(transaction)
                result["transaction"] = transaction

        # Criar GroceryPurchase se for item de cupom fiscal
        transaction = result.get("transaction")
        if transaction and hasattr(data, 'grocery_category') and data.grocery_category:
            from app.modules.grocery.services.grocery_service import GroceryService
            grocery_service = GroceryService(self.db)
            await grocery_service.create_purchase_from_transaction(
                user=user,
                transaction_id=transaction.id,
                document_id=data.document_id,
                merchant_id=merchant_id,
                product_name=data.merchant_name or data.description or "Item",
                total_price=float(data.amount),
                purchase_date=data.date,
                quantity=getattr(data, 'quantity', None),
                unit=getattr(data, 'unit', None),
                unit_price=getattr(data, 'unit_price', None),
                grocery_category=data.grocery_category,
                necessity_type=getattr(data, 'necessity_type', None),
                ownership_type=data.ownership_type.value if hasattr(data.ownership_type, 'value') else data.ownership_type,
            )

        # Atualizar total da fatura se houver
        if invoice and invoice_service:
            await invoice_service.update_invoice_total(invoice)

        return result

    async def get_by_id(self, user: User, transaction_id: int) -> Transaction | None:
        """
        Busca transação por ID, considerando permissões de household.

        Retorna a transação se:
        - É do próprio usuário (qualquer ownership_type)
        - É de outro membro do household com ownership_type='household'
        """
        household_user_ids = await self._get_household_user_ids(user)

        if household_user_ids:
            # Usuário faz parte de um household
            result = await self.db.execute(
                select(Transaction).where(
                    Transaction.id == transaction_id,
                    or_(
                        # Transações pessoais do usuário
                        Transaction.user_id == user.id,
                        # Transações household de qualquer membro da família
                        and_(
                            Transaction.user_id.in_(household_user_ids),
                            Transaction.ownership_type == "household"
                        )
                    )
                )
            )
        else:
            # Usuário não faz parte de household - apenas suas próprias transações
            result = await self.db.execute(
                select(Transaction).where(
                    Transaction.id == transaction_id,
                    Transaction.user_id == user.id,
                )
            )
        return result.scalar_one_or_none()

    async def list(
        self,
        user: User,
        start_date: date | None = None,
        end_date: date | None = None,
        category_id: int | None = None,
        account_id: int | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Transaction]:
        from app.models.category import Category

        # Get household member IDs if user is part of a household
        household_user_ids = await self._get_household_user_ids(user)

        if household_user_ids:
            # User is in a household - get personal + household transactions
            query = select(Transaction).where(
                or_(
                    # Personal transactions from user
                    and_(
                        Transaction.user_id == user.id,
                        Transaction.ownership_type == "personal"
                    ),
                    # Household transactions from any family member
                    and_(
                        Transaction.user_id.in_(household_user_ids),
                        Transaction.ownership_type == "household"
                    )
                )
            )
        else:
            query = select(Transaction).where(Transaction.user_id == user.id)

        if start_date:
            query = query.where(Transaction.date >= start_date)
        if end_date:
            query = query.where(Transaction.date <= end_date)
        if category_id:
            query = query.where(Transaction.category_id == category_id)
        if account_id:
            query = query.where(Transaction.account_id == account_id)

        # Search across description, merchant name, and category name
        if search:
            search_term = f"%{search.lower()}%"
            query = query.outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
            query = query.outerjoin(Category, Transaction.category_id == Category.id)
            query = query.where(
                or_(
                    func.lower(Transaction.description).like(search_term),
                    func.lower(Merchant.name).like(search_term),
                    func.lower(Category.name).like(search_term),
                )
            )

        # Eager load relationships to avoid N+1 queries
        query = query.options(
            selectinload(Transaction.account),
            selectinload(Transaction.category),
            selectinload(Transaction.merchant),
            selectinload(Transaction.credit_card),
            selectinload(Transaction.income_source),
            selectinload(Transaction.invoice),
        )

        query = query.order_by(Transaction.date.desc()).limit(limit).offset(offset)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(
        self,
        user: User,
        start_date: date | None = None,
        end_date: date | None = None,
        category_id: int | None = None,
        account_id: int | None = None,
        search: str | None = None,
    ) -> int:
        """Returns the total count of transactions matching the filters"""
        from app.models.category import Category

        household_user_ids = await self._get_household_user_ids(user)

        if household_user_ids:
            query = select(func.count(Transaction.id)).where(
                or_(
                    and_(
                        Transaction.user_id == user.id,
                        Transaction.ownership_type == "personal"
                    ),
                    and_(
                        Transaction.user_id.in_(household_user_ids),
                        Transaction.ownership_type == "household"
                    )
                )
            )
        else:
            query = select(func.count(Transaction.id)).where(Transaction.user_id == user.id)

        if start_date:
            query = query.where(Transaction.date >= start_date)
        if end_date:
            query = query.where(Transaction.date <= end_date)
        if category_id:
            query = query.where(Transaction.category_id == category_id)
        if account_id:
            query = query.where(Transaction.account_id == account_id)

        # Search across description, merchant name, and category name
        if search:
            search_term = f"%{search.lower()}%"
            query = query.outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
            query = query.outerjoin(Category, Transaction.category_id == Category.id)
            query = query.where(
                or_(
                    func.lower(Transaction.description).like(search_term),
                    func.lower(Merchant.name).like(search_term),
                    func.lower(Category.name).like(search_term),
                )
            )

        result = await self.db.execute(query)
        return result.scalar() or 0

    async def _get_household_user_ids(self, user: User) -> list[int]:
        """Get all user IDs in the same household/license as the user"""
        if not user.license_id:
            return []

        result = await self.db.execute(
            select(HouseholdMember.user_id).where(
                HouseholdMember.license_id == user.license_id
            )
        )
        return list(result.scalars().all())

    async def update(
        self, user: User, transaction_id: int, data: TransactionUpdate
    ) -> Transaction:
        transaction = await self.get_by_id(user, transaction_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transacao nao encontrada",
            )

        update_data = data.model_dump(exclude_unset=True)

        # Handle special field: merchant_name -> merchant_id
        if "merchant_name" in update_data:
            merchant_name = update_data.pop("merchant_name")
            if merchant_name:
                merchant_id = await self._get_or_create_merchant(merchant_name)
                update_data["merchant_id"] = merchant_id
            else:
                update_data["merchant_id"] = None

        # Handle special field: account_id - validate ownership
        if "account_id" in update_data:
            account_id = update_data["account_id"]
            household_ids = await self._get_household_user_ids(user)
            if household_ids:
                result = await self.db.execute(
                    select(Account).where(
                        Account.id == account_id,
                        or_(
                            and_(Account.user_id == user.id, Account.ownership_type == "personal"),
                            and_(Account.user_id.in_(household_ids), Account.ownership_type == "household")
                        )
                    )
                )
            else:
                result = await self.db.execute(
                    select(Account).where(Account.id == account_id, Account.user_id == user.id)
                )
            if not result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Conta nao encontrada")

        # Handle enum field: type
        if "type" in update_data and update_data["type"]:
            update_data["type"] = update_data["type"].value

        # Handle invoice_id change - validate ownership and track for total updates
        from app.models.credit_card_invoice import CreditCardInvoice
        old_invoice_id = transaction.invoice_id
        new_invoice_id = update_data.get("invoice_id")
        invoice_changed = "invoice_id" in update_data and new_invoice_id != old_invoice_id

        if invoice_changed and new_invoice_id is not None:
            # Validate new invoice belongs to user
            result = await self.db.execute(
                select(CreditCardInvoice).where(
                    CreditCardInvoice.id == new_invoice_id,
                    CreditCardInvoice.user_id == user.id,
                )
            )
            if not result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Fatura nao encontrada")

        # Se a transação é de cartão de crédito mas não tem invoice_id, vincular automaticamente
        # Isso corrige transações antigas que foram criadas sem fatura
        needs_invoice_link = False
        if transaction.credit_card_id and not transaction.invoice_id and "invoice_id" not in update_data:
            needs_invoice_link = True

        # Guardar invoice_id para atualizar total depois se amount mudar
        amount_changed = "amount" in update_data and update_data["amount"] != transaction.amount
        date_changed = "date" in update_data and update_data["date"] != transaction.date

        # Registrar alteracoes para auditoria
        for field, value in update_data.items():
            old_value = getattr(transaction, field)
            if old_value != value:
                audit = TransactionAudit(
                    transaction_id=transaction.id,
                    field_name=field,
                    old_value=str(old_value) if old_value else None,
                    new_value=str(value) if value else None,
                    reason="manual",
                )
                self.db.add(audit)
                setattr(transaction, field, value)

        await self.db.flush()
        await self.db.refresh(transaction)

        # Atualizar totais das faturas se houve mudanca
        invoice_service = InvoiceService(self.db)

        # Se a transação é de cartão de crédito e não tinha invoice_id, vincular automaticamente
        if needs_invoice_link or (transaction.credit_card_id and not transaction.invoice_id):
            # Buscar o cartão de crédito
            card_result = await self.db.execute(
                select(CreditCard).where(CreditCard.id == transaction.credit_card_id)
            )
            credit_card = card_result.scalar_one_or_none()

            if credit_card:
                # Usar a data atualizada se foi modificada
                tx_date = update_data.get("date", transaction.date)

                # Calcular período da fatura
                period = invoice_service.calculate_invoice_period(credit_card, tx_date)

                # Obter ou criar fatura
                invoice = await invoice_service.get_or_create_invoice(
                    user=user,
                    credit_card=credit_card,
                    reference_month=period['reference_month'],
                    reference_year=period['reference_year'],
                    closing_date=period['closing_date'],
                    due_date=period['due_date'],
                )

                # Vincular transação à fatura
                transaction.invoice_id = invoice.id
                await self.db.flush()

                # Atualizar total da fatura
                await invoice_service.update_invoice_total(invoice)

        # Se mudou de fatura, atualizar ambas
        elif invoice_changed:
            # Atualizar fatura antiga (se existia)
            if old_invoice_id:
                result = await self.db.execute(
                    select(CreditCardInvoice).where(CreditCardInvoice.id == old_invoice_id)
                )
                old_invoice = result.scalar_one_or_none()
                if old_invoice:
                    await invoice_service.update_invoice_total(old_invoice)

            # Atualizar fatura nova (se existe)
            if new_invoice_id:
                result = await self.db.execute(
                    select(CreditCardInvoice).where(CreditCardInvoice.id == new_invoice_id)
                )
                new_invoice = result.scalar_one_or_none()
                if new_invoice:
                    await invoice_service.update_invoice_total(new_invoice)

        elif date_changed and transaction.credit_card_id and transaction.invoice_id:
            # Data mudou - verificar se a transação deveria estar em outra fatura
            card_result = await self.db.execute(
                select(CreditCard).where(CreditCard.id == transaction.credit_card_id)
            )
            credit_card = card_result.scalar_one_or_none()

            if credit_card:
                # Calcular qual fatura a transação deveria estar com a nova data
                new_tx_date = update_data.get("date", transaction.date)
                period = invoice_service.calculate_invoice_period(credit_card, new_tx_date)

                # Verificar se é a mesma fatura
                current_invoice_result = await self.db.execute(
                    select(CreditCardInvoice).where(CreditCardInvoice.id == transaction.invoice_id)
                )
                current_invoice = current_invoice_result.scalar_one_or_none()

                needs_move = False
                if current_invoice:
                    # Verificar se a transação deveria estar em outra fatura
                    if (current_invoice.reference_month != period['reference_month'] or
                        current_invoice.reference_year != period['reference_year']):
                        needs_move = True

                if needs_move:
                    # Obter ou criar a fatura correta
                    correct_invoice = await invoice_service.get_or_create_invoice(
                        user=user,
                        credit_card=credit_card,
                        reference_month=period['reference_month'],
                        reference_year=period['reference_year'],
                        closing_date=period['closing_date'],
                        due_date=period['due_date'],
                    )

                    # Guardar invoice antiga para atualizar total depois
                    old_invoice = current_invoice

                    # Mover transação para a fatura correta
                    transaction.invoice_id = correct_invoice.id
                    await self.db.flush()

                    # Atualizar totais de ambas as faturas
                    if old_invoice:
                        await invoice_service.update_invoice_total(old_invoice)
                    await invoice_service.update_invoice_total(correct_invoice)
                elif current_invoice:
                    # Mesma fatura, apenas atualizar total se valor mudou
                    if amount_changed:
                        await invoice_service.update_invoice_total(current_invoice)

        elif amount_changed:
            # Apenas valor mudou, atualizar a fatura atual
            if transaction.invoice_id:
                result = await self.db.execute(
                    select(CreditCardInvoice).where(CreditCardInvoice.id == transaction.invoice_id)
                )
                invoice = result.scalar_one_or_none()
                if invoice:
                    await invoice_service.update_invoice_total(invoice)

        # Se é uma transferência, sincronizar a transação linkada
        if transaction.type == TransactionType.TRANSFER.value and transaction.linked_transaction_id:
            linked_result = await self.db.execute(
                select(Transaction).where(Transaction.id == transaction.linked_transaction_id)
            )
            linked_transaction = linked_result.scalar_one_or_none()

            if linked_transaction:
                # Sincronizar campos importantes
                if amount_changed:
                    linked_transaction.amount = transaction.amount
                if date_changed:
                    linked_transaction.date = transaction.date
                if "description" in update_data:
                    linked_transaction.description = transaction.description
                if "notes" in update_data:
                    linked_transaction.notes = transaction.notes

                await self.db.flush()

        return transaction

    async def delete(self, user: User, transaction_id: int, delete_series: bool = True) -> dict:
        """
        Remove uma transacao.

        Se a transacao faz parte de uma serie de parcelas e delete_series=True,
        deleta todas as parcelas da serie e limpa faturas que ficarem vazias.

        Se a transacao é uma transferência, deleta ambas as transacoes linkadas.

        Returns:
            Dict com informacoes sobre o que foi deletado
        """
        from app.models.credit_card_invoice import CreditCardInvoice
        from app.models.installment import InstallmentSeries

        transaction = await self.get_by_id(user, transaction_id)
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transacao nao encontrada",
            )

        result = {
            "transactions_deleted": 0,
            "invoices_deleted": 0,
            "series_deleted": False,
        }

        # Se é uma transferência, deletar ambas as transações linkadas
        if transaction.type == TransactionType.TRANSFER.value and transaction.linked_transaction_id:
            linked_result = await self.db.execute(
                select(Transaction).where(Transaction.id == transaction.linked_transaction_id)
            )
            linked_transaction = linked_result.scalar_one_or_none()

            if linked_transaction:
                await self.db.delete(linked_transaction)
                result["transactions_deleted"] += 1

            await self.db.delete(transaction)
            result["transactions_deleted"] += 1
            await self.db.flush()

            return result

        # Se faz parte de uma serie de parcelas e deve deletar a serie
        if transaction.installment_series_id and delete_series:
            series_id = transaction.installment_series_id

            # Buscar todas as transacoes da serie
            series_result = await self.db.execute(
                select(Transaction).where(
                    Transaction.installment_series_id == series_id,
                    Transaction.user_id == user.id,
                )
            )
            series_transactions = series_result.scalars().all()

            # Coletar invoice_ids afetados
            affected_invoice_ids = set()
            for tx in series_transactions:
                if tx.invoice_id:
                    affected_invoice_ids.add(tx.invoice_id)

            # Deletar todas as transacoes da serie
            for tx in series_transactions:
                await self.db.delete(tx)
                result["transactions_deleted"] += 1

            await self.db.flush()

            # Deletar a serie em si
            series_obj = await self.db.execute(
                select(InstallmentSeries).where(InstallmentSeries.id == series_id)
            )
            series = series_obj.scalar_one_or_none()
            if series:
                await self.db.delete(series)
                result["series_deleted"] = True

            # Verificar e limpar faturas que ficaram vazias (batch)
            if affected_invoice_ids:
                invoice_service = InvoiceService(self.db)

                # Buscar todas as faturas afetadas de uma vez
                inv_result = await self.db.execute(
                    select(CreditCardInvoice).where(CreditCardInvoice.id.in_(affected_invoice_ids))
                )
                affected_invoices = {inv.id: inv for inv in inv_result.scalars().all()}

                # Contar transacoes restantes de todas as faturas de uma vez
                count_result = await self.db.execute(
                    select(Transaction.invoice_id, func.count(Transaction.id).label('count'))
                    .where(Transaction.invoice_id.in_(affected_invoice_ids))
                    .group_by(Transaction.invoice_id)
                )
                remaining_counts = {row[0]: row[1] for row in count_result.all()}

                for inv_id in affected_invoice_ids:
                    invoice = affected_invoices.get(inv_id)
                    if not invoice:
                        continue

                    remaining_count = remaining_counts.get(inv_id, 0)
                    if remaining_count == 0:
                        # Fatura vazia, deletar
                        await self.db.delete(invoice)
                        result["invoices_deleted"] += 1
                    else:
                        # Atualizar total da fatura
                        await invoice_service.update_invoice_total(invoice)

        else:
            # Deletar apenas a transacao especifica
            invoice_id = transaction.invoice_id

            await self.db.delete(transaction)
            result["transactions_deleted"] = 1
            await self.db.flush()

            # Atualizar total da fatura se estava vinculada
            if invoice_id:
                inv_result = await self.db.execute(
                    select(CreditCardInvoice).where(CreditCardInvoice.id == invoice_id)
                )
                invoice = inv_result.scalar_one_or_none()
                if invoice:
                    invoice_service = InvoiceService(self.db)
                    await invoice_service.update_invoice_total(invoice)

        return result

    async def _get_or_create_merchant(self, name: str) -> int:
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

    async def _get_credit_card_from_account(self, user: User, account_id: int) -> int | None:
        """
        Verifica se a conta é do tipo credit_card e retorna o credit_card_id associado.

        Isso permite auto-inferir o cartão de crédito quando o usuário seleciona
        uma conta do tipo credit_card, garantindo que a transação seja vinculada
        à fatura correta.
        """
        # Buscar a conta
        account_result = await self.db.execute(
            select(Account).where(
                Account.id == account_id,
                Account.user_id == user.id,
            )
        )
        account = account_result.scalar_one_or_none()

        if not account or account.type != "credit_card":
            return None

        # Buscar o cartão de crédito associado à conta
        cc_result = await self.db.execute(
            select(CreditCard).where(
                CreditCard.account_id == account_id,
                CreditCard.user_id == user.id,
            )
        )
        credit_card = cc_result.scalar_one_or_none()

        return credit_card.id if credit_card else None

    # Tipos extraidos pelo LLM que indicam CREDITO (type=INCOME)
    # Creditos reduzem o valor da fatura
    INCOME_TRANSACTION_TYPES = ['pagamento', 'credito', 'estorno']

    # Padroes de descricao que indicam pagamento de fatura (fallback)
    PAYMENT_DESCRIPTION_PATTERNS = [
        'pagamento em ',      # Nubank: "Pagamento em 08 DEZ"
        'pagamento de fatura',
        'pag fatura',
        'pgto fatura',
        'pgto cobranca',
        'pagamento efetuado',
        'pgto debito automatico',
        'pagamento recebido',
        'credito pagamento',
    ]

    def _determine_transaction_type(self, data: TransactionConfirm) -> TransactionType:
        """
        Determina o tipo da transacao (EXPENSE ou INCOME).

        Prioridade:
        1. extracted_transaction_type do LLM (se fornecido)
        2. Inferencia por padroes na descricao (fallback)

        Tipos do LLM que indicam INCOME:
        - pagamento: pagamento de fatura anterior
        - credito: cashback, creditos promocionais
        - estorno: devolucoes, cancelamentos

        Tipos que indicam EXPENSE:
        - compra: compras normais
        - anuidade: tarifa de anuidade
        - encargo: juros, multas, IOF
        - saldo_anterior: saldo de fatura anterior
        """
        # 1. Se extracted_transaction_type foi fornecido, usar ele
        extracted_type = getattr(data, 'extracted_transaction_type', None)
        if extracted_type:
            if extracted_type.lower() in self.INCOME_TRANSACTION_TYPES:
                return TransactionType.INCOME
            return TransactionType.EXPENSE

        # 2. Fallback: inferir por padroes na descricao
        desc_lower = (data.description or '').lower()
        is_payment = any(pattern in desc_lower for pattern in self.PAYMENT_DESCRIPTION_PATTERNS)
        if is_payment:
            return TransactionType.INCOME

        # 3. Default: EXPENSE
        return TransactionType.EXPENSE

    def _infer_payment_method(self, data, credit_card_id: int | None) -> str | None:
        """
        Infere o metodo de pagamento se nao foi fornecido explicitamente.

        Regras de inferencia:
        - Se credit_card_id: credit_card
        - Se income_source_id e type=income: bank_transfer
        - Se type=expense sem cartao: debit_card (default)
        - Se type=income sem fonte: None
        - Se type=transfer: None
        """
        # Se foi informado explicitamente, usar o valor
        payment_method = getattr(data, 'payment_method', None)
        if payment_method:
            return payment_method.value if hasattr(payment_method, 'value') else payment_method

        # Inferir baseado no contexto
        if credit_card_id:
            return PaymentMethod.CREDIT_CARD.value

        income_source_id = getattr(data, 'income_source_id', None)

        # Obter o tipo de transacao
        # TransactionCreate tem 'type', TransactionConfirm tem 'extracted_transaction_type'
        transaction_type = None
        if hasattr(data, 'type') and data.type:
            transaction_type = data.type.value if hasattr(data.type, 'value') else data.type
        elif hasattr(data, 'extracted_transaction_type') and data.extracted_transaction_type:
            # Converter extracted_transaction_type para TransactionType
            extracted = data.extracted_transaction_type.lower()
            if extracted in ['compra', 'anuidade', 'encargo']:
                transaction_type = TransactionType.EXPENSE.value
            elif extracted in ['pagamento', 'credito', 'estorno']:
                transaction_type = TransactionType.INCOME.value

        if transaction_type == TransactionType.INCOME.value:
            if income_source_id:
                return PaymentMethod.BANK_TRANSFER.value
            return None  # Receita sem fonte definida

        if transaction_type == TransactionType.EXPENSE.value:
            return PaymentMethod.DEBIT_CARD.value  # Default para despesas

        # Transfer ou outros casos
        return None

    async def _find_matching_projected_transaction(
        self,
        user: User,
        merchant_name: str | None,
        amount: float,
        transaction_date: date,
        credit_card_id: int | None = None,
    ) -> Transaction | None:
        """
        Busca uma transacao projetada (futura/nao paga) que corresponda aos dados.

        Usado para evitar duplicatas quando o PDF real e enviado.
        Transacoes projetadas sao criadas a partir de:
        - Recorrentes (Netflix, aluguel, etc.)
        - Parcelas futuras de compras parceladas

        Criterios de match:
        - Mesmo cartao de credito (se fornecido)
        - Valor similar (+/-5%)
        - Data proxima (+/-15 dias)
        - is_paid = False (transacao futura/projetada)
        - Descricao similar (se disponivel)
        """
        if not merchant_name:
            return None

        normalized_merchant = merchant_name.lower().strip()[:50]  # Primeiros 50 chars
        min_amount = amount * 0.95
        max_amount = amount * 1.05
        min_date = transaction_date - timedelta(days=15)
        max_date = transaction_date + timedelta(days=15)

        query = select(Transaction).where(
            and_(
                Transaction.user_id == user.id,
                Transaction.amount >= min_amount,
                Transaction.amount <= max_amount,
                Transaction.date >= min_date,
                Transaction.date <= max_date,
                Transaction.is_paid == False,  # Transacao futura/projetada
                Transaction.document_id.is_(None),  # Nao vinculada a documento ainda
            )
        )

        if credit_card_id:
            query = query.where(Transaction.credit_card_id == credit_card_id)

        result = await self.db.execute(query)
        candidates = list(result.scalars().all())

        if not candidates:
            return None

        # Buscar melhor match por descricao
        best_match = None
        best_score = 0

        for tx in candidates:
            score = 0
            if tx.description:
                tx_desc = tx.description.lower()
                # Verifica se o merchant esta na descricao
                if normalized_merchant in tx_desc:
                    score += 10
                # Verifica palavras em comum
                merchant_words = set(normalized_merchant.split())
                desc_words = set(tx_desc.split())
                common_words = merchant_words & desc_words
                score += len(common_words) * 2

            # Bonus por data exata
            if tx.date == transaction_date:
                score += 5

            # Bonus por valor exato
            if abs(float(tx.amount) - amount) < 0.01:
                score += 5

            # Bonus se e de recorrente ou parcela
            if tx.recurring_id or tx.installment_series_id:
                score += 3

            if score > best_score:
                best_score = score
                best_match = tx

        # Retorna match apenas se tiver score minimo
        if best_score >= 5:
            return best_match

        return None
