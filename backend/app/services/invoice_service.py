"""Serviço para gerenciamento de faturas de cartão de crédito"""

from datetime import date, datetime
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException, status

from ..models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from ..models.credit_card import CreditCard
from ..models.transaction import Transaction, TransactionType
from ..models.account import Account
from ..models.category import Category
from ..models.user import User
from ..models.document import Document
from ..models.recurring import RecurringTransaction


class InvoiceService:
    """Gerencia faturas de cartão de crédito"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def calculate_invoice_period(
        self,
        credit_card: CreditCard,
        reference_date: date
    ) -> dict:
        """
        Calcula o período da fatura baseado no closing_day do cartão.

        Para um cartão com fechamento no dia 15:
        - Compra em 10/01: fatura de Jan (fecha 15/01, vence ~25/01)
        - Compra em 20/01: fatura de Fev (fecha 15/02, vence ~25/02)

        Retorna:
        - reference_month: Mês de referência da fatura
        - reference_year: Ano de referência
        - closing_date: Data de fechamento
        - due_date: Data de vencimento
        """
        closing_day = credit_card.closing_day
        due_day = credit_card.due_day

        # Se a compra foi após o fechamento, vai para a próxima fatura
        if reference_date.day > closing_day:
            # Fatura do próximo mês
            next_month = reference_date + relativedelta(months=1)
            ref_month = next_month.month
            ref_year = next_month.year
        else:
            # Fatura do mês atual
            ref_month = reference_date.month
            ref_year = reference_date.year

        # Usar método auxiliar para calcular datas
        dates = self.calculate_invoice_dates(credit_card, ref_month, ref_year)

        return {
            'reference_month': ref_month,
            'reference_year': ref_year,
            'closing_date': dates['closing_date'],
            'due_date': dates['due_date'],
        }

    def calculate_invoice_dates(
        self,
        credit_card: CreditCard,
        reference_month: int,
        reference_year: int,
    ) -> dict:
        """
        Calcula as datas de fechamento e vencimento para um mês/ano específico.

        Usado quando o mês/ano da fatura é fornecido explicitamente (ex: de um PDF).

        Retorna:
        - closing_date: Data de fechamento
        - due_date: Data de vencimento
        """
        closing_day = credit_card.closing_day
        due_day = credit_card.due_day

        # Calcular data de fechamento (no mês de referência)
        try:
            closing_date = date(reference_year, reference_month, min(closing_day, 28))
        except ValueError:
            # Em caso de dia inválido, usar último dia do mês
            closing_date = date(reference_year, reference_month, 28)

        # Calcular data de vencimento
        # Se due_day < closing_day, vencimento é no mês seguinte
        if due_day < closing_day:
            due_date_month = closing_date + relativedelta(months=1)
            try:
                due_date = date(due_date_month.year, due_date_month.month, min(due_day, 28))
            except ValueError:
                due_date = date(due_date_month.year, due_date_month.month, 28)
        else:
            try:
                due_date = date(reference_year, reference_month, min(due_day, 28))
            except ValueError:
                due_date = date(reference_year, reference_month, 28)

        return {
            'closing_date': closing_date,
            'due_date': due_date,
        }

    async def get_or_create_invoice(
        self,
        user: User,
        credit_card: CreditCard,
        reference_month: int,
        reference_year: int,
        closing_date: date | None = None,
        due_date: date | None = None,
    ) -> CreditCardInvoice:
        """Obtém ou cria uma fatura para o período especificado"""
        # Buscar fatura existente
        result = await self.db.execute(
            select(CreditCardInvoice).where(
                and_(
                    CreditCardInvoice.user_id == user.id,
                    CreditCardInvoice.credit_card_id == credit_card.id,
                    CreditCardInvoice.reference_month == reference_month,
                    CreditCardInvoice.reference_year == reference_year,
                )
            )
        )
        invoice = result.scalar_one_or_none()

        if invoice:
            return invoice

        # Se não forneceu datas, calcular baseado em uma data de referência
        if not closing_date or not due_date:
            ref_date = date(reference_year, reference_month, 1)
            period = self.calculate_invoice_period(credit_card, ref_date)
            closing_date = period['closing_date']
            due_date = period['due_date']

        # Criar nova fatura
        invoice = CreditCardInvoice(
            user_id=user.id,
            credit_card_id=credit_card.id,
            reference_month=reference_month,
            reference_year=reference_year,
            closing_date=closing_date,
            due_date=due_date,
            total_amount=Decimal('0'),
            paid_amount=Decimal('0'),
            status=InvoiceStatus.OPEN.value,
        )

        self.db.add(invoice)
        await self.db.flush()
        await self.db.refresh(invoice)

        return invoice

    async def update_invoice_total(self, invoice: CreditCardInvoice) -> None:
        """Recalcula o total da fatura baseado nas transações vinculadas"""
        result = await self.db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.invoice_id == invoice.id
            )
        )
        total = result.scalar() or Decimal('0')

        invoice.total_amount = total
        await self.db.flush()

    async def link_transaction_to_invoice(
        self,
        transaction: Transaction,
        invoice: CreditCardInvoice | None = None,
        credit_card: CreditCard | None = None,
    ) -> CreditCardInvoice:
        """
        Vincula uma transação à fatura apropriada.

        Se invoice não for fornecida, calcula a fatura baseada na data da transação
        e no cartão de crédito.
        """
        if not invoice:
            if not credit_card:
                raise ValueError("Deve fornecer invoice ou credit_card")

            # Obter usuário
            result = await self.db.execute(
                select(User).where(User.id == transaction.user_id)
            )
            user = result.scalar_one()

            # Calcular período
            period = self.calculate_invoice_period(credit_card, transaction.date)

            # Obter ou criar fatura
            invoice = await self.get_or_create_invoice(
                user=user,
                credit_card=credit_card,
                reference_month=period['reference_month'],
                reference_year=period['reference_year'],
                closing_date=period['closing_date'],
                due_date=period['due_date'],
            )

        # Vincular transação
        transaction.invoice_id = invoice.id

        # Atualizar total
        await self.update_invoice_total(invoice)

        return invoice

    async def get_or_create_payment_category(self, user_id: int) -> Category:
        """Obtém ou cria a categoria 'Cartão de Crédito' para pagamentos"""
        result = await self.db.execute(
            select(Category).where(
                and_(
                    Category.user_id == user_id,
                    Category.name == "Pagamento de Fatura",
                )
            )
        )
        category = result.scalar_one_or_none()

        if not category:
            category = Category(
                user_id=user_id,
                name="Pagamento de Fatura",
                type="expense",
                icon="💳",
            )
            self.db.add(category)
            await self.db.flush()

        return category

    async def pay_invoice(
        self,
        user: User,
        invoice: CreditCardInvoice,
        amount: Decimal,
        payment_account_id: int,
        payment_date: date | None = None,
    ) -> Transaction:
        """
        Registra o pagamento de uma fatura.

        1. Valida que a conta de pagamento não é cartão de crédito
        2. Cria transação de saída na conta de pagamento
        3. Atualiza status da fatura
        """
        # Validar conta de pagamento
        result = await self.db.execute(
            select(Account).where(
                and_(
                    Account.id == payment_account_id,
                    Account.user_id == user.id,
                )
            )
        )
        payment_account = result.scalar_one_or_none()

        if not payment_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conta de pagamento não encontrada",
            )

        if payment_account.type == "credit_card":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é possível pagar fatura com outro cartão de crédito",
            )

        # Obter categoria de pagamento
        category = await self.get_or_create_payment_category(user.id)

        # Obter cartão para descrição
        result = await self.db.execute(
            select(CreditCard).where(CreditCard.id == invoice.credit_card_id)
        )
        credit_card = result.scalar_one()

        result = await self.db.execute(
            select(Account).where(Account.id == credit_card.account_id)
        )
        card_account = result.scalar_one()

        # Criar transação de pagamento
        payment_transaction = Transaction(
            user_id=user.id,
            account_id=payment_account_id,
            category_id=category.id,
            type=TransactionType.EXPENSE.value,
            amount=amount,
            date=payment_date or date.today(),
            description=f"Pagamento Fatura {card_account.name} - {invoice.period_display}",
            is_fixed=True,
        )

        self.db.add(payment_transaction)
        await self.db.flush()
        await self.db.refresh(payment_transaction)

        # Atualizar fatura
        invoice.paid_amount = (invoice.paid_amount or Decimal('0')) + amount
        invoice.paid_at = datetime.utcnow()
        invoice.payment_account_id = payment_account_id
        invoice.payment_transaction_id = payment_transaction.id

        # Atualizar status
        if invoice.paid_amount >= invoice.total_amount:
            invoice.status = InvoiceStatus.PAID.value
        elif invoice.paid_amount > 0:
            invoice.status = InvoiceStatus.PARTIAL.value

        await self.db.flush()

        return payment_transaction

    async def detect_card_from_document(
        self,
        user: User,
        document_data: dict,
    ) -> list[CreditCard]:
        """
        Detecta possíveis cartões baseado nos dados extraídos do documento.

        Busca por:
        - card_issuer: nome do banco (itau, nubank, etc)
        - card_last_digits: últimos 4 dígitos

        Retorna lista de cartões que podem corresponder.
        """
        card_issuer = document_data.get('card_issuer', '').lower().strip()
        card_last_digits = document_data.get('card_last_digits', '').strip()

        # Buscar cartões do usuário
        result = await self.db.execute(
            select(CreditCard).where(
                and_(
                    CreditCard.user_id == user.id,
                    CreditCard.is_active == True,
                )
            )
        )
        cards = list(result.scalars().all())

        if not cards:
            return []

        matches = []

        # Buscar contas para comparar nomes
        for card in cards:
            result = await self.db.execute(
                select(Account).where(Account.id == card.account_id)
            )
            account = result.scalar_one()

            score = 0

            # Match por últimos 4 dígitos (alta prioridade)
            if card_last_digits and card.last_four_digits:
                if card.last_four_digits == card_last_digits:
                    score += 10

            # Match por emissor no nome da conta
            if card_issuer:
                account_name_lower = account.name.lower()
                issuer_variants = self._get_issuer_variants(card_issuer)

                for variant in issuer_variants:
                    if variant in account_name_lower:
                        score += 5
                        break

            if score > 0:
                matches.append((score, card))

        # Ordenar por score decrescente
        matches.sort(key=lambda x: x[0], reverse=True)

        return [card for score, card in matches]

    def _get_issuer_variants(self, issuer: str) -> list[str]:
        """Retorna variantes do nome do emissor para matching"""
        variants_map = {
            'itau': ['itau', 'itaú', 'itaucard'],
            'nubank': ['nubank', 'nu'],
            'inter': ['inter', 'banco inter'],
            'santander': ['santander'],
            'bradesco': ['bradesco'],
            'bb': ['banco do brasil', 'bb'],
            'caixa': ['caixa', 'cef'],
            'c6': ['c6', 'c6 bank'],
            'xp': ['xp'],
            'btg': ['btg'],
            'original': ['original'],
            'next': ['next'],
            'neon': ['neon'],
            'pagbank': ['pagbank', 'pagseguro'],
            'picpay': ['picpay'],
            'mercadopago': ['mercado pago', 'mercadopago'],
        }

        # Buscar variantes conhecidas
        for key, variants in variants_map.items():
            if issuer in variants or key == issuer:
                return variants

        # Se não encontrou, retornar o próprio issuer
        return [issuer]

    async def update_invoice_statuses(self) -> int:
        """
        Atualiza status de faturas baseado em datas.

        - OPEN -> CLOSED: se passou da closing_date
        - CLOSED -> OVERDUE: se passou da due_date e não foi paga

        Retorna quantidade de faturas atualizadas.
        """
        today = date.today()
        updated_count = 0

        # Buscar faturas OPEN que passaram do fechamento
        result = await self.db.execute(
            select(CreditCardInvoice).where(
                and_(
                    CreditCardInvoice.status == InvoiceStatus.OPEN.value,
                    CreditCardInvoice.closing_date < today,
                )
            )
        )
        open_invoices = list(result.scalars().all())

        for invoice in open_invoices:
            invoice.status = InvoiceStatus.CLOSED.value
            updated_count += 1

        # Buscar faturas CLOSED/PARTIAL que passaram do vencimento
        result = await self.db.execute(
            select(CreditCardInvoice).where(
                and_(
                    CreditCardInvoice.status.in_([
                        InvoiceStatus.CLOSED.value,
                        InvoiceStatus.PARTIAL.value,
                    ]),
                    CreditCardInvoice.due_date < today,
                )
            )
        )
        closed_invoices = list(result.scalars().all())

        for invoice in closed_invoices:
            invoice.status = InvoiceStatus.OVERDUE.value
            updated_count += 1

        await self.db.flush()

        return updated_count

    async def get_invoice_by_id(
        self,
        user: User,
        invoice_id: int,
    ) -> CreditCardInvoice | None:
        """Obtém uma fatura por ID"""
        result = await self.db.execute(
            select(CreditCardInvoice).where(
                and_(
                    CreditCardInvoice.id == invoice_id,
                    CreditCardInvoice.user_id == user.id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_invoices(
        self,
        user: User,
        credit_card_id: int | None = None,
        status_filter: str | None = None,
        year: int | None = None,
        month: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[CreditCardInvoice]:
        """Lista faturas do usuário com filtros"""
        query = select(CreditCardInvoice).where(
            CreditCardInvoice.user_id == user.id
        )

        if credit_card_id:
            query = query.where(CreditCardInvoice.credit_card_id == credit_card_id)

        if status_filter:
            query = query.where(CreditCardInvoice.status == status_filter)

        if year:
            query = query.where(CreditCardInvoice.reference_year == year)

        if month:
            query = query.where(CreditCardInvoice.reference_month == month)

        query = query.order_by(
            CreditCardInvoice.reference_year.desc(),
            CreditCardInvoice.reference_month.desc(),
        ).limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_invoice_transactions(
        self,
        invoice: CreditCardInvoice,
    ) -> list[Transaction]:
        """Obtém todas as transações de uma fatura"""
        result = await self.db.execute(
            select(Transaction).where(
                Transaction.invoice_id == invoice.id
            ).order_by(Transaction.date.desc())
        )
        return list(result.scalars().all())

    async def get_card_current_invoice(
        self,
        user: User,
        credit_card: CreditCard,
    ) -> CreditCardInvoice | None:
        """Obtém a fatura atual (aberta) de um cartão"""
        today = date.today()
        period = self.calculate_invoice_period(credit_card, today)

        result = await self.db.execute(
            select(CreditCardInvoice).where(
                and_(
                    CreditCardInvoice.user_id == user.id,
                    CreditCardInvoice.credit_card_id == credit_card.id,
                    CreditCardInvoice.reference_month == period['reference_month'],
                    CreditCardInvoice.reference_year == period['reference_year'],
                )
            )
        )
        return result.scalar_one_or_none()

    async def delete_invoice(
        self,
        user: User,
        invoice_id: int,
        delete_transactions: bool = False,
    ) -> int:
        """
        Exclui uma fatura.

        Args:
            user: Usuário atual
            invoice_id: ID da fatura
            delete_transactions: Se True, deleta as transações vinculadas.
                                 Se False, apenas desvincula (invoice_id = None).

        Returns:
            Número de transações afetadas (deletadas ou desvinculadas)
        """
        invoice = await self.get_invoice_by_id(user, invoice_id)

        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fatura não encontrada",
            )

        # Buscar transações vinculadas
        result = await self.db.execute(
            select(Transaction).where(Transaction.invoice_id == invoice_id)
        )
        transactions = list(result.scalars().all())
        transaction_count = len(transactions)

        if delete_transactions:
            # Deletar transações
            for transaction in transactions:
                await self.db.delete(transaction)
        else:
            # Apenas desvincular
            for transaction in transactions:
                transaction.invoice_id = None

        # Excluir fatura
        await self.db.delete(invoice)
        await self.db.flush()

        return transaction_count

    async def create_invoice_from_document(
        self,
        user: User,
        document: Document,
        credit_card: CreditCard,
        reference_month: int,
        reference_year: int,
        total_amount: Decimal | None = None,
    ) -> CreditCardInvoice:
        """
        Cria uma fatura a partir de um documento PDF.

        O documento fica vinculado à fatura para referência.
        """
        # Calcular datas
        ref_date = date(reference_year, reference_month, 1)
        period = self.calculate_invoice_period(credit_card, ref_date)

        # Verificar se já existe fatura para o período
        existing = await self.db.execute(
            select(CreditCardInvoice).where(
                and_(
                    CreditCardInvoice.credit_card_id == credit_card.id,
                    CreditCardInvoice.reference_month == reference_month,
                    CreditCardInvoice.reference_year == reference_year,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Já existe uma fatura para {reference_month}/{reference_year}",
            )

        invoice = CreditCardInvoice(
            user_id=user.id,
            credit_card_id=credit_card.id,
            document_id=document.id,
            reference_month=reference_month,
            reference_year=reference_year,
            closing_date=period['closing_date'],
            due_date=period['due_date'],
            total_amount=total_amount or Decimal('0'),
            paid_amount=Decimal('0'),
            status=InvoiceStatus.OPEN.value,
        )

        self.db.add(invoice)
        await self.db.flush()
        await self.db.refresh(invoice)

        return invoice

    async def project_recurring_to_invoices(
        self,
        user: User,
        credit_card: CreditCard,
        months_ahead: int = 6,
    ) -> list[Transaction]:
        """
        Projeta transações recorrentes para faturas futuras.

        Busca todas as transações recorrentes ativas que estão vinculadas
        à conta do cartão de crédito e cria transações projetadas (is_paid=False)
        para os próximos N meses.

        Args:
            user: Usuário
            credit_card: Cartão de crédito
            months_ahead: Número de meses para projetar (default: 6)

        Returns:
            Lista de transações projetadas criadas
        """
        today = date.today()
        created_transactions = []

        # Buscar recorrentes ativas vinculadas à conta do cartão
        result = await self.db.execute(
            select(RecurringTransaction).where(
                and_(
                    RecurringTransaction.user_id == user.id,
                    RecurringTransaction.account_id == credit_card.account_id,
                    RecurringTransaction.status == "active",
                    RecurringTransaction.type == "expense",
                )
            )
        )
        recurring_list = list(result.scalars().all())

        if not recurring_list:
            return []

        # Para cada recorrente, projetar para os próximos meses
        for recurring in recurring_list:
            for month_offset in range(1, months_ahead + 1):
                # Calcular data da transação
                projected_date = today + relativedelta(months=month_offset)

                # Ajustar para o dia do mês configurado
                if recurring.day_of_month:
                    try:
                        projected_date = date(
                            projected_date.year,
                            projected_date.month,
                            min(recurring.day_of_month, 28)
                        )
                    except ValueError:
                        projected_date = date(
                            projected_date.year,
                            projected_date.month,
                            28
                        )

                # Verificar se já existe transação para esta data e recorrente
                existing_result = await self.db.execute(
                    select(Transaction).where(
                        and_(
                            Transaction.recurring_id == recurring.id,
                            Transaction.date >= projected_date - relativedelta(days=10),
                            Transaction.date <= projected_date + relativedelta(days=10),
                        )
                    )
                )
                if existing_result.scalar_one_or_none():
                    continue  # Já existe, pular

                # Calcular período da fatura
                period = self.calculate_invoice_period(credit_card, projected_date)

                # Obter ou criar fatura
                invoice = await self.get_or_create_invoice(
                    user=user,
                    credit_card=credit_card,
                    reference_month=period['reference_month'],
                    reference_year=period['reference_year'],
                    closing_date=period['closing_date'],
                    due_date=period['due_date'],
                )

                # Criar transação projetada
                transaction = Transaction(
                    user_id=user.id,
                    account_id=credit_card.account_id,
                    category_id=recurring.category_id,
                    credit_card_id=credit_card.id,
                    invoice_id=invoice.id,
                    recurring_id=recurring.id,
                    type=TransactionType.EXPENSE.value,
                    amount=recurring.amount,
                    date=projected_date,
                    description=f"{recurring.name} (projetado)",
                    is_paid=False,  # Transação futura/projetada
                    is_fixed=True,
                    ownership_type=recurring.ownership_type,
                )

                self.db.add(transaction)
                created_transactions.append(transaction)

        await self.db.flush()

        # Atualizar totais das faturas
        invoice_ids = set(t.invoice_id for t in created_transactions if t.invoice_id)
        for inv_id in invoice_ids:
            result = await self.db.execute(
                select(CreditCardInvoice).where(CreditCardInvoice.id == inv_id)
            )
            invoice = result.scalar_one_or_none()
            if invoice:
                await self.update_invoice_total(invoice)

        return created_transactions
