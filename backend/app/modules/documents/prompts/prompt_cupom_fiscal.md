# Extração de Cupom Fiscal

Extraia TODOS os itens do cupom fiscal e retorne JSON:

```json
{
  "document_type": "cupom_fiscal",
  "merchant_info": {"name": "Loja", "cnpj": "00.000.000/0000-00"},
  "items": [
    {
      "description": "PRODUTO",
      "amount": 15.90,
      "quantity": 1.0,
      "unit_price": 15.90,
      "unit": "UN",
      "date": "YYYY-MM-DD",
      "transaction_type": "compra",
      "category": "mercado"
    }
  ],
  "payment_info": {
    "total": 100.00,
    "subtotal": 100.00,
    "discount": 0.0,
    "payments": [{"method": "CARTAO DEBITO", "amount": 100.00}]
  }
}
```

## REGRAS CRÍTICAS

1. **TODOS OS ITENS** - Se tem 100 itens, retorne 100. NUNCA pule itens.
2. **VALOR FINAL** - Use sempre o ÚLTIMO valor da linha (valor total, não unitário)
3. **SOMA = TOTAL** - A soma dos items DEVE bater com o total do cupom

## Campos items
- description: Nome completo do produto
- amount: Valor TOTAL (quantidade × preço unitário) - POSITIVO
- quantity: Se não visível, assume 1.0
- unit_price: Se não visível, igual ao amount
- unit: UN, KG, LT, PC, CX
- date: Data da compra YYYY-MM-DD

## NÃO extrair como items
- SUBTOTAL, TOTAL, DESCONTO
- Cabeçalhos de tabela
- Tributos, chave de acesso
- Formas de pagamento (vão em payment_info)

## Texto duplicado
Se o mesmo item aparecer 2x no OCR (sobreposição de páginas), extraia apenas 1x.
MAS se são itens diferentes com número sequencial diferente, extraia todos.

## VALIDAÇÃO
Antes de retornar, confirme: soma dos amounts = total. Se não bater, revise.
