# 🏗️ Arquiteto — Análise Crítica

**Data:** 2026-03-23
**Escopo:** Coesão arquitetural, acoplamento entre módulos, decisões estruturais, feature creep

---

## O que está bom

### 1. Arquitetura modular bem definida
O projeto segue um padrão modular claro: cada feature tem `routers/`, `services/`, `schemas/`. Isso facilita navegação e onboarding. A separação entre `core/` (infra) e `modules/` (negócio) é correta.

### 2. Async de ponta a ponta
SQLAlchemy 2.0 async + FastAPI async + asyncpg. Stack moderna e coerente. Não há mistura de sync/async no hot path da API (exceto Celery — ver Backend Dev).

### 3. Multi-tenancy via Household
O modelo de `ownership_type` (personal/household) com `HouseholdMember` é elegante. Permite compartilhamento familiar sem duplicar dados.

### 4. Provider Pattern para LLM
A abstração `BaseProvider` → `GoogleProvider`, `MistralProvider`, etc. é correta e extensível. Trocar de provider não requer mudar lógica de negócio.

### 5. Documentação acima da média
14 docs em `docs/`, LOGIC_MAP com 15 regras de negócio explícitas, audit report. Muitos projetos não chegam perto disso.

---

## O que está desconexo

### P0 — Celery/Redis provavelmente morto em produção

**Evidência:**
- `celery_config.py` configura 8 tasks agendadas (notificações, automações, budget alerts)
- `docker-compose.yml` só tem PostgreSQL — **sem Redis**
- `fly.toml` não menciona Redis nem worker Celery
- Deploy no Fly.io é uma única VM de 512MB com 1 CPU compartilhado

**Impacto:** Se Celery não roda, estas features estão mortas:
- Notificações de vencimento de fatura
- Alertas de orçamento estourado
- Automações agendadas
- Alertas de limite de cartão
- Checagem de metas

**Ganho ao resolver:** Todas as features de "inteligência ativa" voltam a funcionar. O usuário passa de "app passivo que mostra dados" para "app que avisa e age".

**Referência cruzada:** Ver [Backend Dev](./05-backend-dev.md) para detalhes técnicos do Celery.

---

### P1 — Feature creep: módulos satélite desconectados

**Evidência:** 30 módulos no backend, mas apenas ~15 formam o core coeso. Os demais estão soltos:

| Módulo | Models | Integração com core | Veredicto |
|---|---|---|---|
| `grocery` | 6 models (Product, Purchase, PriceHistory, ShoppingList, ListItem) | Quase zero. Compras no mercado não atualizam tracking automaticamente | Desconectado |
| `gamification` | 9 models (Badges, Streaks, Challenges, Points) | Depende de hooks manuais nos services. Se o service não chama, gamificação silencia | Frágil |
| `benefit_cards` | 2 models | Duplica dados com IncomeSource (benefit_card_number, benefit_provider) | Redundante |
| `simulators` | 0 models | Cálculos stateless, sem persistência | Isolado mas ok |
| `receipts` | 2 models | Overlap com Document — ambos processam comprovantes | Confuso |

**Ganho ao resolver:** Reduzir manutenção de ~30% do código que agrega pouco valor. Foco no que realmente funciona.

---

### P1 — Nomenclatura fragmentada

| Contexto | Nome usado |
|---|---|
| Docker | `financeiro_postgres`, `financeiro_db`, `financeiro_secret` |
| Fly.io | `app-financeiro` |
| Repositório | `biveto-app` |
| UI/Branding | Biveto |
| DB SQLite dev | `financeiro.db` |

**Impacto:** Confusão em logs, deploys, onboarding. Novo dev não sabe se "financeiro" e "biveto" são o mesmo sistema.

**Ganho ao resolver:** Identidade unificada. Menos confusão operacional.

---

### P1 — financial_agent_service.py é um monolito de 3.539 linhas

**Evidência:** Este único arquivo:
- Faz queries diretas em 15+ tabelas
- Constrói 19 contextos financeiros diferentes
- Gera sugestões inteligentes
- Formata prompts
- Chama 2 providers LLM diferentes
- Gerencia histórico de conversas

**Impacto:** Impossível testar unitariamente. Qualquer mudança no schema pode quebrar o chat sem aviso. Qualquer dev que tocar esse arquivo precisa entender o sistema inteiro.

**Ganho ao resolver:** Testabilidade, manutenibilidade, e separação clara de responsabilidades.

**Referência cruzada:** Ver [AI Specialist](./02-ai-specialist.md) para análise detalhada.

---

### P2 — Padrão modular inconsistente

Não existe contrato obrigatório por módulo:
- `documents/` tem `prompts/`, `providers/`, `utils/`, `services/` — muito rico
- `calendar/` é um router com queries inline — não tem service layer
- `known_services/` tem model + router mas sem service

**Ganho ao resolver:** Previsibilidade. Qualquer dev sabe exatamente onde encontrar o quê em qualquer módulo.

---

### P2 — Overlap entre documents e receipts

- `documents/` processa uploads de PDF, faturas, cupons fiscais
- `receipts/` gerencia "recibos" com pagamentos split
- Ambos lidam com comprovantes de compra mas por caminhos diferentes
- Não há link claro entre um Document e um Receipt

**Ganho ao resolver:** Pipeline unificado de processamento de documentos.

---

### P2 — Frontend com 34 páginas para features que podem não funcionar

Se Celery está morto:
- Página de Notificações: vazia
- Página de Automações: regras que nunca executam
- Weekly Review: dados de alerta ausentes
- Gamification: badges que nunca são concedidos

**Referência cruzada:** Ver [Frontend Dev](./06-frontend-dev.md).

---

## Recomendações

### Curto prazo (1-2 sprints)

1. **Validar se Celery/Redis funciona em produção.** Se não, decidir: implementar Redis no Fly.io OU migrar tasks para background tasks do FastAPI (mais simples, menos features).

2. **Unificar nomenclatura** para "biveto" em todos os contextos (Docker, Fly, DB, variáveis).

3. **Documentar quais módulos são "core" vs "experimental"** — nem tudo precisa ser removido, mas o dev precisa saber o status.

### Médio prazo (3-4 sprints)

4. **Extrair contexto financeiro do chat** para um `FinancialContextService` reutilizável por analytics, review e chat.

5. **Definir contrato mínimo por módulo**: todo módulo DEVE ter `service.py`, `router.py`, `schemas.py`. Sem exceções.

6. **Decidir sobre grocery**: integrar de verdade (transação → grocery tracking automático) ou remover.

### Longo prazo

7. **Avaliar se gamification justifica 9 models** dado que depende de hooks manuais frágeis. Considerar event-driven com pub/sub interno.
