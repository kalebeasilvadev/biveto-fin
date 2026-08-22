# Guia de contribuição

Bem-vindo(a)! Este guia define **como o time trabalha** neste repositório. Se é sua primeira vez aqui, antes leia o onboarding em [`docs/onboarding/`](docs/onboarding/README.md) — ele cobre o setup do ambiente e o mapa do código.

## Fluxo de trabalho

1. **Pegue uma tarefa** — trabalhe sempre a partir de uma issue do GitHub. Se a tarefa não existe como issue, crie uma primeiro (título claro + o que define "pronto"). Não comece trabalho grande sem alinhar com o mantenedor.
2. **Crie uma branch a partir da `main`** (a `main` é a única branch base do projeto):
   ```
   git checkout main && git pull
   git checkout -b feat/nome-curto-da-tarefa
   ```
   Prefixos: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`.
3. **Commits pequenos, no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/)**:
   ```
   feat(invoices): recalcular total ao excluir transação da fatura
   fix(upload): aceitar HEIC do iPhone
   docs: corrigir porta do Postgres no onboarding
   ```
   Escreva a mensagem explicando **o quê e por quê**, não "ajustes".
4. **Antes de abrir o PR**, rode localmente o que o CI vai cobrar:
   - Backend: `pytest` (dentro de `backend/`, com venv ativo)
   - Frontend: `npx tsc --noEmit && npm run build` (dentro de `frontend/`)
5. **Abra o PR contra a `main`** preenchendo o template. PRs pequenos (até ~300 linhas de diff) são revisados rápido; PRs gigantes ficam parados — se a tarefa é grande, fatie em PRs sequenciais.
6. **Revisão**: todo PR precisa de **1 aprovação** de outra pessoa do time (o mantenedor pode revisar qualquer um; entre alunos, revisem-se mutuamente — revisar é parte do aprendizado). Responda os comentários com novos commits; não faça force-push depois que a revisão começou.
7. **Merge**: *squash merge* pela interface do GitHub (mantém a `main` com um commit por PR). Quem mergeia apaga a branch.

## Definition of Done

Um PR está pronto quando:

- [ ] O CI está verde (pytest + type check + build).
- [ ] Mudou regra de negócio? Tem **ao menos um teste** cobrindo a mudança.
- [ ] Mudou modelo de dados? Tem migração Alembic (revisada à mão, não só o autogenerate) e ela roda em banco limpo (`alembic upgrade head` do zero).
- [ ] Você testou manualmente o fluxo afetado no app rodando local.
- [ ] Nenhum segredo, dado real ou arquivo gerado foi commitado (leia as [regras de segurança](docs/onboarding/04-SUSTENTACAO.md#segurança--regras-não-negociáveis) — este repo já teve um incidente e as regras são inegociáveis).
- [ ] Se o comportamento visível mudou, a documentação afetada foi atualizada.

## Convenções de código

O detalhe está em [`docs/development/CONVENTIONS.md`](docs/development/CONVENTIONS.md). O essencial:

- **Backend**: router fino / service gordo; models centralizados em `app/models/`; schemas Pydantic v2 para toda entrada/saída; `async` em todo o caminho de request; siga o `ruff` (line-length 100).
- **Frontend**: TypeScript estrito (o build falha com erro de tipo); dados de servidor via TanStack Query; estado global só no Zustand quando precisa sobreviver entre páginas; Tailwind seguindo os padrões visuais das páginas existentes.
- Textos de UI em **português (pt-BR)**; código e identificadores em **inglês**.

## O que o CI faz hoje

Em todo push/PR para `main` (`.github/workflows/ci.yml`):

- **Backend:** `ruff check app/` (lint, bloqueia) + `pytest` (SQLite)
- **Frontend:** `npm run lint` (eslint — *erros* bloqueiam; warnings não) + `tsc --noEmit` + `vite build`

Rode os quatro localmente antes do PR (`make lint` e `make test` no Linux/Mac). Não introduza warnings novos de eslint — a meta é zerá-los, não acumulá-los.

## Dúvidas

- "Onde fica o código de X?" → [`docs/onboarding/02-MAPA-DO-CODIGO.md`](docs/onboarding/02-MAPA-DO-CODIGO.md)
- "Por que isso é assim?" → [`docs/onboarding/03-DECISOES-E-MOTIVOS.md`](docs/onboarding/03-DECISOES-E-MOTIVOS.md)
- Não achou? Abra uma issue com a etiqueta `question` — a resposta pode virar documentação.
