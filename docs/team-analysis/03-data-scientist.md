# 📈 Data Scientist — Análise Crítica

**Data:** 2026-03-23
**Escopo:** Analytics, agregação de dados, eficiência de queries, insights financeiros, gamificação como sistema de dados

---

## O que está bom

### 1. Insights financeiros reais e acionáveis
O módulo de analytics gera insights concretos:
- **Leak detection** — identifica gastos pequenos e frequentes que acumulam (≥3 transações, ≥5% do total)
- **Driver identification** — top categorias >20% dos gastos
- **Opportunity detection** — despesas fixas com potencial de redução
- Isso é análise financeira real, não apenas gráficos.

### 2. Weekly Review é bem desenhado
O review semanal agrega: resumo da semana, comparativo com semana anterior, progresso de budget, progresso de metas, transações sem categoria, itens futuros próximos. É um "financial health check" completo.

### 3. Contexto do chat é extraordinariamente rico
19 pontos de dados reais para o assistente IA: contas, transações por categoria, por merchant, receitas, dívidas, cartões, budget, parcelas ativas, recorrentes, projeções, benefit cards, score de saúde financeira. Poucos apps financeiros oferecem isso para um chatbot.

### 4. Detecção de recorrentes funcional
O `RecurringDetectorService` cruza transações extraídas com base de serviços conhecidos (Netflix, Spotify, etc.) e com recorrentes existentes do usuário.

---

## O que está desconexo

### P0 — Agregação in-memory para datasets grandes

**Evidência:** `analytics_service.py`:
```python
# Busca TODAS as transações do mês
transactions = await self._get_transactions_fast(user_ids, ...)

# Depois agrupa em Python
by_category = defaultdict(list)
for t in transactions:
    by_category[t.category_id].append(t)
```

**Impacto:** Para um usuário com 2.000 transações/mês (comum com cartão de crédito + conta), carrega 2.000 objetos ORM na memória, depois faz loops Python para somar, agrupar, calcular percentuais.

Com SQL `GROUP BY` + `SUM()`, o banco retorna 15-20 linhas agregadas. Diferença: ~100x menos memória, ~10x mais rápido.

**Ganho ao resolver:** Performance dramaticamente melhor. Suporta usuários com alto volume de transações sem degradação.

---

### P0 — Queries N+1 no alert engine (budget check)

**Evidência:** `alert_engine.py`:
```python
for item in budget_items:  # 12 categorias típicas
    spending_query = select(func.sum(Transaction.amount)).where(
        Transaction.category_id == item.category_id,
        ...
    )
    spent = await self.db.execute(spending_query)
```

**Impacto:** 1 query por categoria de budget. Usuário com 12 categorias = 12 queries. Roda a cada 6 horas. Com 1.000 usuários = 12.000 queries a cada 6 horas só para budget.

**Solução:**
```sql
SELECT category_id, SUM(amount)
FROM transactions
WHERE user_id = ? AND type = 'expense' AND EXTRACT(month FROM date) = ?
GROUP BY category_id
```
1 query retorna tudo.

**Ganho ao resolver:** 12x menos queries no budget check. ~48.000 queries/dia economizadas para 1.000 usuários.

---

### P1 — Analytics e Review reimplementam a mesma lógica

**Evidência:**
- `analytics_service.py` calcula: total income, total expenses, por categoria, por merchant, variação mês a mês
- `review_service.py` calcula: total income, total expenses, por categoria, variação semana a semana
- `financial_agent_service.py` calcula: total income, total expenses, por categoria, por merchant

Três módulos diferentes fazendo queries similares com lógicas sutilmente diferentes.

**Impacto:** Resultados podem divergir. "Total de gastos" no Dashboard pode diferir do Weekly Review pode diferir do Chat. Manutenção triplicada.

**Ganho ao resolver:** Uma única `FinancialAggregationService` que todos os módulos consomem. Números consistentes em toda a aplicação.

**Referência cruzada:** O [AI Specialist](./02-ai-specialist.md) recomenda extrair `FinancialContextService` do chat. Devem ser o mesmo serviço.

---

### P1 — Invoice payment deduplication em Python

**Evidência:** `analytics_service.py`:
```python
payment_transaction_ids = await self._get_invoice_payment_ids_fast(user_ids)
# ... depois filtra em Python:
debit_cash_expenses = sum(
    t.amount for t in transactions
    if t.id not in payment_transaction_ids  # O(n) lookup em list!
)
```

**Impacto:** Busca IDs de pagamento de fatura em query separada, depois faz `not in` em Python (O(n) por transação). Deveria ser um `LEFT JOIN` ou subquery no SQL.

**Ganho ao resolver:** Elimina 1 query + 1 loop Python por request de analytics.

---

### P1 — Gamification calcula badges re-buscando TODAS as transações

