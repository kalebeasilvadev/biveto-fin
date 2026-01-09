# Esquema do Banco de Dados - Biveto App

## Diagrama ER (Mermaid)

```mermaid
erDiagram
    %% ============================================
    %% CORE: Usuarios e Licencas
    %% ============================================

    USERS {
        int id PK
        int license_id FK
        string email UK
        string hashed_password
        string name
        bool is_active
        bool is_verified
        bool is_admin
        datetime created_at
    }

    LICENSES {
        int id PK
        int owner_user_id FK
        string key UK
        string code UK
        string type
        string status
        int max_users
        datetime start_date
        datetime end_date
    }

    HOUSEHOLD_MEMBERS {
        int id PK
        int license_id FK
        int user_id FK
        int invited_by_id FK
        string role
        bool can_create_transactions
        bool can_edit_shared
    }

    %% ============================================
    %% FINANCEIRO: Contas e Cartoes
    %% ============================================

    ACCOUNTS {
        int id PK
        int user_id FK
        string name
        string type
        decimal balance
        string currency
        string ownership_type
        bool is_active
    }

    CREDIT_CARDS {
        int id PK
        int account_id FK "UNIQUE"
        int user_id FK
        decimal credit_limit
        int closing_day
        int due_day
        string card_brand
        string last_four_digits
        bool is_active
    }

    CREDIT_CARD_INVOICES {
        int id PK
        int user_id FK
        int credit_card_id FK
        int document_id FK
        int payment_account_id FK
        int payment_transaction_id FK
        int reference_month
        int reference_year
        date closing_date
        date due_date
        decimal total_amount
        decimal paid_amount
        string status
    }

    %% ============================================
    %% TRANSACOES
    %% ============================================

    TRANSACTIONS {
        int id PK
        int user_id FK
        int account_id FK
        int category_id FK
        int merchant_id FK
        int document_id FK
        int credit_card_id FK
        int invoice_id FK
        int income_source_id FK
        int installment_series_id FK
        int recurring_id FK
        string type
        decimal amount
        date date
        string description
        int installment_number
        int installment_total
        bool is_paid
        bool is_fixed
    }

    INSTALLMENT_SERIES {
        int id PK
        int user_id FK
        int account_id FK
        int category_id FK
        int merchant_id FK
        int credit_card_id FK
        string description
        string merchant_name
        decimal total_amount
        decimal installment_amount
        int installment_count
        date first_installment_date
        string status
        int paid_count
    }

    %% ============================================
    %% CATEGORIAS E MERCHANTS
    %% ============================================

    CATEGORIES {
        int id PK
        int parent_id FK
        int user_id FK
        string name
        string type
        string icon
        bool is_system
    }

    MERCHANTS {
        int id PK
        string name
        string normalized_name UK
        string cnpj
    }

    %% ============================================
    %% DOCUMENTOS
    %% ============================================

    DOCUMENTS {
        int id PK
        int user_id FK
        string file_path
        string file_hash
        string original_filename
        string status
        string document_type
        datetime processed_at
    }

    DOCUMENT_EXTRACTIONS {
        int id PK
        int document_id FK
        int version
        decimal amount
        date date
        string merchant_name
        json items
    }

    %% ============================================
    %% FONTES DE RENDA
    %% ============================================

    INCOME_SOURCES {
        int id PK
        int user_id FK
        int account_id FK
        int category_id FK
        string name
        string type
        decimal expected_amount
        string frequency
        int payment_day
        bool is_active
    }

    %% ============================================
    %% ORCAMENTOS
    %% ============================================

    BUDGETS {
        int id PK
        int user_id FK
        int year
        int month
        decimal total_income_planned
        decimal total_expense_planned
    }

    BUDGET_ITEMS {
        int id PK
        int budget_id FK
        int category_id FK
        decimal planned_amount
        bool is_fixed
        int priority
    }

    %% ============================================
    %% METAS
    %% ============================================

    GOALS {
        int id PK
        int user_id FK
        int account_id FK
        string name
        string type
        decimal target_amount
        decimal current_amount
        date target_date
        string status
    }

    GOAL_CONTRIBUTIONS {
        int id PK
        int goal_id FK
        int transaction_id FK
        decimal amount
        date contribution_date
    }

    %% ============================================
    %% DIVIDAS
    %% ============================================

    DEBTS {
        int id PK
        int user_id FK
        int account_id FK
        int installment_series_id FK
        string name
        string type
        string creditor
        decimal original_amount
        decimal current_balance
        decimal interest_rate
        string status
    }

    DEBT_PAYMENTS {
        int id PK
        int debt_id FK
        int transaction_id FK
        decimal amount
        decimal principal_amount
        decimal interest_amount
        date payment_date
    }

    %% ============================================
    %% RECORRENCIAS
    %% ============================================

    RECURRING_TRANSACTIONS {
        int id PK
        int user_id FK
        int account_id FK
        int category_id FK
        string name
        decimal amount
        string type
        string frequency
        int day_of_month
        string status
    }

    %% ============================================
    %% RELACIONAMENTOS
    %% ============================================

    %% Core
    LICENSES ||--o{ USERS : "possui"
    LICENSES ||--o{ HOUSEHOLD_MEMBERS : "agrupa"
    USERS ||--o{ HOUSEHOLD_MEMBERS : "participa"

    %% Contas e Cartoes
    USERS ||--o{ ACCOUNTS : "possui"
    ACCOUNTS ||--o| CREDIT_CARDS : "detalha"
    USERS ||--o{ CREDIT_CARDS : "possui"
    CREDIT_CARDS ||--o{ CREDIT_CARD_INVOICES : "gera"

    %% Transacoes
    USERS ||--o{ TRANSACTIONS : "realiza"
    ACCOUNTS ||--o{ TRANSACTIONS : "movimenta"
    CATEGORIES ||--o{ TRANSACTIONS : "classifica"
    MERCHANTS ||--o{ TRANSACTIONS : "identifica"
    DOCUMENTS ||--o{ TRANSACTIONS : "comprova"
    CREDIT_CARDS ||--o{ TRANSACTIONS : "debita"
    CREDIT_CARD_INVOICES ||--o{ TRANSACTIONS : "agrupa"
    INCOME_SOURCES ||--o{ TRANSACTIONS : "origina"
    INSTALLMENT_SERIES ||--o{ TRANSACTIONS : "parcela"
    RECURRING_TRANSACTIONS ||--o{ TRANSACTIONS : "gera"

    %% Parcelas
    USERS ||--o{ INSTALLMENT_SERIES : "possui"
    ACCOUNTS ||--o{ INSTALLMENT_SERIES : "vincula"
    CREDIT_CARDS ||--o{ INSTALLMENT_SERIES : "financia"

    %% Documentos
    USERS ||--o{ DOCUMENTS : "envia"
    DOCUMENTS ||--o{ DOCUMENT_EXTRACTIONS : "extrai"
    DOCUMENTS ||--o| CREDIT_CARD_INVOICES : "comprova"

    %% Categorias (hierarquia)
    CATEGORIES ||--o{ CATEGORIES : "subcategoria"
    USERS ||--o{ CATEGORIES : "personaliza"

    %% Fontes de Renda
    USERS ||--o{ INCOME_SOURCES : "cadastra"
    ACCOUNTS ||--o{ INCOME_SOURCES : "recebe"
    CATEGORIES ||--o{ INCOME_SOURCES : "classifica"

    %% Orcamentos
    USERS ||--o{ BUDGETS : "planeja"
    BUDGETS ||--o{ BUDGET_ITEMS : "detalha"
    CATEGORIES ||--o{ BUDGET_ITEMS : "categoriza"

    %% Metas
    USERS ||--o{ GOALS : "define"
    ACCOUNTS ||--o{ GOALS : "vincula"
    GOALS ||--o{ GOAL_CONTRIBUTIONS : "recebe"

    %% Dividas
    USERS ||--o{ DEBTS : "possui"
    DEBTS ||--o{ DEBT_PAYMENTS : "paga"
    INSTALLMENT_SERIES ||--o{ DEBTS : "origina"

    %% Recorrencias
    USERS ||--o{ RECURRING_TRANSACTIONS : "configura"
    ACCOUNTS ||--o{ RECURRING_TRANSACTIONS : "movimenta"
    CATEGORIES ||--o{ RECURRING_TRANSACTIONS : "classifica"
```

