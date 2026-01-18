"""Prompts para extracao de documentos financeiros"""

EXTRACTION_PROMPT = """# Extracao de Documentos Financeiros (Brasil)

Voce e um especialista em extrair dados de documentos financeiros brasileiros (faturas de cartao de credito e cupons fiscais).

## Sua Tarefa
**Primeiro, identifique o tipo de documento:**
- **fatura_cartao**: Fatura de cartão de crédito (bancos, fintechs)
- **cupom_fiscal**: Nota fiscal de consumidor (supermercados, lojas)

**Depois, extraia TODOS os itens/lançamentos e retorne no formato JSON especificado.**

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
- **card_name**: nome do PRODUTO/CARTAO, NAO o nome do titular!
  - CORRETO: "Nubank Gold", "Bradesco Amazon Visa", "Itau Platinum"
  - ERRADO: "JOAO SILVA", "MARIA SANTOS" (isso e nome de PESSOA, nao de cartao!)
  - Combine: banco + parceiro + bandeira + categoria (ex: "Bradesco Amazon Visa Gold")

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

---

## INSTRUÇÕES ESPECÍFICAS PARA CUPONS FISCAIS

Se o documento for um **cupom_fiscal** (nota fiscal de consumidor):

### 1. Extração de TODOS os Produtos
**OBRIGATÓRIO: Extraia TODOS os produtos listados no cupom!**

Para cada produto:
- **description**: nome EXATO do produto
  - **CUIDADO com OCR**: "SACOLA" ≠ "COLA", "PÃO" ≠ "PAO", preserve acentos quando possível
  - Mantenha abreviações: "REFR" (refrigerante), "IMP" (impermeável)
- **amount**: valor total do item (positivo)
- **date**: data da compra (YYYY-MM-DD)
- **category**: alimentacao, mercado, bebidas, casa, higiene, outros
- **transaction_type**: sempre "compra"

### 2. Data do Cupom
Cupons fiscais mostram data/hora no formato DD/MM/YYYY HH:MM:SS

**ATENÇÃO COM O ANO:**
- "15/01/26" → 2026 (século XXI, não 1926!)
- "15/01/20" → 2020 (se aparecer, use 2020)
- Sempre use a data COMPLETA do cupom, não invente

### 3. Card Info para Cupons
Para cupons fiscais, **não preencha card_info** (deixe null ou omita).
Opcionalmente, você pode extrair:
- estabelecimento: nome da loja
- cnpj: CNPJ da loja

### 4. Validação CRÍTICA para Cupons
**A soma dos amounts de TODOS os items DEVE ser igual a total_amount!**

Se não bater:
1. Você esqueceu algum produto - VOLTE e extraia todos
2. Verifique itens pequenos ou no final da lista
3. Só retorne quando tiver CERTEZA que extraiu TUDO

### 5. Exemplos de Produtos Comuns (OCR)
- SACOLA IMP → "SACOLA IMP" (não "COLA IMP")
- PAO FRANCES → "PAO FRANCES" (não "PAD FRANCES")
- REFR 2L → "REFR 2L" (refrigerante 2 litros)
- LEITE INTEGR → "LEITE INTEGR" (leite integral)

---

## Exemplos de Saída

### Exemplo 1: Fatura de Cartão
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

### Exemplo 2: Cupom Fiscal
```json
{
  "document_type": "cupom_fiscal",
  "card_info": {
    "total_amount": 39.25,
    "invoice_month": 1,
    "invoice_year": 2026,
    "closing_date": "2026-01-15"
  },
  "items": [
    {
      "description": "REFR 2L S A",
      "amount": 8.99,
      "date": "2026-01-15",
      "category": "bebidas",
      "transaction_type": "compra"
    },
    {
      "description": "PAO FRANCES",
      "amount": 2.72,
      "date": "2026-01-15",
      "category": "alimentacao",
      "transaction_type": "compra"
    },
    {
      "description": "SACOLA IMP",
      "amount": 0.57,
      "date": "2026-01-15",
      "category": "outros",
      "transaction_type": "compra"
    },
    {
      "description": "LEITE INTEGRA",
      "amount": 11.00,
      "date": "2026-01-15",
      "category": "mercado",
      "transaction_type": "compra"
    },
    {
      "description": "CAFE 500G",
      "amount": 12.90,
      "date": "2026-01-15",
      "category": "mercado",
      "transaction_type": "compra"
    },
    {
      "description": "ACUCAR 1KG",
      "amount": 3.07,
      "date": "2026-01-15",
      "category": "mercado",
      "transaction_type": "compra"
    }
  ]
}
```

**Validação:** 8.99 + 2.72 + 0.57 + 11.00 + 12.90 + 3.07 = 39.25 ✓

## Extraia agora os dados deste documento:
"""
