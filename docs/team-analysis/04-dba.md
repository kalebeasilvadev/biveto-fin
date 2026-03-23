# 🗄️ DBA — Análise Crítica

**Data:** 2026-03-23
**Escopo:** Schema de 31 models, integridade referencial, índices, performance de queries, decisões de modelagem

---

## O que está bom

### 1. Modelagem relacional sólida no core
User → Account → Transaction → Category é bem modelado. Foreign keys com `ondelete` correto na maioria dos casos. Cascade delete no User limpa tudo.

### 2. SQLAlchemy 2.0 com Mapped types
Uso moderno do ORM com `Mapped[type]` em vez do antigo `Column()`. Type safety em compile time. Relações bem definidas com `back_populates`.

### 3. Alembic com 35 migrations
Histórico de evolução do schema versionado. Migrations recentes mostram projeto ativo (automation, envelopes, invoice password).

### 4. Dual database support
SQLite para dev, PostgreSQL para prod. Configuração adaptativa de pool (no pool para SQLite, pool_size=5 para PG). Pragmático.

### 5. Ownership model para household
`ownership_type` (personal/household) em Transaction permite compartilhamento familiar sem duplicação de dados. Design elegante.

---

## O que está desconexo

### P0 — Índices compostos removidos sem justificativa

**Evidência:** Migration `ba9ea6b64409` removeu:
- `ix_invoices_user_status` (CreditCardInvoice)
- `ix_invoices_user_period` (CreditCardInvoice)
- `ix_invoices_card_period` (CreditCardInvoice)
- Índices de `parent_id` e `user_id` em Category

**Impacto:** Queries mais comuns do sistema agora fazem full table scan:
- Listar faturas do usuário por status → sem index
- Buscar fatura por cartão/mês/ano → sem index
- Filtrar categorias por usuário → sem index
- Navegar categorias hierárquicas → sem index

Para 100.000 faturas, a diferença é: index seek (0.1ms) vs full scan (50-200ms).

**Ganho ao resolver:** Performance de queries de fatura e categoria volta ao normal. Queries 100-2000x mais rápidas nesses casos.

---

### P0 — DocumentExtraction.suggested_category_id sem FK

**Evidência:** `models/document.py:84`:
```python
suggested_category_id: Mapped[int | None] = mapped_column()
```

Sem `ForeignKey("categories.id")`. Sem index. Sem constraint de integridade.

**Impacto:**
- Pode referenciar categorias que não existem
- Não cascadeia quando categoria é deletada
- Não tem index para lookup

**Ganho ao resolver:** Integridade referencial. Queries indexadas. Cascade correto.

---

### P0 — Transaction model com 21 FKs é over-engineered

**Evidência:** `models/transaction.py` (12.452 bytes) tem foreign keys para:
user_id, account_id, category_id, merchant_id, document_id, credit_card_id, income_source_id, invoice_id, receipt_id, recurring_id, linked_transaction_id, installment_series_id, source_transaction_id, recurrence_parent_id + mais nas relationships

**Impacto:**
- INSERT de transação precisa validar 14+ FKs
- Qualquer migration que toca Transaction pode quebrar tudo
- Muitos desses FKs são `nullable` — nem toda transação é parcelada, de cartão, recorrente, etc.
- Auto-referência tripla (linked_transaction_id, source_transaction_id, recurrence_parent_id)

**Ganho ao resolver:** Separar em Transaction base + TransactionMetadata (JSON ou tabela separada para FKs opcionais). INSERT mais rápido, schema mais limpo.

**Referência cruzada:** O [Arquiteto](./01-arquiteto.md) também identificou isso como debt técnico significativo.

---

### P1 — ChatConversation usa String UUID como PK

**Evidência:** `models/chat.py:19`:
```python
id = Column(String(36), primary_key=True)  # UUID
```

Todos os outros 30 models usam `Mapped[int]` autoincrement. Chat usa String UUID.

**Impacto:**
- JOINs entre Chat e User são string-to-int (implicit cast)
- Usa `Column()` legacy em vez de `Mapped[]` (inconsistência de estilo)
- String PK ocupa mais espaço que INT
- Index B-tree em string é mais lento que em int

**Ganho ao resolver:** Consistência. Performance de JOIN melhor. Pode manter UUID como campo unique separado se necessário para API.

---

### P1 — Dependência circular CreditCardInvoice ↔ Transaction

**Evidência:** `models/credit_card_invoice.py`:
```python
payment_transaction_id = mapped_column(ForeignKey("transactions.id", ondelete="SET NULL"))
payment_transaction = relationship("Transaction", post_update=True)  # Workaround!
```

- Invoice tem FK para Transaction (pagamento)
- Transaction tem FK para Invoice (lançamento)
- `post_update=True` é um workaround do SQLAlchemy para dependência circular

