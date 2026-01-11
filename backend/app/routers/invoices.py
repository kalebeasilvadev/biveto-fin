from __future__ import annotations
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select, func

from ..core.deps import CurrentUser, DbSession
from ..models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from ..models.credit_card import CreditCard
from ..models.account import Account
from ..models.transaction import Transaction
from ..models.document import Document
from ..services.invoice_service import InvoiceService
from ..schemas.invoice import (
    InvoiceCreate,
    InvoiceFromDocument,
    InvoiceUpdate,
    InvoicePayment,
    InvoiceResponse,
    InvoiceDetailResponse,
    InvoiceTransactionResponse,
    InvoiceSummary,
    CardDetectionResult,
    DetectedCardInfo,
)

router = APIRouter()


def build_invoice_response(
    invoice: CreditCardInvoice,
    credit_card_name: str | None = None,
    payment_account_name: str | None = None,
    transaction_count: int = 0,
) -> InvoiceResponse:
    """Helper para construir resposta de fatura"""
    return InvoiceResponse(
        id=invoice.id,
        user_id=invoice.user_id,
        credit_card_id=invoice.credit_card_id,
        document_id=invoice.document_id,
        reference_month=invoice.reference_month,
        reference_year=invoice.reference_year,
        closing_date=invoice.closing_date,
        due_date=invoice.due_date,
        total_amount=float(invoice.total_amount),
        minimum_payment=float(invoice.minimum_payment) if invoice.minimum_payment else None,
        paid_amount=float(invoice.paid_amount),
        remaining_amount=float(invoice.remaining_amount),
        status=invoice.status,
        paid_at=invoice.paid_at,
        payment_account_id=invoice.payment_account_id,
        payment_transaction_id=invoice.payment_transaction_id,
        payment_transaction_ids=invoice.payment_transaction_ids,
        notes=invoice.notes,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        credit_card_name=credit_card_name,
        payment_account_name=payment_account_name,
        period_display=invoice.period_display,
        transaction_count=transaction_count,
    )


@router.get("", response_model=list[InvoiceResponse])
async def list_invoices(
    current_user: CurrentUser,
    db: DbSession,
    credit_card_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    year: int | None = None,
    month: int | None = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
):
    """Lista faturas do usuário"""
    service = InvoiceService(db)

    # Lazy update: atualiza status das faturas baseado em datas
    await service.update_invoice_statuses()

    invoices = await service.list_invoices(
        user=current_user,
        credit_card_id=credit_card_id,
        status_filter=status_filter,
        year=year,
        month=month,
        limit=limit,
        offset=offset,
    )

    # Buscar nomes dos cartões e contas
    responses = []
    for invoice in invoices:
        # Buscar nome do cartão
        card_result = await db.execute(
            select(Account.name)
            .join(CreditCard, CreditCard.account_id == Account.id)
            .where(CreditCard.id == invoice.credit_card_id)
        )
        credit_card_name = card_result.scalar_one_or_none()

        # Buscar nome da conta de pagamento
        payment_account_name = None
        if invoice.payment_account_id:
            pay_result = await db.execute(
                select(Account.name).where(Account.id == invoice.payment_account_id)
            )
            payment_account_name = pay_result.scalar_one_or_none()

        # Contar transações
        count_result = await db.execute(
            select(func.count(Transaction.id)).where(
                Transaction.invoice_id == invoice.id
            )
        )
        transaction_count = count_result.scalar() or 0

        responses.append(build_invoice_response(
            invoice,
            credit_card_name=credit_card_name,
            payment_account_name=payment_account_name,
            transaction_count=transaction_count,
        ))

    return responses