---

## Fluxo Principal: Cartao de Credito

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE CARTAO DE CREDITO                              │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐      1:1       ┌─────────────┐
  │ ACCOUNTS │───────────────►│ CREDIT_CARDS │
  │          │                │              │
  │ type=    │                │ credit_limit │
  │ "credit_ │                │ closing_day  │
  │  card"   │                │ due_day      │
  └──────────┘                └──────┬───────┘
                                     │
                                     │ 1:N
                                     ▼
                        ┌────────────────────────┐
                        │ CREDIT_CARD_INVOICES   │
                        │                        │
                        │ reference_month/year   │
                        │ closing_date           │
                        │ due_date               │
                        │ total_amount           │◄──── Calculado das
                        │ status (open/closed/   │      transacoes
                        │         paid/overdue)  │
                        └───────────┬────────────┘
                                    │
                                    │ 1:N
                                    ▼
                          ┌─────────────────┐
                          │  TRANSACTIONS   │
                          │                 │
                          │ credit_card_id  │──────► Qual cartao
                          │ invoice_id      │──────► Qual fatura
                          │ amount          │
                          │ date            │
                          └─────────────────┘
```

---

## Fluxo de Parcelas (Installments)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE PARCELAMENTO                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

   Compra parcelada: R$ 1.200 em 12x de R$ 100

   ┌──────────────────────────────────────────┐
   │         INSTALLMENT_SERIES               │
   │                                          │
   │  description: "Loja X"                   │
   │  merchant_name: "Loja X"                 │
   │  total_amount: 1200.00                   │
   │  installment_amount: 100.00              │
   │  installment_count: 12                   │
   │  credit_card_id: 5  ◄───────────────────────── Vinculo com cartao
   │  first_installment_date: 2025-01-15     │
   │  status: "active"                        │
   │  paid_count: 3                           │
   └────────────────────┬─────────────────────┘
                        │
                        │ 1:N (gera 12 transacoes)
                        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                        TRANSACTIONS                                 │
   ├─────────────────────────────────────────────────────────────────────┤
   │  ID │ installment_number │ date       │ amount │ invoice_id         │
   ├─────────────────────────────────────────────────────────────────────┤
   │  1  │        1/12        │ 2025-01-15 │ 100.00 │     1 (Jan/2025)   │
   │  2  │        2/12        │ 2025-02-15 │ 100.00 │     2 (Fev/2025)   │
   │  3  │        3/12        │ 2025-03-15 │ 100.00 │     3 (Mar/2025)   │
   │ ... │        ...         │    ...     │  ...   │        ...         │
   │ 12  │       12/12        │ 2025-12-15 │ 100.00 │    12 (Dez/2025)   │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## Calculo de Saldos

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CALCULO DE SALDOS                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

  CONTA BANCARIA (bank/wallet):
  ┌────────────────────────────────────────────────────────────────┐
  │  Saldo = account.balance + SUM(transactions)                   │
  │                                                                │
  │  Onde: income = +amount                                        │
  │        expense = -amount                                       │
  └────────────────────────────────────────────────────────────────┘

  CARTAO DE CREDITO:
  ┌────────────────────────────────────────────────────────────────┐
  │  Limite Usado = SUM(transactions WHERE credit_card_id = X)     │
  │                                                                │
  │  Limite Disponivel = credit_card.credit_limit - Limite Usado   │
  │                                                                │
  │  Total da Fatura = SUM(transactions WHERE invoice_id = Y)      │
  └────────────────────────────────────────────────────────────────┘
```

