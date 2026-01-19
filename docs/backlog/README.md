# Backlog de Funcionalidades - Biveto App

Este diretório contém a documentação detalhada de todas as funcionalidades planejadas para transformar o Biveto em um aplicativo de controle financeiro baseado em evidências científicas.

## Status Geral

| # | Feature | Status | Impacto | Esforço | Dependências |
|---|---------|--------|---------|---------|--------------|
| 1 | [Sistema de Alertas/Notificações](./01-notifications-alerts.md) | 📋 Planejado | 🔴 Alto | Alto | Celery, Redis |
| 2 | [Calendário de Caixa](./02-cash-calendar.md) | 📋 Planejado | 🔴 Alto | Médio | - |
| 3 | [Orçamento por Envelopes](./03-envelope-budgeting.md) | 📋 Planejado | 🟡 Médio | Médio | - |
| 4 | [Simuladores "E Se..."](./04-simulators.md) | 📋 Planejado | 🔴 Alto | Médio | Existente |
| 5 | [Automações Financeiras](./05-financial-automations.md) | 📋 Planejado | 🟡 Médio | Alto | #1 (Celery) |
| 6 | [Revisão Semanal Guiada](./06-weekly-review.md) | 📋 Planejado | 🟡 Médio | Baixo | #2 |
| 7 | [Educação Contextual](./07-microlearning.md) | 📋 Planejado | 🟢 Baixo | Baixo | - |
| 8 | [Onboarding com Quick Win](./08-onboarding.md) | 📋 Planejado | 🟢 Baixo | Baixo | - |

## Legenda de Status

- 📋 Planejado - Especificação completa, aguardando implementação
- 🚧 Em Desenvolvimento - Implementação em andamento
- ✅ Concluído - Feature implementada e testada
- ⏸️ Em Pausa - Desenvolvimento pausado

## Ordem de Implementação Recomendada

1. **#1 Sistema de Alertas** - Base de infraestrutura (Celery/Redis) necessária para #5
2. **#2 Calendário de Caixa** - Alto impacto, independente
3. **#4 Simuladores** - Backend já existe, apenas frontend
4. **#3 Envelopes** - Médio impacto, independente
5. **#6 Revisão Semanal** - Beneficia-se do #2
6. **#5 Automações** - Depende do #1
7. **#7 e #8** - Podem ser feitos em paralelo

## Arquitetura Geral

```
backend/app/modules/
├── notifications/     # #1 Alertas
├── calendar/          # #2 Calendário de Caixa
├── envelopes/         # #3 Orçamento por Envelopes
├── simulators/        # #4 Simuladores
├── automations/       # #5 Automações
└── review/            # #6 Revisão Semanal

frontend/src/
├── pages/
│   ├── CashCalendar.tsx
│   ├── Envelopes.tsx
│   ├── Simulators/
│   ├── WeeklyReview.tsx
│   └── Onboarding.tsx
└── components/
    ├── notifications/
    ├── calendar/
    ├── envelopes/
    ├── simulators/
    ├── review/
    └── education/
```

## Critérios de Aceitação Gerais

Cada feature deve:
1. Ter testes unitários com cobertura > 80%
2. Ter documentação de API (OpenAPI)
3. Ser responsiva (mobile-first)
4. Seguir os padrões existentes do projeto
5. Não quebrar funcionalidades existentes