@router.get("/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice(
    invoice_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna detalhes de uma fatura com suas transações"""
    service = InvoiceService(db)
    invoice = await service.get_invoice_by_id(current_user, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fatura não encontrada",
        )

    # Buscar nome do cartão
    card_result = await db.execute(
        select(Account.name)
        .join(CreditCard, CreditCard.account_id == Account.id)
        .where(CreditCard.id == invoice.credit_card_id)
    )
    credit_card_name = card_result.scalar_one_or_none()

    # Buscar nome da conta de pagamento
    payment_account_name = None
    if invoice.payment_account_id:
        pay_result = await db.execute(
            select(Account.name).where(Account.id == invoice.payment_account_id)
        )
        payment_account_name = pay_result.scalar_one_or_none()

    # Buscar transações
    transactions = await service.get_invoice_transactions(invoice)

    transaction_responses = []
    for t in transactions:
        transaction_responses.append(InvoiceTransactionResponse(
            id=t.id,
            date=t.date,
            description=t.description,
            merchant_name=t.merchant.name if t.merchant else None,
            category_name=t.category.name if t.category else None,
            amount=float(t.amount),
            installment_number=t.installment_number,
            installment_total=t.installment_total,
            is_paid=t.is_paid,
        ))

    return InvoiceDetailResponse(
        id=invoice.id,
        user_id=invoice.user_id,
        credit_card_id=invoice.credit_card_id,
        document_id=invoice.document_id,
        reference_month=invoice.reference_month,
        reference_year=invoice.reference_year,
        closing_date=invoice.closing_date,
        due_date=invoice.due_date,
        total_amount=float(invoice.total_amount),
        minimum_payment=float(invoice.minimum_payment) if invoice.minimum_payment else None,
        paid_amount=float(invoice.paid_amount),
        remaining_amount=float(invoice.remaining_amount),
        status=invoice.status,
        paid_at=invoice.paid_at,
        payment_account_id=invoice.payment_account_id,
        payment_transaction_id=invoice.payment_transaction_id,
        notes=invoice.notes,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        credit_card_name=credit_card_name,
        payment_account_name=payment_account_name,
        period_display=invoice.period_display,
        transaction_count=len(transactions),
        transactions=transaction_responses,
    )


@router.post("", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma nova fatura manualmente"""
    # Validar cartão
    card_result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == data.credit_card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    credit_card = card_result.scalar_one_or_none()

    if not credit_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão não encontrado",
        )

    service = InvoiceService(db)

    # Verificar se já existe fatura para o período
    existing = await db.execute(
        select(CreditCardInvoice).where(
            CreditCardInvoice.credit_card_id == data.credit_card_id,
            CreditCardInvoice.reference_month == data.reference_month,
            CreditCardInvoice.reference_year == data.reference_year,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Já existe fatura para {data.reference_month}/{data.reference_year}",
        )

    invoice = await service.get_or_create_invoice(
        user=current_user,
        credit_card=credit_card,
        reference_month=data.reference_month,
        reference_year=data.reference_year,
        closing_date=data.closing_date,
        due_date=data.due_date,
    )

    if data.total_amount:
        invoice.total_amount = Decimal(str(data.total_amount))

    if data.notes:
        invoice.notes = data.notes

    await db.commit()
    await db.refresh(invoice)

    # Buscar nome do cartão
    account_result = await db.execute(
        select(Account.name).where(Account.id == credit_card.account_id)
    )
    credit_card_name = account_result.scalar_one_or_none()

    return build_invoice_response(invoice, credit_card_name=credit_card_name)


@router.post("/from-document", response_model=InvoiceResponse, status_code=201)
async def create_invoice_from_document(
    data: InvoiceFromDocument,
    current_user: CurrentUser,
    db: DbSession,
):
    """Cria uma fatura a partir de um documento PDF"""
    # Validar documento
    doc_result = await db.execute(
        select(Document).where(
            Document.id == data.document_id,
            Document.user_id == current_user.id,
        )
    )
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento não encontrado",
        )

    # Validar cartão
    card_result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == data.credit_card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    credit_card = card_result.scalar_one_or_none()

    if not credit_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão não encontrado",
        )

    service = InvoiceService(db)

    invoice = await service.create_invoice_from_document(
        user=current_user,
        document=document,
        credit_card=credit_card,
        reference_month=data.reference_month,
        reference_year=data.reference_year,
        total_amount=Decimal(str(data.total_amount)) if data.total_amount else None,
    )

    await db.commit()
    await db.refresh(invoice)

    # Buscar nome do cartão
    account_result = await db.execute(
        select(Account.name).where(Account.id == credit_card.account_id)
    )
    credit_card_name = account_result.scalar_one_or_none()

    return build_invoice_response(invoice, credit_card_name=credit_card_name)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Atualiza uma fatura"""
    service = InvoiceService(db)
    invoice = await service.get_invoice_by_id(current_user, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fatura não encontrada",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "notes" in update_data:
        invoice.notes = update_data["notes"]

    if "status" in update_data:
        # Validar status
        valid_statuses = [s.value for s in InvoiceStatus]
        if update_data["status"] not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status inválido. Valores válidos: {valid_statuses}",
            )
        invoice.status = update_data["status"]

    if "minimum_payment" in update_data:
        invoice.minimum_payment = Decimal(str(update_data["minimum_payment"]))

    await db.commit()
    await db.refresh(invoice)

    # Buscar nome do cartão
    card_result = await db.execute(
        select(Account.name)
        .join(CreditCard, CreditCard.account_id == Account.id)
        .where(CreditCard.id == invoice.credit_card_id)
    )
    credit_card_name = card_result.scalar_one_or_none()

    return build_invoice_response(invoice, credit_card_name=credit_card_name)


class DeleteInvoiceResponse(BaseModel):
    message: str
    transactions_deleted: int


@router.delete("/{invoice_id}", response_model=DeleteInvoiceResponse)
async def delete_invoice(
    invoice_id: int,
    current_user: CurrentUser,
    db: DbSession,
    delete_transactions: bool = Query(
        False,
        description="Se True, deleta as transações vinculadas. Se False, apenas desvincula."
    ),
):
    """
    Exclui uma fatura.

    - Se delete_transactions=False (padrão): apenas desvincula as transações
    - Se delete_transactions=True: deleta a fatura E todas as transações vinculadas
    """
    service = InvoiceService(db)
    transaction_count = await service.delete_invoice(
        current_user,
        invoice_id,
        delete_transactions=delete_transactions,
    )
    await db.commit()

    action = "deletadas" if delete_transactions else "desvinculadas"
    return DeleteInvoiceResponse(
        message=f"Fatura excluída. {transaction_count} transações {action}.",
        transactions_deleted=transaction_count if delete_transactions else 0,
    )


@router.post("/{invoice_id}/pay", response_model=InvoiceResponse)
async def pay_invoice(
    invoice_id: int,
    data: InvoicePayment,
    current_user: CurrentUser,
    db: DbSession,
):
    """Registra pagamento de uma fatura"""
    service = InvoiceService(db)
    invoice = await service.get_invoice_by_id(current_user, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fatura não encontrada",
        )

    if invoice.status == InvoiceStatus.PAID.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fatura já está paga",
        )

    payment_transaction = await service.pay_invoice(
        user=current_user,
        invoice=invoice,
        amount=Decimal(str(data.amount)),
        payment_account_id=data.payment_account_id,
        payment_date=data.payment_date,
    )

    await db.commit()
    await db.refresh(invoice)

    # Buscar nomes
    card_result = await db.execute(
        select(Account.name)
        .join(CreditCard, CreditCard.account_id == Account.id)
        .where(CreditCard.id == invoice.credit_card_id)
    )
    credit_card_name = card_result.scalar_one_or_none()

    pay_result = await db.execute(
        select(Account.name).where(Account.id == data.payment_account_id)
    )
    payment_account_name = pay_result.scalar_one_or_none()

    return build_invoice_response(
        invoice,
        credit_card_name=credit_card_name,
        payment_account_name=payment_account_name,
    )


@router.get("/credit-card/{card_id}", response_model=list[InvoiceResponse])
async def list_card_invoices(
    card_id: int,
    current_user: CurrentUser,
    db: DbSession,
    year: int | None = None,
    limit: int = Query(12, le=50),
):
    """Lista faturas de um cartão específico"""
    # Validar cartão
    card_result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    if not card_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão não encontrado",
        )

    service = InvoiceService(db)
    invoices = await service.list_invoices(
        user=current_user,
        credit_card_id=card_id,
        year=year,
        limit=limit,
    )

    # Buscar nome do cartão uma vez
    account_result = await db.execute(
        select(Account.name)
        .join(CreditCard, CreditCard.account_id == Account.id)
        .where(CreditCard.id == card_id)
    )
    credit_card_name = account_result.scalar_one_or_none()

    responses = []
    for invoice in invoices:
        # Contar transações
        count_result = await db.execute(
            select(func.count(Transaction.id)).where(
                Transaction.invoice_id == invoice.id
            )
        )
        transaction_count = count_result.scalar() or 0

        responses.append(build_invoice_response(
            invoice,
            credit_card_name=credit_card_name,
            transaction_count=transaction_count,
        ))

    return responses


@router.get("/credit-card/{card_id}/current", response_model=InvoiceSummary)
async def get_card_current_invoice(
    card_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna resumo da fatura atual de um cartão"""
    # Validar cartão
    card_result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    credit_card = card_result.scalar_one_or_none()

    if not credit_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartão não encontrado",
        )

    service = InvoiceService(db)
    invoice = await service.get_card_current_invoice(current_user, credit_card)

    # Se não tem fatura, calcular período atual
    today = date.today()
    period = service.calculate_invoice_period(credit_card, today)

    if not invoice:
        return InvoiceSummary(
            invoice_id=None,
            reference_month=period['reference_month'],
            reference_year=period['reference_year'],
            period_display=f"{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][period['reference_month'] - 1]}/{period['reference_year']}",
            total_amount=0,
            paid_amount=0,
            remaining_amount=0,
            status=InvoiceStatus.OPEN.value,
            due_date=period['due_date'],
            days_until_due=(period['due_date'] - today).days,
            transaction_count=0,
        )

    # Contar transações
    count_result = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.invoice_id == invoice.id
        )
    )
    transaction_count = count_result.scalar() or 0

    days_until_due = (invoice.due_date - today).days if invoice.due_date >= today else 0

    return InvoiceSummary(
        invoice_id=invoice.id,
        reference_month=invoice.reference_month,
        reference_year=invoice.reference_year,
        period_display=invoice.period_display,
        total_amount=float(invoice.total_amount),
        paid_amount=float(invoice.paid_amount),
        remaining_amount=float(invoice.remaining_amount),
        status=invoice.status,
        due_date=invoice.due_date,
        days_until_due=days_until_due,
        transaction_count=transaction_count,
    )


