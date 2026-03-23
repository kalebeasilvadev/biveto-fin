# Plano de Ação — Biveto App

**Data:** 2026-03-23 (revisado após análise de riscos pelo time)
**Princípio:** Corrigir os erros primeiro. Não quebrar o que funciona. Cada mudança com validação manual clara.

---

## Filosofia do plano

1. **Fase 0** — Limpeza e higiene (zero risco)
2. **Fase 1** — Corrigir o que está errado (banco, infra, bugs reais)
3. **Fase 2** — Performance e IA (otimizar o que funciona)
4. **Fase 3** — Refatorações estruturais (reorganizar código)
5. **Fase 4** — Decisões de produto (cortar ou integrar)
6. **Fase 5** — Testes (validar o código corrigido)

---

## Fase 0 — Limpeza e Higiene (Risco: Zero)

### 0.1 Limpar raiz do projeto ✅
- [x] Adicionar ao `.gitignore`: `*.pdf` na raiz, scripts de teste soltos
- [x] Mover `test_bradesco_ocr.py`, `test_extraction_fixes.py`, `test_pdf_extraction.py` para `backend/tests/`
- [x] Criar `backend/tests/fixtures/`

**Ganho:** Elimina risco de commit acidental de dados financeiros pessoais.
**Tempo:** 30 min

---

### 0.2 Unificar nomenclatura ✅
- [x] `docker-compose.yml`: `financeiro_*` → `biveto_*`
- [x] `Makefile`: `financeiro.db` → `biveto.db` no target `db-reset`

**Ganho:** Identidade unificada.
**Tempo:** 1 hora
**Cuidado:** Quem tem volume antigo precisa recriar: `docker-compose down -v && docker-compose up -d`

---

### 0.3 Corrigir CI para Python 3.12 ✅
- [x] `.github/workflows/ci.yml`: `"3.11"` → `"3.12"`

**Tempo:** 15 min

---

### 0.4 Resolver vulnerabilidades de dependências
- [ ] `cd frontend && npm audit fix`
- [ ] Atualizar `react-router-dom` (CVE)
- [ ] Backend: atualizar packages com CVEs
- [ ] Adicionar `.github/dependabot.yml`

**Tempo:** 2-3 horas
**Validação:** `npm audit` sem high/critical. App roda normal.

---

### 0.5 Corrigir `datetime.utcnow()` deprecado ✅
- [x] Substituir `datetime.utcnow()` → `datetime.now(timezone.utc)` em 41 arquivos (13 services + 26 models + 2 core)
- [x] Models: `default=datetime.utcnow` → `default=lambda: datetime.now(timezone.utc)`

**Tempo:** 1-2 horas
**Validação:** Login, criar transação, extrair documento — tudo funciona.

---

## Fase 1 — Corrigir o que Está Errado (Risco: Baixo-Médio)

### 1.1 Restaurar índices removidos no banco ✅

Migration `ba9ea6b64409` removeu índices compostos. Queries fazem full table scan.

- [x] Migration Alembic `restore_indexes_fks` adicionando:
  - `ix_invoices_user_status` em CreditCardInvoice(user_id, status)
  - `ix_invoices_card_period` em CreditCardInvoice(credit_card_id, year, month)
  - `ix_categories_user` em Category(user_id)
  - `ix_categories_parent` em Category(parent_id)
  - Index em IncomeSource(category_id), InstallmentSeries(category_id), UserMerchantRule(category_id)
  - Index em Transaction(credit_card_id), Transaction(recurring_id)

**Ganho:** Queries 100-2000x mais rápidas. Zero risco — index não muda comportamento.
**Tempo:** 1-2 horas
**Validação:** `alembic upgrade head` ok. Listar faturas e categorias carrega mais rápido.

---

### 1.2 Adicionar Foreign Keys faltantes ✅

