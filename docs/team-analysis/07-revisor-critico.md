# 🔎 Revisor Crítico — Análise Crítica

**Data:** 2026-03-23
**Escopo:** Riscos cruzados, contradições entre especialistas, cenários de falha, o que ninguém quer ouvir

---

## Premissa

Meu papel é confrontar. Vou questionar as recomendações dos outros especialistas e apontar os riscos que ninguém mencionou. Nem tudo aqui precisa ser resolvido — mas tudo precisa ser conscientemente aceito ou rejeitado.

---

## Risco 1: O projeto tem escopo de fintech mas infraestrutura de side project

**Evidência cruzada:**
- 31 models, 30 módulos, 34 páginas frontend
- Deploy: 1 VM de 512MB/1CPU compartilhado no Fly.io
- 0 testes unitários no backend, 0 no frontend
- Celery configurado mas provavelmente não funcional
- Sem APM, sem logging estruturado, sem error tracking
- Sem backup automatizado do banco

**O risco real:** Esse é um app que lida com **dados financeiros pessoais**. Se o banco corromper, não tem backup. Se uma migration falhar, não tem rollback testado. Se uma extração de fatura extrair o valor errado, não tem teste que pegue. Se o Fly.io reiniciar e perder o volume, acabou.

**Pergunta que precisa ser respondida:** Qual é a criticidade dos dados para os usuários? Se é "nice to have", a infraestrutura está ok. Se é "preciso disso para gerenciar minhas finanças", está subdimensionada.

---

## Risco 2: Refatorar 30 módulos sem testes é suicídio

**Contradição:** Todos os especialistas recomendam refatorações:
- Arquiteto: extrair FinancialContextService, unificar módulos
- AI Specialist: quebrar financial_agent_service.py em 4 services
- Data Scientist: migrar agregações para SQL, criar FinancialAggregationService
- DBA: reestruturar Transaction, criar invoice_payments, restaurar índices

**O problema:** Zero testes. Qualquer refatoração pode quebrar silenciosamente. A base de código é complexa o suficiente para que mudanças em um módulo afetem outros.

**Minha recomendação antes de qualquer outra:** Escrever testes PRIMEIRO. Pelo menos para:
1. Auth flow (login, register, refresh token)
2. Transaction CRUD com validações
3. Document upload → extração → confirmação
4. Analytics monthly summary
5. Credit card invoice creation

Sem isso, cada mudança é um gamble.

---

## Risco 3: O "FinancialContextService" proposto pode virar o novo monolito

**Contradição:** Arquiteto, AI Specialist e Data Scientist recomendam extrair um serviço centralizado para aggregation financeira. Em teoria, ótimo. Na prática:

- Se todo módulo depende dele, ele vira o novo gargalo
- Uma mudança nele quebra analytics, review E chat ao mesmo tempo
- É exatamente o que o financial_agent_service.py é hoje — um serviço que faz tudo

**Contraposição:** Em vez de um mega-service, criar funções de agregação independentes que cada módulo chama. Composição em vez de centralização.

---

## Risco 4: Gamificação pode ser prematura

**Evidência:**
- 9 models de banco para gamificação
- Hooks manuais frágeis (se o service não chama, gamificação silencia)
- Challenge progress em JSON sem atomicidade
- Sem evidência de que usuários engajam com badges

**Pergunta:** Gamificação está sendo usada? Tem dados de engagement? Porque se não, são 9 tables, ~1.500 linhas de code, e overhead em toda transaction creation para uma feature que pode não gerar valor.

**Recomendação:** Antes de corrigir a gamificação, validar se alguém usa. Se não, congelar o módulo e investir o tempo no core.

---

## Risco 5: Grocery é a feature mais desconectada e ninguém sabe por quê

**Evidência:**
- 6 models (GroceryProduct, GroceryPurchase, GroceryPriceHistory, ShoppingList, ShoppingListItem)
- Módulo completo com service, router, schemas
- Praticamente zero integração com o core financeiro
- Não aparece como prioridade em nenhum doc de negócio

**Pergunta:** Por que grocery existe? Foi pedido por um usuário? É uma visão de futuro? Porque hoje é 6 tabelas e centenas de linhas de código que não fazem parte da proposta de valor "gestão financeira pessoal".

**Recomendação:** Se não há justificativa clara, remover. Simplifica o schema, reduz superfície de manutenção.

---

## Risco 6: O SECURITY_AUDIT identificou problemas que não foram resolvidos