@router.post("/detect-card", response_model=CardDetectionResult)
async def detect_card_from_document(
    document_data: dict,
    current_user: CurrentUser,
    db: DbSession,
):
    """Detecta cartão de crédito baseado nos dados extraídos do documento"""
    service = InvoiceService(db)
    cards = await service.detect_card_from_document(current_user, document_data)

    detected_cards = []
    for card in cards:
        account_result = await db.execute(
            select(Account.name).where(Account.id == card.account_id)
        )
        account_name = account_result.scalar_one_or_none() or "Cartão"

        detected_cards.append(DetectedCardInfo(
            credit_card_id=card.id,
            account_name=account_name,
            last_four_digits=card.last_four_digits,
            match_score=1,  # Simplificado
        ))

    return CardDetectionResult(
        detected_cards=detected_cards,
        suggested_card_id=cards[0].id if cards else None,
    )


class CreateCardFromInvoiceRequest(BaseModel):
    """Dados para criar um cartão a partir de uma fatura"""
    card_issuer: str  # "itau", "nubank", etc.
    card_last_digits: str | None = None  # "8849"
    card_name: str | None = None  # "Itaú Visa Platinum"
    closing_day: int = 1  # Dia do mês de fechamento
    due_day: int = 10  # Dia do mês de vencimento
    credit_limit: float = 0  # Limite do cartão (pode ser 0 se desconhecido)
    color: str | None = None
    icon: str | None = None


