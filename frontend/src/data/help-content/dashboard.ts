import type { HelpContent } from './types'

export const dashboardHelp: HelpContent = {
  pageId: 'dashboard',
  pageTitle: 'Dashboard',
  description: 'Visão geral das suas finanças do mês atual.',
  sections: [
    {
      title: 'Cards de Resumo',
      content: `
Os 4 cards no topo mostram um resumo rápido:

- **Receitas**: Total de entradas confirmadas no mês
- **Despesas**: Total de saídas confirmadas no mês (cartão, débito e fixos)
- **A Pagar**: Faturas de cartão pendentes de pagamento
- **Saldo**: Diferença entre receitas e despesas

*A variação percentual nas despesas compara com o mês anterior.*
      `
    },
    {
      title: 'Gastos por Categoria',
      content: `
O gráfico de pizza mostra a distribuição dos seus gastos entre as categorias.

Cada fatia representa uma categoria, e as porcentagens indicam quanto do total de gastos foi para cada uma.

As 5 maiores categorias são destacadas na legenda ao lado.
      `
    },
    {
      title: 'Maiores Gastos',
      content: `
Lista das 5 categorias onde você mais gastou no mês.

Para cada categoria você vê:
- Nome da categoria
- Quantidade de transações
- Valor total gasto
- Porcentagem do total
      `
    }
  ],
  tips: [
    'Acesse o Dashboard diariamente para acompanhar suas finanças',
    'Compare a variação de despesas com o mês anterior',
    'Fique atento às categorias com maior gasto'
  ],
  relatedPages: [
    { title: 'Transações', path: '/transactions' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Insights', path: '/insights' }
  ]
}
