import type { HelpContent } from './types'

export const transactionsHelp: HelpContent = {
  pageId: 'transactions',
  pageTitle: 'Transações',
  description: 'Gerencie todas as suas receitas e despesas.',
  sections: [
    {
      title: 'Lista de Transações',
      content: `
Todas as suas transações aparecem organizadas por data.

Cada transação mostra:
- **Descrição**: Nome da transação
- **Categoria**: Classificação do gasto/receita
- **Conta/Cartão**: De onde saiu ou entrou o dinheiro
- **Valor**: Positivo (verde) para receitas, negativo (vermelho) para despesas
      `
    },
    {
      title: 'Filtros e Busca',
      content: `
Use os filtros para encontrar transações específicas:

- **Período**: Selecione mês e ano
- **Tipo**: Receita ou Despesa
- **Categoria**: Filtre por categoria específica
- **Conta**: Filtre por conta ou cartão
- **Busca**: Digite parte da descrição

*Os filtros podem ser combinados.*
      `
    },
    {
      title: 'Editar Transação',
      content: `
Clique em qualquer transação para abrir o formulário de edição.

Você pode alterar:
- Descrição
- Valor
- Data
- Categoria
- Conta ou cartão
- Marcar como pago/pendente

*Transações de cartão de crédito aparecem na fatura do período.*
      `
    },
    {
      title: 'Exportar Dados',
      content: `
Use o botão de exportação para baixar suas transações em formato CSV.

O arquivo pode ser aberto no Excel ou Google Sheets para análises personalizadas.
      `
    }
  ],
  tips: [
    'Use a busca para encontrar transações rapidamente',
    'Mantenha as categorias corretas para relatórios precisos',
    'Revise transações sem categoria periodicamente'
  ],
  relatedPages: [
    { title: 'Categorias', path: '/budget' },
    { title: 'Contas', path: '/accounts' },
    { title: 'Cartões', path: '/credit-cards' }
  ]
}
