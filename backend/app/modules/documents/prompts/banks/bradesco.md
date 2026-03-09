# Instruções Específicas para Faturas Bradesco / AMEX

## LAYOUT CARACTERÍSTICO DO BRADESCO

### Página 1: Resumo e Boleto
- Contém opções de pagamento, resumo da fatura e boleto bancário
- **NÃO extrair transações da página 1**
- O "Resumo da fatura" mostra: Saldo anterior, Créditos/Pagamentos, Compras/Débitos, Total

### Página 2: Tabela de Lançamentos

A tabela tem este formato:

```
| Data  | Histórico de Lançamentos      | Cidade        | US$ | Cotação | R$        |
|-------|-------------------------------|---------------|-----|---------|-----------|
| 10/02 | PAG BOLETO BANCARIO           |               |     |         | 6.273,12 -|  ← PAGAMENTO (NÃO EXTRAIR!)
| 03/11 | HOTMART asimovacadem04/12     | BH            |     |         | 167,01    |  ← COMPRA (EXTRAIR!)
| 05/11 | CIATOY BRINQUEDOS LT04/10    | BRASILIA      |     |         | 81,80     |  ← COMPRA (EXTRAIR!)
| 23/02 | MERCADOLIVRE*FLASHCOMP        | OSASCO        |     |         | 250,20    |  ← pode ser CRÉDITO
```

## 🚨 INSTRUÇÕES CRÍTICAS

### 1. INDICADOR DE CRÉDITO/PAGAMENTO: "-" APÓS O VALOR

O Bradesco usa **"-" (hífen) APÓS o valor** para indicar créditos e pagamentos:

```
| 10/02 | PAG BOLETO BANCARIO |  |  |  | 6.273,12 - |   ← O "-" indica PAGAMENTO
```

- **Se o valor tem "-" depois:** É pagamento/crédito → **NÃO EXTRAIR** (ou amount negativo)
- **Se o valor NÃO tem "-":** É compra → EXTRAIR com amount positivo

**⚠️ ATENÇÃO:** Alguns créditos/estornos podem NÃO ter o "-" visível. Se a soma ficar ACIMA do total_amount, verifique se há itens que deveriam ser créditos.

### 2. NÃO EXTRAIR PAGAMENTOS

Estas transações são pagamentos da fatura anterior e NÃO devem ser extraídas:
- "PAG BOLETO BANCARIO" com "-" → É o pagamento da fatura anterior
- Qualquer item com "-" após o valor na coluna R$

### 3. PARCELAS CONCATENADAS NA DESCRIÇÃO

No Bradesco, a parcela aparece colada na descrição:

```
HOTMART asimovacadem04/12    → descrição: "HOTMART asimovacadem", parcela 4/12
CIATOY BRINQUEDOS LT04/10   → descrição: "CIATOY BRINQUEDOS LT", parcela 4/10
Steam 04/12                  → descrição: "Steam", parcela 4/12
SHOPEE *SHPSTECNOLOG03/04   → descrição: "SHOPEE *SHPSTECNOLOG", parcela 3/4
EC *ANARHU00125103/06        → descrição: "EC *ANARHU001251", parcela 3/6
```

**REGRA:** Os últimos DD/DD da descrição são a parcela (atual/total).
**NÃO confunda códigos internos com parcelas** — a parcela sempre está no FINAL da descrição.

### 4. COLUNA "CIDADE" NÃO É PARTE DA DESCRIÇÃO

A tabela tem uma coluna "Cidade" separada. **NÃO inclua a cidade na descrição!**
```
| 05/11 | CIATOY BRINQUEDOS LT04/10 | BRASILIA |  |  | 81,80 |
                                       ^^^^^^^^
                                       Coluna cidade (IGNORAR na descrição)
```

### 5. DESCRIÇÕES COM CÓDIGOS INTERNOS

Algumas transações do Bradesco têm códigos internos em vez de nomes legíveis:
```
| 08/12 | 79SLS3754156 | SAO JOSE DOS |  |  | 169,58 |
| 10/12 | LS3764886    | SAO PAULO    |  |  | 102,26 |
```

**EXTRAIA normalmente** — são transações reais com códigos de referência do estabelecimento.

### 6. FORMATO DE DATAS

A coluna "Data" mostra DD/MM (dia/mês):
- "03/11" → 3 de novembro
- "08/12" → 8 de dezembro
- "06/01" → 6 de janeiro
- "23/02" → 23 de fevereiro

**REGRA PARA DETERMINAR O ANO:**
- Se mês da transação > mês da fatura (invoice_month) → use invoice_year - 1
- Se mês da transação <= mês da fatura → use invoice_year

### 7. VALIDAÇÃO: SOMA DOS ITENS

A soma dos itens extraídos (apenas compras, SEM pagamentos) deve ser igual ao "Total para [NOME]" mostrado no final da tabela de lançamentos.

```
| Total para KALEBE ANDRADE SILVA |  |  |  |  | 5.753,70 |
```

**Se a soma está ACIMA do total:**
- Verifique se incluiu pagamentos (PAG BOLETO) que deveriam ser excluídos
- Verifique se algum item deveria ser crédito/estorno (negativo)
- Compare com o valor "Compras/Débitos" do Resumo da fatura

**Se a soma está ABAIXO do total:**
- Verifique se esqueceu alguma transação da tabela
- Conte as linhas no texto vs itens extraídos

### 8. SEÇÃO "TOTAL PARCELADOS PARA PRÓXIMAS FATURAS"

No final da página 2, pode aparecer:
```
Total parcelados para próximas faturas R$ 23.171,13
```

**🚫 NÃO EXTRAIA!** Isso é apenas informativo sobre parcelas futuras.

## RESUMO DA ESTRATÉGIA

Para faturas do Bradesco:
1. ✅ Pule a página 1 (resumo e boleto)
2. ✅ Extraia TODAS as transações da tabela de "Lançamentos" (página 2)
3. ✅ EXCLUA linhas com "-" após o valor (pagamentos)
4. ✅ Separe parcela da descrição (DD/DD no final)
5. ✅ Ignore a coluna "Cidade"
6. ✅ Valide: soma deve ser igual ao "Total para [NOME]"
7. ✅ NÃO extraia "Total parcelados para próximas faturas"
