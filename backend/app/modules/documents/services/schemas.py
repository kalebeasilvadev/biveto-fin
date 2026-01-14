"""Schemas Pydantic para extracao de faturas"""
from typing import Optional
from pydantic import BaseModel, Field


class FutureInstallment(BaseModel):
    """Parcela futura de um parcelamento."""
    installment: int = Field(description="Numero da parcela futura")
    reference_month: int = Field(description="Mes de referencia (1-12)")
    reference_year: int = Field(description="Ano de referencia")


class FaturaItem(BaseModel):
    """Item/transacao de uma fatura."""
    description: str = Field(description="Nome do estabelecimento ou descricao da transacao")
    amount: float = Field(description="Valor em reais. NEGATIVO para pagamentos, creditos e estornos")
    date: Optional[str] = Field(default=None, description="Data da transacao no formato YYYY-MM-DD")
    category: str = Field(
        description="Categoria: alimentacao, transporte, mercado, lazer, saude, moradia, "
                    "roupas, eletronicos, assinaturas, taxas, pagamento, credito, estorno, "
                    "saldo_anterior, outros"
    )
    transaction_type: str = Field(
        description="Tipo: compra (default), estorno, anuidade, pagamento, credito, encargo, saldo_anterior"
    )
    is_installment: bool = Field(default=False, description="Se e parcelado")
    installment_current: Optional[int] = Field(default=None, description="Parcela atual (ex: 3 de 3/12)")
    installment_total: Optional[int] = Field(default=None, description="Total de parcelas (ex: 12 de 3/12)")
    future_installments: Optional[list[FutureInstallment]] = Field(
        default=None,
        description="Parcelas futuras restantes. Apenas se is_installment=true"
    )


class CardInfo(BaseModel):
    """Informacoes do cartao de credito."""
    card_issuer: str = Field(description="Emissor/banco: nubank, itau, bradesco, santander, inter, bb, digio, carrefour, bradescard")
    card_bank: Optional[str] = Field(default=None, description="Banco emissor completo")
    card_brand: Optional[str] = Field(default=None, description="Bandeira: visa, mastercard, elo, hipercard, amex, diners")
    card_partner: Optional[str] = Field(default=None, description="Parceiro co-branded: amazon, smiles, latam, rappi, ifood, livelo")
    card_last_digits: Optional[str] = Field(default=None, description="Ultimos 4 digitos do cartao")
    card_name: Optional[str] = Field(default=None, description="Nome completo do cartao")

    invoice_month: int = Field(description="Mes do VENCIMENTO da fatura (1-12)")
    invoice_year: int = Field(description="Ano do VENCIMENTO da fatura")
    closing_date: Optional[str] = Field(default=None, description="Data de fechamento YYYY-MM-DD")
    closing_day: Optional[int] = Field(default=None, description="Dia do fechamento (1-31)")
    due_date: str = Field(description="Data de vencimento YYYY-MM-DD")
    due_day: Optional[int] = Field(default=None, description="Dia do vencimento (1-31)")
    total_amount: float = Field(description="Valor TOTAL A PAGAR desta fatura")

    credit_limit: Optional[float] = Field(default=None, description="Limite total do cartao")
    credit_used: Optional[float] = Field(default=None, description="Limite utilizado/comprometido")
    credit_available: Optional[float] = Field(default=None, description="Limite disponivel")


class FaturaExtracao(BaseModel):
    """Resultado da extracao de uma fatura de cartao."""
    document_type: str = Field(
        description="Tipo: fatura_cartao, cupom_fiscal, comprovante, extrato"
    )
    card_info: Optional[CardInfo] = Field(
        default=None,
        description="Informacoes do cartao. OBRIGATORIO se document_type=fatura_cartao"
    )
    items: list[FaturaItem] = Field(
        description="Lista de transacoes/itens extraidos"
    )
