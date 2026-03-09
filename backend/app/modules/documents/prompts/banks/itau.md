# Instruções Específicas para Faturas Itaú

## LAYOUT CARACTERÍSTICO DO ITAÚ

### Página 1: Boleto e Resumo
- Contém informações gerais e boleto
- **NÃO extrair transações da página 1**

### Página 2: DUAS COLUNAS DE TRANSAÇÕES (CRÍTICO!)

O Itaú usa um layout de **DUAS COLUNAS** lado a lado na página 2.
**AMBAS AS COLUNAS DEVEM SER EXTRAÍDAS!**

#### Estrutura da Página 2:

```
┌───────────────────────────────────┬───────────────────────────────────┐
│ Lançamentos: compras e saques     │ Lançamentos: compras e saques     │
│ KALEBE A SILVA (final 8849)       │                                   │
│ DATA  ESTABELECIMENTO      VALOR  │ DATA  ESTABELECIMENTO      VALOR  │
├───────────────────────────────────┼───────────────────────────────────┤
│ COLUNA ESQUERDA                   │ COLUNA DIREITA                    │
│ (Parcelas de meses anteriores     │ (Compras do mês atual)            │
│  que continuam sendo cobradas)    │                                   │
│                                   │                                   │
│ 09/07 MOTOCHEFE 07/12     574,13  │ 23/01 Wellhub          189,90     │
│ 20/07 PRIME GLOBAL 07/10  148,00  │ 26/01 TESOURA           95,98     │
│ 13/09 FASTSHO 05/12       107,33  │ 26/01 PAPELARIA         36,98     │
│ 26/09 GpPneus 05/08       241,00  │ 09/01 ANUIDADE          56,50     │
│ 08/10 PAYGO 04/06         144,90  │                                   │
│ 15/10 EC *PICHAU 04/06    166,64  │                                   │
│ 15/10 EC *PICHAU 04/06     85,61  │                                   │
│ 16/10 PAG*Steam 04/12     107,51  │                                   │
│ 17/10 PG *MARCELO 04/06    83,35  │                                   │
│ 18/10 PAG*Steam 04/12     161,52  │                                   │
│ 21/10 PAG*Steam 04/12     106,09  │                                   │
│ 01/01 nuuvem 02/06         44,65  │                                   │
│ 01/01 nuuvem 02/06         18,35  │                                   │
│ 01/01 nuuvem *Nuuvem       -0,10  │                                   │
│ 01/01 nuuvem *Nuuvem       -0,20  │                                   │
└───────────────────────────────────┴───────────────────────────────────┘

Lançamentos no cartão (final 8849)                             2.311,64
Lançamentos produtos e serviços                                   56,50
Total dos lançamentos atuais                                   2.368,14
```

## 🚨 INSTRUÇÕES CRÍTICAS PARA EXTRAÇÃO DO ITAÚ

### 1. IDENTIFIQUE AS DUAS COLUNAS

Antes de extrair, identifique visualmente:
- ✅ Há duas colunas lado a lado?
- ✅ Ambas têm o título "Lançamentos: compras e saques"?
- ✅ As datas da esquerda são antigas (07, 09, 10) e da direita são recentes (01, 23, 26)?

**Se SIM para todas:** Você DEVE extrair AMBAS AS COLUNAS!

### 2. PROCESSE COLUNA POR COLUNA

**PASSO 1:** Extraia TODA a coluna ESQUERDA
- Comece em "09/07 MOTOCHEFE..."
- Vá até a última linha antes da seção "Lançamentos produtos e serviços"
- Geralmente tem ~10-15 transações

**PASSO 2:** Extraia TODA a coluna DIREITA
- Comece em "23/01 Wellhub..." (ou primeira transação visível)
- Vá até a última linha
- Geralmente tem ~3-5 transações

### 3. CARACTERÍSTICAS DAS COLUNAS

**Coluna ESQUERDA:**
- Datas: Meses anteriores (07, 08, 09, 10, etc.)
- Descrições: Sempre têm código de parcela (07/12, 05/08, 04/06)
- Valores: Geralmente R$ 100-600
- Total esperado: ~R$ 1.500-1.800
- **São parcelas de compras antigas que CONTINUAM sendo cobradas**

