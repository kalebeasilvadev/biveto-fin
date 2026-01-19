import type { HelpContent } from './types'

export const debtsHelp: HelpContent = {
  pageId: 'debts',
  pageTitle: 'Dívidas',
  description: 'Controle e planeje a quitação das suas dívidas.',
  sections: [
    {
      title: 'Cadastrar Dívida',
      content: `
Registre suas dívidas com:

- **Nome**: Identificação (ex: Empréstimo Banco X)
- **Valor Total**: Quanto você deve
- **Taxa de Juros**: Juros mensais ou anuais
- **Parcela Mínima**: Valor mínimo de pagamento
- **Credor**: Para quem você deve

*Dívidas de cartão de crédito são gerenciadas nas Faturas.*
      `
    },
    {
      title: 'Registrar Pagamentos',
      content: `
A cada pagamento, registre:

- **Valor Pago**: Quanto pagou
- **Data**: Quando pagou
- **Conta**: De onde saiu o dinheiro

*O sistema calcula o saldo devedor atualizado.*
      `
    },
    {
      title: 'Método Snowball (Bola de Neve)',
      content: `
Estratégia de quitação que prioriza dívidas menores:

1. Pague o mínimo em todas as dívidas
2. Direcione dinheiro extra para a menor dívida
3. Ao quitar, passe para a próxima menor

*Motivação: vitórias rápidas mantêm o foco.*
      `
    },
    {
      title: 'Método Avalanche',
      content: `
Estratégia que prioriza dívidas com maior juros:

1. Pague o mínimo em todas as dívidas
2. Direcione dinheiro extra para a de maior juros
3. Ao quitar, passe para a próxima maior

*Economia: paga menos juros no total.*
      `
    }
  ],
  tips: [
    'Liste todas as dívidas, mesmo as pequenas',
    'Não faça novas dívidas enquanto quita as atuais',
    'Negocie taxas de juros quando possível',
    'Use os Simuladores para planejar a quitação'
  ],
  relatedPages: [
    { title: 'Simuladores', path: '/simulators' },
    { title: 'Transações', path: '/transactions' },
    { title: 'Orçamento', path: '/budget' }
  ]
}
