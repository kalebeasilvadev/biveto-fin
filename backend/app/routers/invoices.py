from __future__ import annotations
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, status, Query
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


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Exclui uma fatura"""
    service = InvoiceService(db)
    await service.delete_invoice(current_user, invoice_id)
    await db.commit()


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