**Coluna DIREITA:**
- Datas: Mês atual da fatura (01, 23, 26, etc.)
- Descrições: Podem ou não ter parcelas
- Valores: Variam
- Total esperado: ~R$ 300-500
- **São compras NOVAS do mês**

### 4. NÃO CONFUNDA COM PRÓXIMA FATURA

Na página 3, há uma seção chamada **"Compras parceladas - próximas faturas"**.
Esta seção mostra parcelas que VÃO VENCER no futuro.

**🚫 NÃO EXTRAIA ESSA SEÇÃO!**

Como diferenciar:
- ✅ Página 2, ANTES do subtotal "Lançamentos no cartão": **EXTRAIR**
- ❌ Página 3, seção "próximas faturas": **NÃO EXTRAIR**

### 5. VALIDAÇÃO ESPECÍFICA DO ITAÚ

Após extrair, valide:
```
Soma esperada dos items: R$ 2.300 a R$ 2.400 (variável por fatura)
Total da fatura (total_amount): R$ 2.368,14

Se diferença > R$ 50:
- Você provavelmente esqueceu a COLUNA ESQUERDA!
- Volte e extraia as transações com datas antigas (07, 08, 09, 10)
```

### 6. FORMATO DAS DESCRIÇÕES DO ITAÚ

O Itaú frequentemente trunca descrições:
- "MOTOCHEFE BRASILIA07/12" (sem espaço antes do código)
- "FASTSHO*CD66D2X*Fa05/12" (sem espaço antes do código)
- "nuuvem *Nuuvem" (pode aparecer como "nuuem *Nuuve m")

**Extraia exatamente como está**, não tente corrigir ou completar.

### 7. CRÉDITOS E ESTORNOS

O Itaú mostra créditos com valor negativo:
- "01/01 nuuvem *Nuuvem - 0,10" → amount: -0.10
- "01/01 nuuvem *Nuuvem - 0,20" → amount: -0.20

**⚠️ NÃO IGNORE valores pequenos!** Mesmo R$ 0,10 deve ser extraído.

### 8. FORMATO DE DATAS DO ITAÚ (CRÍTICO!)

A coluna DATA no Itaú mostra o formato **DD/MM** (dia/mês) da data ORIGINAL da compra.

**⚠️ REGRA OBRIGATÓRIA:**
- O formato é DD/MM onde MM é o MÊS REAL da compra original
- NÃO use o mês da fatura para todas as transações!
- Para parcelas de compras antigas, o mês será ANTERIOR ao mês da fatura

**EXEMPLOS (fatura de fevereiro/2026):**
- "09/07 MOTOCHEFE" → date: "2025-07-09" (julho 2025, NÃO fevereiro 2026!)
- "13/09 FASTSHO" → date: "2025-09-13" (setembro 2025)
- "08/10 PAYGO" → date: "2025-10-08" (outubro 2025)
- "01/01 nuuvem" → date: "2026-01-01" (janeiro 2026)
- "13/02 Karacas" → date: "2026-02-13" (fevereiro 2026)

**REGRA PARA DETERMINAR O ANO:**
- Se o mês da transação > mês da fatura → use invoice_year - 1
- Se o mês da transação <= mês da fatura → use invoice_year

**❌ ERRO COMUM:** Ignorar o mês (MM) e usar o mês da fatura para todas as transações.
Exemplo errado: "09/07 MOTOCHEFE" na fatura de fev/2026 → "2026-02-09" ← ERRADO!
Exemplo correto: "09/07 MOTOCHEFE" na fatura de fev/2026 → "2025-07-09" ← CORRETO!

## RESUMO DA ESTRATÉGIA

Para faturas do Itaú:
1. ✅ Identifique as DUAS colunas na página 2
2. ✅ Processe coluna ESQUERDA (parcelas antigas)
3. ✅ Processe coluna DIREITA (compras novas)
4. ✅ Use a data DD/MM REAL de cada transação (NÃO substitua o mês!)
5. ✅ Valide: soma deve estar próxima do total_amount
6. ✅ Se diferença > R$ 50: procure transações que você esqueceu
