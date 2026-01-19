import type { HelpContent } from './types'

export const goalsHelp: HelpContent = {
  pageId: 'goals',
  pageTitle: 'Metas',
  description: 'Defina e acompanhe suas metas financeiras.',
  sections: [
    {
      title: 'Criar uma Meta',
      content: `
Ao criar uma meta, defina:

- **Nome**: Objetivo da meta (ex: Viagem, Carro Novo)
- **Valor Alvo**: Quanto você precisa juntar
- **Prazo**: Data limite para atingir
- **Cor/Ícone**: Personalização visual

*A meta calcula automaticamente quanto guardar por mês.*
      `
    },
    {
      title: 'Contribuições',
      content: `
Adicione contribuições conforme guarda dinheiro:

- **Valor**: Quanto está guardando
- **Data**: Quando fez a contribuição
- **Origem**: De qual conta veio

*O progresso é atualizado automaticamente.*
      `
    },
    {
      title: 'Reserva de Emergência',
      content: `
A reserva de emergência é uma meta especial:

- Recomendado: 6 meses de despesas
- Serve para imprevistos
- Deve ser a primeira meta a completar

*O sistema sugere o valor baseado nos seus gastos.*
      `
    },
    {
      title: 'PNIF - Ponto de Não Ter que Ir Trabalhar',
      content: `
O PNIF é o valor que, investido, gera renda passiva suficiente para suas despesas.

Cálculo simplificado:
- Despesas mensais × 300 (regra dos 4%)

*É uma meta de longo prazo para independência financeira.*
      `
    }
  ],
  tips: [
    'Complete a reserva de emergência primeiro',
    'Defina metas realistas e mensuráveis',
    'Automatize contribuições mensais',
    'Celebre cada meta alcançada'
  ],
  relatedPages: [
    { title: 'Simuladores', path: '/simulators' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Contas', path: '/accounts' }
  ]
}