class CreateCardFromInvoiceResponse(BaseModel):
    credit_card_id: int
    account_id: int
    account_name: str
    message: str


class ProjectFutureRequest(BaseModel):
    credit_card_id: int
    months_ahead: int = 6
    include_installments: bool = True
    include_recurring: bool = True


class ProjectFutureResponse(BaseModel):
    message: str
    invoices_created: int
    transactions_created: int


# Mapeamento de cores por banco
BANK_COLORS = {
    'itau': '#EC7000',  # Laranja Itaú
    'nubank': '#820AD1',  # Roxo Nubank
    'inter': '#FF7A00',  # Laranja Inter
    'santander': '#EC0000',  # Vermelho Santander
    'bradesco': '#CC092F',  # Vermelho Bradesco
    'bb': '#FFCC00',  # Amarelo BB
    'caixa': '#005CA9',  # Azul Caixa
    'c6': '#1A1A1A',  # Preto C6
    'xp': '#FFD100',  # Amarelo XP
    'btg': '#000000',  # Preto BTG
    'original': '#00A857',  # Verde Original
    'next': '#00E676',  # Verde Next
    'neon': '#00D4AA',  # Verde Neon
    'pagbank': '#00AB4E',  # Verde PagBank
    'picpay': '#21C25E',  # Verde PicPay
    'mercadopago': '#00B1EA',  # Azul MercadoPago
    'digio': '#0052FF',  # Azul Digio
    'ame': '#FF007A',  # Rosa Ame
    'default': '#6366F1',  # Índigo (padrão)
}


