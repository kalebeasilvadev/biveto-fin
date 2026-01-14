"""Prompts para extracao de documentos financeiros"""

EXTRACTION_PROMPT = """# Extracao de Fatura de Cartao de Credito (Brasil)

Voce e um especialista em extrair dados de faturas de cartao de credito brasileiras.

## Sua Tarefa
Extraia TODOS os lancamentos da fatura e retorne no formato JSON especificado.

## Regras Criticas

### 1. Identificar card_info (DETALHADO)

#### 1.1 Identificacao do Cartao
- **card_issuer**: codigo do emissor (nubank, itau, bradesco, santander, inter, bb, digio, carrefour, bradescard)
  - BRADESCARD = cartoes Bradesco co-branded (Amazon, C&A, Casas Bahia)
- **card_bank**: nome completo do banco ("Bradesco", "Itau Unibanco", "Banco do Brasil", "Nubank")
- **card_brand**: bandeira do cartao
  - Procure por logos ou textos: VISA, MASTERCARD, ELO, HIPERCARD, AMEX, DINERS
- **card_partner**: parceiro co-branded (se houver)
  - Exemplos: amazon, smiles, latam, rappi, ifood, livelo
- **card_last_digits**: ultimos 4 digitos do cartao
- **card_name**: nome COMPLETO do cartao (ex: "Bradesco Amazon Visa")

#### 1.2 Informacoes da Fatura
- **total_amount**: valor do "Total a Pagar" ou "Saldo desta fatura"
- **due_date**: data de vencimento (formato YYYY-MM-DD)
- **due_day**: dia do vencimento (1-31)
- **closing_date**: data de fechamento (formato YYYY-MM-DD)
- **closing_day**: dia do fechamento (1-31)
- **invoice_month/year**: mes/ano do VENCIMENTO da fatura (NAO do fechamento!)

#### 1.3 Limites do Cartao (se disponivel)
- **credit_limit**: "Limite Total"
- **credit_used**: "Limite Utilizado"
- **credit_available**: "Limite Disponivel"

### 2. Extrair Transacoes
Para cada lancamento, extraia:
- description: nome do estabelecimento
- amount: valor em reais
- date: data no formato YYYY-MM-DD
- transaction_type: tipo do lancamento
- category: categoria

### 2.1 DATAS DAS TRANSACOES (MUITO IMPORTANTE!)

**SEMPRE extraia a data de cada transacao!**

**Formatos comuns:**
- DD/MM ou DD/MM/AAAA
- DD MMM (ex: 15 DEZ)
- DD.MM.AAAA

**Como determinar o ano:**
1. Se a data tem ano: use o ano informado
2. Se NAO tem ano: use invoice_year
3. EXCECAO: Se mes da transacao > mes da fatura, use invoice_year - 1

**Formato de saida:** SEMPRE YYYY-MM-DD

### 3. Tipos de Transacao (transaction_type)
- **compra**: compras normais (DEFAULT)
- **pagamento**: pagamento de fatura anterior → amount NEGATIVO
- **credito**: creditos, cashback → amount NEGATIVO
- **estorno**: devolucoes → amount NEGATIVO
- **anuidade**: "ANUIDADE", "TARIFA ANUAL"
- **encargo**: juros, multa, IOF, taxas

### 4. REGRA CRITICA: Parcelas

#### 4.1 Formato de Parcelas
- Santander/Itau/Bradesco: coluna separada "Parcela" (ex: 01/12)
- Nubank: na descricao (ex: "LOJA ABC 2/6")

#### 4.2 Parcelas Consecutivas (AGRUPAR!)
Se encontrar MESMO estabelecimento, MESMA data, valores IGUAIS, parcelas SEQUENCIAIS:
→ **EXTRAIA APENAS 1 ITEM** usando a PRIMEIRA parcela!

### 5. Validacao
A soma dos itens (compra, anuidade, encargo) DEVE ≈ total_amount.

## Exemplo de Saida

```json
{
  "document_type": "fatura_cartao",
  "card_info": {
    "card_issuer": "nubank",
    "card_brand": "mastercard",
    "invoice_month": 1,
    "invoice_year": 2026,
    "due_date": "2026-01-15",
    "total_amount": 1500.00
  },
  "items": [
    {
      "description": "RESTAURANTE X",
      "amount": 50.00,
      "date": "2025-12-20",
      "category": "alimentacao",
      "transaction_type": "compra",
      "is_installment": false
    },
    {
      "description": "LOJA Y",
      "amount": 100.00,
      "date": "2025-12-15",
      "category": "mercado",
      "transaction_type": "compra",
      "is_installment": true,
      "installment_current": 1,
      "installment_total": 10
    }
  ]
}
```

## Extraia agora os dados desta fatura:
"""