---

## Relacionamentos Principais

### Hierarquia de Usuarios
```
LICENSE (Plano)
    │
    └── USERS (Usuarios do plano)
            │
            └── HOUSEHOLD_MEMBERS (Membros da familia)
```

### Hierarquia Financeira
```
USER
 ├── ACCOUNTS (Contas)
 │       ├── TRANSACTIONS (Movimentacoes)
 │       ├── CREDIT_CARDS (Detalhes de cartao)
 │       │       └── CREDIT_CARD_INVOICES (Faturas)
 │       │               └── TRANSACTIONS (Lancamentos da fatura)
 │       └── INSTALLMENT_SERIES (Series de parcelas)
 │               └── TRANSACTIONS (Parcelas)
 │
 ├── CATEGORIES (Categorias)
 │       └── CATEGORIES (Subcategorias)
 │
 ├── DOCUMENTS (Documentos/PDFs)
 │       └── DOCUMENT_EXTRACTIONS (Dados extraidos)
 │
 ├── INCOME_SOURCES (Fontes de renda)
 │       └── TRANSACTIONS (Recebimentos)
 │
 ├── BUDGETS (Orcamentos)
 │       └── BUDGET_ITEMS (Itens do orcamento)
 │
 ├── GOALS (Metas)
 │       └── GOAL_CONTRIBUTIONS (Aportes)
 │
 ├── DEBTS (Dividas)
 │       └── DEBT_PAYMENTS (Pagamentos)
 │
 └── RECURRING_TRANSACTIONS (Recorrencias)
         └── TRANSACTIONS (Transacoes geradas)
```

---

## Tipos e Status

### Account.type
- `wallet` - Carteira fisica
- `bank` - Conta bancaria
- `credit_card` - Cartao de credito
- `investment` - Investimento

### Transaction.type
- `income` - Receita
- `expense` - Despesa

### InvoiceStatus
- `open` - Aberta (acumulando)
- `closed` - Fechada (aguardando pagamento)
- `paid` - Paga
- `partial` - Parcialmente paga
- `overdue` - Vencida

### InstallmentSeriesStatus
- `active` - Em andamento
- `completed` - Todas pagas
- `cancelled` - Cancelada

### ownership_type
- `personal` - Pessoal
- `household` - Compartilhada (familia)