@router.post("/create-card-from-invoice", response_model=CreateCardFromInvoiceResponse, status_code=201)
async def create_card_from_invoice(
    data: CreateCardFromInvoiceRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Cria um novo cartão de crédito a partir dos dados extraídos de uma fatura.

    Útil quando o usuário envia uma fatura de um cartão que ainda não está cadastrado.
    O sistema extrai as informações do PDF e usa este endpoint para criar o cartão.
    """
    from ..models.account import Account, AccountType
    from ..models.credit_card import CreditCard
    from decimal import Decimal

    # Gerar nome do cartão se não fornecido
    issuer_names = {
        'itau': 'Itaú',
        'nubank': 'Nubank',
        'inter': 'Inter',
        'santander': 'Santander',
        'bradesco': 'Bradesco',
        'bb': 'Banco do Brasil',
        'caixa': 'Caixa',
        'c6': 'C6 Bank',
        'xp': 'XP',
        'btg': 'BTG Pactual',
        'original': 'Original',
        'next': 'Next',
        'neon': 'Neon',
        'pagbank': 'PagBank',
        'picpay': 'PicPay',
        'mercadopago': 'Mercado Pago',
        'digio': 'Digio',
    }

    issuer_display = issuer_names.get(data.card_issuer.lower(), data.card_issuer.title())

    if data.card_name:
        account_name = data.card_name
    elif data.card_last_digits:
        account_name = f"{issuer_display} *{data.card_last_digits}"
    else:
        account_name = f"{issuer_display} Cartão"

    # Usar cor do banco ou cor fornecida
    color = data.color or BANK_COLORS.get(data.card_issuer.lower(), BANK_COLORS['default'])
    icon = data.icon or "credit-card"

    # Criar conta
    account = Account(
        user_id=current_user.id,
        name=account_name,
        type=AccountType.CREDIT_CARD.value,
        balance=Decimal('0'),
        currency="BRL",
        color=color,
        icon=icon,
        ownership_type="personal",
    )
    db.add(account)
    await db.flush()

    # Criar cartão de crédito
    credit_card = CreditCard(
        account_id=account.id,
        user_id=current_user.id,
        credit_limit=Decimal(str(data.credit_limit)),
        closing_day=data.closing_day,
        due_day=data.due_day,
        last_four_digits=data.card_last_digits,
        is_active=True,
    )
    db.add(credit_card)
    await db.commit()
    await db.refresh(credit_card)

    return CreateCardFromInvoiceResponse(
        credit_card_id=credit_card.id,
        account_id=account.id,
        account_name=account_name,
        message=f"Cartão '{account_name}' criado com sucesso!",
    )


@router.post("/project-future", response_model=ProjectFutureResponse)
async def project_future_transactions(
    data: ProjectFutureRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Projeta transações futuras (parcelas e recorrentes) para faturas futuras.

    Útil para:
    - Visualizar compromissos futuros no cartão
    - Antecipar o valor das próximas faturas
    - Planejar pagamentos

    As transações projetadas são marcadas como is_paid=False e serão
    atualizadas quando o PDF real da fatura for enviado.
    """
    # Buscar cartão de crédito
    card_result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == data.credit_card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    credit_card = card_result.scalar_one_or_none()

    if not credit_card:
        raise HTTPException(status_code=404, detail="Cartão não encontrado")

    total_transactions = 0
    invoices_before = set()
    invoices_after = set()

    # Contar faturas antes
    inv_result = await db.execute(
        select(CreditCardInvoice.id).where(
            CreditCardInvoice.credit_card_id == data.credit_card_id
        )
    )
    invoices_before = set(inv_result.scalars().all())

    service = InvoiceService(db)

    # Projetar recorrentes
    if data.include_recurring:
        recurring_txs = await service.project_recurring_to_invoices(
            user=current_user,
            credit_card=credit_card,
            months_ahead=data.months_ahead,
        )
        total_transactions += len(recurring_txs)

    # Parcelas futuras já são criadas automaticamente quando uma compra parcelada é registrada
    # com create_future_installments=True, mas podemos forçar a atualização aqui
    if data.include_installments:
        from ..services.installment_service import InstallmentService
        from ..models.installment import InstallmentSeries, InstallmentSeriesStatus

        installment_service = InstallmentService(db)

        # Buscar séries ativas do cartão
        series_result = await db.execute(
            select(InstallmentSeries).where(
                InstallmentSeries.user_id == current_user.id,
                InstallmentSeries.credit_card_id == data.credit_card_id,
                InstallmentSeries.status == InstallmentSeriesStatus.ACTIVE,
            )
        )
        series_list = list(series_result.scalars().all())

        for series in series_list:
            # Criar parcelas futuras que ainda não existem
            future_txs = await installment_service.create_future_installments(
                user=current_user,
                series=series,
                from_installment=series.paid_count,
            )
            total_transactions += len(future_txs)

    await db.commit()

    # Contar faturas depois
    inv_result = await db.execute(
        select(CreditCardInvoice.id).where(
            CreditCardInvoice.credit_card_id == data.credit_card_id
        )
    )
    invoices_after = set(inv_result.scalars().all())

    new_invoices = len(invoices_after - invoices_before)

    return ProjectFutureResponse(
        message=f"Projeção concluída: {total_transactions} transações e {new_invoices} faturas criadas",
        invoices_created=new_invoices,
        transactions_created=total_transactions,
    )