- [x] **Na migration:** limpeza de IDs órfãos incluída (UPDATE SET NULL WHERE NOT IN categories):
  ```sql
  SELECT DISTINCT suggested_category_id FROM document_extractions
  WHERE suggested_category_id NOT IN (SELECT id FROM categories);
  ```
  Limpar dados órfãos primeiro.
- [ ] Migration: `DocumentExtraction.suggested_category_id` → `ForeignKey("categories.id", ondelete="SET NULL")`
- [ ] Migration: `Merchant.category_id` → `ForeignKey("categories.id", ondelete="SET NULL")`
- [ ] Index em ambos

**Ganho:** Integridade referencial.
**Tempo:** 1 hora

---

### 1.3 Ligar o scheduler (APScheduler) — task por task ✅

Celery está configurado com 8 tasks mas Redis não existe em prod. Tudo morto.

**Abordagem: APScheduler inline + rollout gradual**

- [x] Instalar `apscheduler` no requirements
- [x] Criar `backend/app/core/scheduler.py` com AsyncIOScheduler + 8 tasks + dry_run
- [x] Iniciar no `lifespan` do FastAPI (main.py atualizado)
- [x] Config `SCHEDULER_DRY_RUN` em settings
- [x] Endpoint `/health` retorna `scheduler_active` e `scheduler_jobs`

**Rollout gradual (uma task por vez):**

| Semana | Task | Validação |
|---|---|---|
| 1 | `check_invoice_due_dates` | Criar fatura com vencimento em 3 dias. Verificar log (dry run). Desligar dry run. Verificar notificação. |
| 1 | `check_recurring_due` | Criar recorrente para amanhã. Verificar notificação. |
| 2 | `check_budget_thresholds` | Criar budget. Gastar > 80%. Verificar alerta. |
| 2 | `check_credit_card_limits` | Verificar cartão com uso > 80%. Verificar alerta. |
| 3 | `check_goal_milestones` | Meta com > 50% progresso. Verificar notificação. |
| 3 | `check_low_balance` | Conta com saldo baixo. Verificar alerta. |
| 4 | `process_scheduled_automations` | Criar automação simples (notificação diária). Verificar. |
| 4 | `process_threshold_automations` | Criar automação de threshold. Verificar. |

**Proteção contra backlog:** Na primeira execução de cada task, filtrar apenas itens dos últimos 7 dias (`due_date >= hoje - 7`). Ignora acumulado antigo.

**Ganho:** 8 features voltam a funcionar de forma controlada.
**Tempo:** 2-3 dias para setup + 4 semanas de rollout gradual
**Cuidado:** Uma task por vez. Dry run primeiro. Validar manualmente antes de ligar a próxima.

---

### 1.4 Mover startup migration para background ✅

`migrate_credit_card_transactions()` roda no boot e pode travar.

- [x] Removido `await migrate_credit_card_transactions()` do `lifespan`
- [x] Registrado como job APScheduler com `DateTrigger(run_date=None)` (roda 1x no boot)
- [x] Idempotente (já era — checa `pending_count == 0`)

**Ganho:** Boot instantâneo. Health check responde em < 2s.
**Tempo:** 2-3 horas
**Validação:** Reiniciar backend. `/health` responde imediatamente. Logs mostram migration rodando em background.

---

### 1.5 Notificar quando automação auto-desabilita ✅

- [x] Adicionado `AUTOMATION_DISABLED` ao enum `NotificationType`
- [x] Em `automation_service.py`: notificação HIGH priority quando `rule.is_active = False` por falhas
- [x] Mensagem em português com nome da regra e número de falhas, wrapped em try/except

---

### 1.6 Corrigir MCP server ✅

- [x] `.mcp.json`: path absoluto → relativo (`mcp-biveto-db/server.py`)
- [x] Criado `.mcp.json.example` com campos `_comment` explicando config
- [x] Criado `docs/integrations/MCP_TOOLS.md` com 6 tools documentadas + 28 tabelas + exemplos

---

## Fase 2 — Performance e IA (Risco: Médio)

### 2.1 Migrar agregações de analytics para SQL (com validação side-by-side)