**Evidência:** `SECURITY_AUDIT_2026-02.md` (fevereiro 2026) identificou:
- 4 issues de alta severidade
- 8 médias
- Vulnerabilidades em dependências frontend (CVE no @remix-run/router)
- pytest não roda (pytest_asyncio faltante)

Estamos em março 2026. O audit report existe há 1 mês. **Os problemas foram resolvidos?** Não há evidência de que foram.

**O risco:** Security audit que vira documento decorativo é pior que não ter audit — cria falsa sensação de segurança.

---

## Risco 7: Deploy com auto_stop_machines pode perder dados de upload

**Evidência:** `fly.toml`:
```toml
auto_stop_machines = "stop"
[mounts]
  source = "app_data"
  destination = "/app/data"
```

**O risco:**
- Machine para quando idle
- Se upload síncrono está em progresso e machine é parada → upload perdido
- Volume montado persiste, mas se a machine é recriada em outra região → volume pode não seguir

**Pergunta:** O volume `app_data` está em região fixa? O Fly garante que a nova machine monta o mesmo volume?

---

## Risco 8: Múltiplos providers LLM podem gerar resultados inconsistentes

**Evidência:** 4 providers (Google, Mistral, OpenAI, Anthropic) com prompts diferentes. Google recebe texto extraído, Mistral faz OCR próprio, OpenAI/Anthropic recebem imagem.

**O risco:** A mesma fatura pode gerar resultados diferentes dependendo do provider ativo. Se o admin trocar de Google para Mistral, o comportamento muda silenciosamente.

**Pergunta:** Existe paridade de testes entre providers? Existe um "golden set" de faturas que roda contra cada provider para validar resultados?

**Recomendação:** Criar test suite com 10 faturas conhecidas (resultado esperado definido manualmente). Rodar contra cada provider. Medir accuracy.

---

## Risco 9: frontend E2E tests podem estar mascarando bugs

**Evidência:** 25+ specs Playwright, mas:
- Rodam contra qual backend? Local? Mock?
- Se rodam contra backend local sem Celery, features de notification/automation não são testadas
- Visual regression com 15% tolerância é alto — mudanças significativas podem passar

**Pergunta:** Os E2E tests rodam em CI? Contra qual ambiente? Com quais fixtures de dados?

---

## Risco 10: Número de dependências desatualizado

**Evidência:**
- FastAPI 0.109 (atual é 0.115+)
- React Router com CVE reportado no audit
- Não há `dependabot.yml` ou Renovate para atualização automática

**Recomendação:** Adicionar Dependabot/Renovate. Pelo menos para security patches.

---

## Resumo: O que eu faria com 1 sprint

Se eu tivesse exatamente 1 sprint (2 semanas) para melhorar a saúde do projeto, ignorando features novas:

### Semana 1
1. **Escrever 10 testes backend** cobrindo auth, transactions, analytics, document upload
2. **Resolver Celery/Redis** — adicionar ao Fly.io ou migrar para APScheduler
3. **Restaurar índices removidos** no banco (migration simples, ganho imediato)
4. **Limpar raiz** — mover PDFs, corrigir .gitignore

### Semana 2
5. **Adicionar FK faltantes** (DocumentExtraction, Merchant)
6. **Notificação de automação desabilitada**
7. **Corrigir CI** (Python 3.12)
8. **Mover startup migration** para background
9. **Decidir sobre grocery e gamification** — manter ou congelar

Nenhuma dessas é glamourosa. Todas são necessárias.

---

## O que NÃO fazer agora

1. **Não refatorar Transaction** — é complexo demais sem testes. Vive como está por mais 2-3 sprints.
2. **Não implementar confidence scoring** — o hardcoded 0.9 funciona. Priorize o que está quebrado.
3. **Não criar FinancialContextService** — sem testes, essa refatoração é arriscada.
4. **Não adicionar i18n** — o app é brasileiro. Mantenha foco.
5. **Não adicionar Storybook** — overhead de manutenção sem ganho para time pequeno.

---

## Veredito Final

O Biveto é um projeto impressionante em escopo e ambição. A qualidade técnica é acima da média em muitas áreas (prompts, PWA, multi-auth, household). Mas cresceu mais rápido que a infraestrutura de suporte (testes, CI, observabilidade, backup).

**A prioridade não é adicionar features. É garantir que as features existentes funcionam de verdade.**

Feature que existe mas não funciona é pior que feature que não existe. O usuário espera que funcione.
