import type { HelpContent } from './types'

export const calendarHelp: HelpContent = {
  pageId: 'calendar',
  pageTitle: 'Calendário Financeiro',
  description: 'Visualize seu fluxo de caixa dia a dia.',
  sections: [
    {
      title: 'Visão do Calendário',
      content: `
O calendário mostra suas finanças organizadas por dia:

- **Verde**: Dias com receitas
- **Vermelho**: Dias com despesas
- **Cinza**: Dias sem movimentação

*Clique em um dia para ver os detalhes.*
      `
    },
    {
      title: 'Fluxo de Caixa',
      content: `
O gráfico de linha mostra:

- **Saldo Corrente**: Como seu dinheiro varia ao longo do mês
- **Entradas**: Picos para cima
- **Saídas**: Quedas para baixo

*Identifique períodos de aperto financeiro.*
      `
    },
    {
      title: 'Projeções Futuras',
      content: `
Para meses futuros, o calendário mostra:

- Transações recorrentes programadas
- Faturas de cartão previstas
- Receitas esperadas

*As projeções são baseadas no seu histórico e configurações.*
      `
    },
    {
      title: 'Saldo Corrente',
      content: `
O saldo corrente é calculado dia a dia:

Saldo do dia = Saldo anterior + Receitas - Despesas

*Útil para saber se terá dinheiro para pagar uma conta específica.*
      `
    }
  ],
  tips: [
    'Use para planejar pagamentos grandes',
    'Verifique se o salário cai antes das contas',
    'Antecipe-se a períodos de saldo baixo',
    'Configure recorrentes para projeções precisas'
  ],
  relatedPages: [
    { title: 'Recorrentes', path: '/recurring' },
    { title: 'Faturas', path: '/invoices' },
    { title: 'Transações', path: '/transactions' }
  ]
}