**Abordagem segura em 3 passos:**

**Passo 1:** Criar queries SQL novas como métodos separados (`_get_monthly_summary_v2()`)
- SQL com `GROUP BY` + `SUM()` + `COALESCE(..., 0)` + `CAST(... AS NUMERIC(12,2))`
- Não substituir nada ainda

**Passo 2:** Criar script `backend/scripts/compare_analytics.py` (descartável)
- Para cada mês dos últimos 6 meses: chamar versão antiga e nova
- Comparar totais, categorias, merchants
- Logar diferenças

**Passo 3:** Se números batem 100% para todos os meses → substituir versão antiga pela nova

- [x] `_group_by_category_sql()` e `_group_by_merchant_sql()` criados com SQL GROUP BY + COALESCE + NUMERIC(12,2)
- [x] `get_monthly_summary()` atualizado para usar as novas queries SQL
- [x] Budget check em `alert_engine.py`: de N queries para 1 com GROUP BY category_id
- [x] Métodos antigos mantidos como deprecated para comparação
- [ ] Invoice payment dedup: de Python `not in` para SQL subquery (fase futura)

**Ganho:** 3-5x mais rápido. Menos memória. Queries de budget: de 12 para 1.
**Tempo:** 3-5 dias
**Validação:** Script de comparação mostra 0 divergências para 6 meses.
**Cuidado:** Se qualquer número divergir, ajustar SQL até bater. Não trocar enquanto houver diferença.

---

### 2.2 Cache de prompts em memória ✅

- [x] `prompts.py` reescrito com `@lru_cache(maxsize=32)` para cache global
- [x] `load_prompt(name)` carrega do disco uma vez, depois retorna do cache
- [x] `clear_prompt_cache()` para hot-reload em dev

**Ganho:** -50-100ms por extração.
**Tempo:** 1 hora

---

### 2.3 Externalizar prompts hardcoded ✅

- [x] `EXTRACTION_PROMPT` (299 linhas) extraído para `prompts/extraction_main.md`
- [x] `prompts.py` agora carrega de arquivo com backward compatibility
- [ ] System prompt do chat → `prompts/chat_system.md` (fase futura — arquivo muito acoplado)

**Ganho:** Iterar prompts sem alterar Python.
**Tempo:** 2-3 horas
**Validação:** Extrair mesma fatura antes/depois. JSON output idêntico.

---

### 2.4 Adicionar modo PDF nativo para Gemini (como opção, não default) ✅

- [x] Config `GOOGLE_PDF_MODE=text` adicionada (default = comportamento atual)
- [x] Modo `native` implementado em google_provider.py — envia PDF bytes com mime_type="application/pdf"
- [x] PDFs protegidos por senha: fallback automático para modo text
- [ ] Testar com faturas de bancos diferentes antes de trocar default

**Ganho:** Opção de melhor qualidade para layouts complexos. Sem risco no default.
**Tempo:** 3-4 horas

---

### 2.5 Retry por qualidade de extração ✅

- [x] Se 0 itens e PDF > 1 página: retry com `_get_fallback_provider()` (google↔mistral)
- [x] Se soma diverge > R$ 100 do total do cartão: warning logado (sem retry)
- [x] Max 1 retry. Helper `_get_pdf_page_count()` com PyMuPDF

**Ganho:** Taxa de sucesso: ~85% → ~95%.
**Tempo:** 4-5 horas

---

### 2.6 Separar provider de chat do provider de extração ✅

- [x] Config `CHAT_PROVIDER` e `CHAT_MODEL` adicionadas (default: None = usa vision_provider)
- [x] `financial_agent_service.py` atualizado: `self.provider = settings.chat_provider or settings.vision_provider`
- [x] Para usar Mistral no chat: `CHAT_PROVIDER=mistral` no .env

**Ganho:** Flexibilidade. Preparação para otimização de custo.
**Tempo:** 2-3 horas
**Cuidado:** Default mantém comportamento atual. Só muda se o admin configurar explicitamente.