**Evidência:** `gamification_service.py`:
```python
async def _calculate_progress(self, user, definition):
    if criteria_type == "transaction_count":
        result = await self.db.execute(
            select(func.count(Transaction.id)).where(Transaction.user_id == user.id)
        )
```

**Impacto:** Conta TODAS as transações do usuário (desde a criação da conta) toda vez que a lista de badges é requisitada. Para um usuário com 10.000 transações = full table count a cada page load.

**Solução:** Manter um counter incremental em `UserPoints` ou `User` que é incrementado quando transação é criada, em vez de recontagem total.

**Ganho ao resolver:** Badge progress em O(1) em vez de O(n). Suporta usuários com anos de histórico.

---

### P1 — Challenge progress em JSON sem atomicidade

**Evidência:**
```python
class UserChallenge:
    progress: Mapped[dict] = mapped_column(JSON, default=dict)
    # Ex: {"days_completed": 5, "target": 7}
```

**Impacto:** Progress é lido, atualizado em Python, e salvo. Se duas requests concorrentes atualizam o mesmo challenge, uma sobrescreve a outra (last write wins). Dado que gamification é triggered por criação de transação (que pode acontecer em batch de upload), isso é real.

**Ganho ao resolver:** Integridade do progresso de challenges. Sem "perda silenciosa" de dias completados.

---

### P2 — Household queries multiplicam carga

**Evidência:** `analytics_service.py`:
```python
async def _get_household_user_ids(self, user):
    result = await self.db.execute(
        select(HouseholdMember.user_id).where(
            HouseholdMember.license_id == user.license_id
        )
    )
```

**Impacto:** Cada membro da família que acessa analytics gera queries para todos os membros. Família de 4 = 4x a carga de analytics. O resultado deveria ser cacheado pelo menos por sessão.

**Ganho ao resolver:** Cache de household_user_ids reduz queries redundantes em ~75% para famílias.

---

### P2 — Nenhuma métrica de qualidade de extração

**Evidência:** Não existe tracking de:
- % de itens aceitos vs corrigidos pelo usuário
- % de faturas com soma correta vs divergente
- Tempo médio de extração por provider/banco
- Taxa de erro por tipo de documento

**Impacto:** Impossível saber se a extração está melhorando ou piorando. Decisões de prompt são baseadas em anedotas.

**Referência cruzada:** O [AI Specialist](./02-ai-specialist.md) recomenda feedback loop. Este é o mesmo ponto visto pela ótica de dados.

**Ganho ao resolver:** Dashboard de qualidade com métricas reais. Base para decisões data-driven sobre investimento em prompts.

---

### P2 — Recurring transactions existem mas nunca geram transações

**Evidência:** `RecurringTransaction` tem `next_due_date` e `last_generated_date`, mas:
- Não existe batch job que gera transações automaticamente
- Review mostra "upcoming recurring" como lembretes
- Nenhuma transação real é criada

**Impacto:** Feature fundamental incompleta. Usuário cadastra recorrente esperando automação, mas precisa criar manualmente toda vez.

**Referência cruzada:** O [Arquiteto](./01-arquiteto.md) identificou que se Celery está morto, isso é duplamente problemático.

**Ganho ao resolver:** Automação real de transações recorrentes. Reduce manual entry significativamente.

---

### P3 — Alertas escalam linearmente com usuários

**Evidência:** Celery tasks fazem:
```python
users = await get_all_active_users()  # TODOS os usuários
for user in users:
    await engine.check_invoice_due_dates(user)
```

**Impacto:** 100.000 usuários = 100.000 iterações × 8 tasks = 800.000 execuções/dia. Cada uma com 1-5 queries = 800K-4M queries/dia só de alertas.

**Ganho ao resolver:** Batch processing com `GROUP BY user_id` ou subscription-based alerting. Escala O(alerts) em vez de O(users).

---

## Recomendações

### Curto prazo (1-2 sprints)

1. **Migrar agregações para SQL GROUP BY** — elimina in-memory processing no analytics
2. **Consolidar budget check em 1 query** com GROUP BY category_id
3. **Adicionar counter incremental** para transaction_count em badges (em vez de COUNT(*))
4. **Cachear household_user_ids** por sessão/request

### Médio prazo (3-4 sprints)

5. **Criar `FinancialAggregationService`** — fonte única de verdade para analytics, review e chat
6. **Implementar batch job de recurring transactions** — gerar transações automaticamente
7. **Adicionar métricas de qualidade de extração** — tabela extraction_quality_log
8. **Migrar challenge progress** de JSON para colunas tipadas com UPDATE atômico

### Longo prazo

9. **Materialized views** para aggregations pesadas (monthly_summary por usuário)
10. **Event-driven gamification** — pub/sub em vez de hooks manuais
11. **Alertas por subscription** — usuário define o que quer ser alertado, sistema processa apenas subscriptions ativas
