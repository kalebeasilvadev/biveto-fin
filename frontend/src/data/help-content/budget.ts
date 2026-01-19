import type { HelpContent } from './types'

export const budgetHelp: HelpContent = {
  pageId: 'budget',
  pageTitle: 'Orçamento',
  description: 'Planeje e controle seus gastos por categoria.',
  sections: [
    {
      title: 'O que é Orçamento',
      content: `
O orçamento permite definir limites de gastos para cada categoria.

Compare o **planejado** (limite definido) com o **realizado** (gastos efetivos).

Isso ajuda a:
- Controlar gastos excessivos
- Identificar onde economizar
- Planejar o mês financeiramente
      `
    },
    {
      title: 'Configurar Orçamento',
      content: `
Para cada categoria, defina:

- **Valor Planejado**: Quanto você pretende gastar
- **Alertas**: Receba notificação ao atingir X%

*Categorias sem orçamento definido aparecem em cinza.*
      `
    },
    {
      title: 'Planejado vs Realizado',
      content: `
A barra de progresso mostra:

- **Verde**: Gasto abaixo do planejado
- **Amarelo**: Gasto próximo do limite (80-100%)
- **Vermelho**: Gasto acima do limite

*O valor excedente aparece destacado em vermelho.*
      `
    },
    {
      title: 'Copiar Mês Anterior',
      content: `
Use "Copiar do mês anterior" para replicar o orçamento.

Isso é útil quando seu orçamento mensal é similar.

*Você pode ajustar valores individualmente após copiar.*
      `
    }
  ],
  tips: [
    'Comece com valores realistas baseados nos gastos anteriores',
    'Revise o orçamento mensalmente',
    'Priorize categorias essenciais',
    'Use os Insights para sugestões de ajuste'
  ],
  relatedPages: [
    { title: 'Transações', path: '/transactions' },
    { title: 'Insights', path: '/insights' },
    { title: 'Metas', path: '/goals' }
  ]
}