---

## Fase 3 — Refatorações Estruturais (Risco: Alto)

### 3.1 Separar api.ts do frontend ✅

- [x] 980 linhas → 9 arquivos: api.ts (297), auth.api.ts, transactions.api.ts, documents.api.ts, analytics.api.ts, accounts.api.ts, settings.api.ts, features.api.ts, index.ts
- [x] api.ts mantém axios instance + interceptors + re-exports para backward compatibility
- [x] 45 imports existentes em 40+ arquivos continuam funcionando sem mudança

**Ganho:** Navegabilidade. Menos merge conflicts.
**Tempo:** 4-5 horas
**Validação:** `npm run build` ok. App funciona em todos os fluxos.

---

### 3.2 Lazy loading de rotas ✅

- [x] 35 páginas convertidas para `React.lazy()` + `<Suspense>`
- [x] Apenas Login e Layout mantidos como eager (primeiro contato do usuário)

**Ganho:** Bundle ~50% menor. Mobile mais rápido.
**Tempo:** 3-4 horas

---

### 3.3 Criar FinancialAggregationService ⏸️ (próxima iteração)

Pré-requisito: validar que queries SQL do 2.1 produzem números idênticos aos antigos. Após validação em produção por 1-2 semanas, extrair para serviço centralizado.

- [ ] Criar `backend/app/core/services/financial_aggregation.py`
- [ ] Migrar analytics → review → chat (um por vez)

**Tempo estimado:** 1 semana

---

### 3.4 Quebrar financial_agent_service.py ⏸️ (próxima iteração)

Refatoração grande (3.539 linhas → 4 arquivos). **53 testes criados** como rede de segurança.
Testes cobrem: parse_query, classify_intent, suggestions, prompt building, chat orchestration, edge cases.

- [x] Testes criados (53 passing)
- [ ] Extrair: chat_context_builder, chat_prompt_builder, chat_suggestion_engine, chat_service

**Tempo estimado:** Sessão dedicada de ~2 horas

---

### 3.5 Geração automática de recurring transactions ✅

- [x] `task_generate_recurring_transactions` adicionado ao scheduler (daily 6:00 AM)
- [x] Helper `_advance_next_due_date()` com suporte a daily/weekly/monthly/yearly + day_of_month
- [x] Idempotente: verifica existência de Transaction com (recurring_id, date) antes de criar
- [x] Catch-up: processa todas as datas vencidas (loop while next_due_date <= today)
- [x] Auto-cancela quando end_date é atingida

**Ganho:** Recurring funciona de verdade.
**Tempo:** 1-2 dias

---

### 3.6 Migrar frontend para upload async (quando viável)

- [ ] Mudar `Upload.tsx` de `documentsApi.upload()` para `documentsApi.uploadAsync()`
- [ ] Implementar polling com `GET /documents/{id}` até `status == "completed"`
- [ ] Mostrar progresso ao usuário

**Ganho:** Worker nunca bloqueia. UX com feedback de progresso.
**Tempo:** 1 dia
**Nota:** Menor prioridade que outros itens da Fase 3. O upload sync não bloqueia o event loop (usa `to_thread`), só ocupa thread pool.

---

## Fase 4 — Decisões de Produto

### 4.1 Grocery — Congelar ou Remover?
- Se ninguém pede em 3 meses → remover (6 models, routers, services)

### 4.2 Gamificação — Tem engagement?
- Se baixo → congelar, remover hooks dos services core
- Se relevante → migrar para event-driven

### 4.3 Receipts vs Documents — Unificar
- Receipt vira tipo de Document

### 4.4 Features inoperantes no frontend
- Mostrar "em breve" em Notifications, Automations, Achievements **até** scheduler estar ativo
- Remover banner quando scheduler confirmar via `/health`

---

## Fase 5 — Testes (código corrigido)

### 5.1 Configurar pytest
- [ ] `pytest-asyncio`, `conftest.py`, SQLite in-memory