**Impacto:**
- INSERT e UPDATE precisam de 2 passes (post_update faz UPDATE separado)
- Dificulta testes (precisa criar ambos antes de linkar)
- Qualquer ORM alternativo no futuro não teria esse escape hatch

**Ganho ao resolver:** Extrair para tabela intermediária `invoice_payments` (invoice_id, transaction_id). Elimina ciclo. Suporta pagamentos parciais naturalmente.

---

### P1 — FKs sem index

| Model | Coluna | Index? |
|---|---|---|
| IncomeSource | category_id | Não |
| InstallmentSeries | category_id | Não |
| UserMerchantRule | category_id | Não |
| Merchant | category_id | Não (nem é FK!) |
| Transaction | credit_card_id | Não |
| Transaction | recurring_id | Não |

**Impacto:** JOINs e WHERE nessas colunas fazem sequential scan. Performance degrada com volume.

**Ganho ao resolver:** Queries 10-100x mais rápidas nessas colunas.

---

### P1 — Merchant.category_id é int puro, não FK

**Evidência:** `models/merchant.py:14`:
```python
category_id: Mapped[int | None] = mapped_column()
```

Sem `ForeignKey("categories.id")`. É apenas um integer que *deveria* referenciar categorias.

**Impacto:** Pode apontar para categoria inexistente. Não cascadeia. Sem integridade.

**Ganho ao resolver:** Integridade referencial garantida pelo banco.

---

### P2 — Models exportados incompletamente

**Evidência:** `models/__init__.py` não exporta:
- BudgetItemHistory
- PointsTransaction
- StreakHistory

**Impacto:** Devs podem não saber que esses models existem. Import direto do subpacote funciona mas é inconsistente.

**Ganho ao resolver:** Discoverability. `from app.models import *` traz tudo.

---

### P2 — BenefitCard ↔ IncomeSource com dados duplicados

**Evidência:**
- `IncomeSource` tem: `benefit_card_number`, `benefit_provider` (campos diretos)
- `BenefitCard` tem: `linked_income_source_id` (FK reverso)

Dois caminhos para a mesma informação.

**Impacto:** Qual é a fonte de verdade? Se atualizar em um, o outro fica desatualizado.

**Ganho ao resolver:** Eliminar campos redundantes em IncomeSource. Usar apenas o FK em BenefitCard.

---

### P2 — Raw SQL no startup (main.py)

**Evidência:** `main.py` tem 6 queries `text()` para migrar transações de cartão para faturas:
```python
result = await session.execute(text("""
    SELECT id, credit_card_id, date, amount
    FROM transactions
    WHERE credit_card_id IS NOT NULL AND invoice_id IS NULL
"""))
```

**Impacto:** Não tem type safety, não reflete mudanças no schema, pode falhar silenciosamente.

**Ganho ao resolver:** Migrar para ORM queries. Type safe, testável, refatorável.

---

### P2 — TransactionAudit nunca é populado

**Evidência:** Model `TransactionAudit` existe com campos `field_name`, `old_value`, `new_value`, mas grep no codebase não mostra nenhum INSERT nessa tabela.

**Impacto:** Tabela existe no schema mas nunca recebe dados. Overhead de migration e manutenção sem benefício.

**Ganho ao resolver:** Ou implementar auditoria de verdade, ou remover o model e a tabela.

---

### P3 — GoalContribution raramente usado

**Evidência:** Model existe, mas a maioria do código trabalha com `Goal.current_amount` diretamente.

**Impacto:** Contribuições individuais não são rastreadas na prática. O model existe mas o workflow não passa por ele.

**Ganho ao resolver:** Integrar GoalContribution no workflow de metas ou simplificar para incremento direto.

---

## Recomendações

### Curto prazo (1-2 sprints)

1. **Restaurar índices compostos** removidos na migration ba9ea6b64409 — especialmente em CreditCardInvoice e Category
2. **Adicionar FK em DocumentExtraction.suggested_category_id** e Merchant.category_id
3. **Adicionar index** em todas as FKs listadas acima
4. **Migrar ChatConversation** para INT PK com UUID como campo unique separado

### Médio prazo (3-4 sprints)

5. **Criar tabela `invoice_payments`** para resolver ciclo CreditCardInvoice ↔ Transaction
6. **Remover campos duplicados** de IncomeSource (benefit_card_number, benefit_provider)
7. **Migrar raw SQL do main.py** para ORM queries
8. **Decidir sobre TransactionAudit** — implementar ou remover
9. **Exportar todos os models** no `__init__.py`

### Longo prazo

10. **Avaliar decomposição de Transaction** — tabela muito larga, muitas FKs nullable. Considerar Transaction + TransactionContext (FKs opcionais)
11. **Adicionar particionamento por mês** em Transaction quando volume justificar