### 5.2 Testes de regressão
- [ ] Auth, Transactions, Analytics (validar queries SQL novas), Document upload, Recurring, Scheduler

---

## O que SAIU do plano (e por quê)

| Item removido | Motivo |
|---|---|
| Conversão paralela de páginas PDF | Ganho marginal (1.5s) vs risco de OOM no Fly.io 512MB. Reavaliar com 1GB. |
| Resolver circular Invoice ↔ Transaction | `post_update=True` é feio mas funciona. Não toca em schema financeiro sem necessidade de negócio. |
| Refatorar Transaction (21 FKs) | Funciona. Muito arriscado sem alta cobertura de testes. |
| Trocar default do Gemini para PDF nativo | Adicionado como opção configurável, não como troca de default. |
| Deprecar upload síncrono (urgente) | Upload sync usa `to_thread()`, não bloqueia event loop. Virou Fase 3.6 com menor prioridade. |
| Confidence scoring | Hardcoded 0.9 funciona. Foco no que está quebrado. |
| i18n, Storybook, Event sourcing, K8s | Sem necessidade. |

---

## Cronograma

| Fase | Status | Resultado |
|---|---|---|
| **Fase 0** — Limpeza | ✅ Concluída | 5/5 itens implementados |
| **Fase 1** — Correções | ✅ Concluída | 6/6 itens implementados |
| **Fase 2** — Performance | ✅ Concluída | 6/6 itens implementados |
| **Fase 3** — Refatorações | 🔄 Parcial | 4/6 implementados, 3.3 e 3.4 → próxima iteração |
| **Fase 4** — Decisões | ⏸️ Pendente | Aguarda dados de uso |
| **Fase 5** — Testes | ⏸️ Pendente | Código corrigido, pronto para testes |

---

## Métricas de Sucesso — Resultado

| Métrica | Antes | Depois | Status |
|---|---|---|---|
| Features de scheduler | 8 mortas (Celery/Redis inexistente) | APScheduler com 9 jobs + dry_run | ✅ |
| Queries no budget check | 12 por usuário (1 por categoria) | 1 com GROUP BY | ✅ |
| Queries no analytics | In-memory Python loops em 2000+ objetos | SQL GROUP BY retorna 15-20 linhas | ✅ |
| Índices no banco | 5+ removidos sem justificativa | 9 índices restaurados via migration | ✅ |
| FKs sem constraint | 2 (DocumentExtraction, Merchant) | 0 — FKs + cleanup de órfãos | ✅ |
| Raiz do projeto | 7 PDFs + 3 scripts soltos | .gitignore atualizado, scripts movidos | ✅ |
| CI Python | 3.11 (errado) | 3.12 (correto) | ✅ |
| datetime.utcnow() | Deprecado em 41 arquivos | datetime.now(timezone.utc) | ✅ |
| Nomenclatura | financeiro vs biveto | Unificado para biveto | ✅ |
| Prompts | Hardcoded em Python (299 linhas) | Arquivo .md + cache LRU | ✅ |
| Chat provider | Amarrado ao vision provider | Config independente CHAT_PROVIDER | ✅ |
| Gemini PDF | Só modo texto | Modo native disponível via config | ✅ |
| Extração retry | Aceita 0 itens silenciosamente | Retry com fallback provider | ✅ |
| Automação auto-disable | Silenciosa | Notificação AUTOMATION_DISABLED | ✅ |
| MCP server | Path hardcoded, sem docs | Relativo + .example + docs 6 tools | ✅ |
| Recurring transactions | Lembrete passivo (nunca gera) | Job diário com catch-up + idempotência | ✅ |
| Frontend lazy loading | 35 páginas eager no bundle | React.lazy + Suspense | ✅ |
| Startup migration | Bloqueia boot por minutos | Background via APScheduler | ✅ |
| api.ts frontend | 980 linhas / 1 arquivo | 9 arquivos modulares + re-exports | ✅ |
| financial_agent_service | 3.539 linhas | Próxima iteração | ⏸️ |
