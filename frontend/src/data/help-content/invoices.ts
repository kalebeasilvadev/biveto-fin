import type { HelpContent } from './types'

export const invoicesHelp: HelpContent = {
  pageId: 'invoices',
  pageTitle: 'Faturas',
  description: 'Acompanhe e pague as faturas dos seus cartões.',
  sections: [
    {
      title: 'Lista de Faturas',
      content: `
Veja todas as faturas dos seus cartões organizadas por período.

Cada fatura mostra:
- **Cartão**: Qual cartão gerou a fatura
- **Período**: Mês/ano de referência
- **Valor**: Total da fatura
- **Vencimento**: Data limite para pagamento
- **Status**: Aberta, Fechada ou Paga
      `
    },
    {
      title: 'Status da Fatura',
      content: `
As faturas passam por 3 estados:

- **Aberta**: Período atual, ainda aceita novas compras
- **Fechada**: Período encerrado, aguardando pagamento
- **Paga**: Fatura quitada

*Faturas fechadas não pagas aparecem destacadas.*
      `
    },
    {
      title: 'Pagar Fatura',
      content: `
Para registrar o pagamento:

1. Clique na fatura fechada
2. Selecione "Pagar Fatura"
3. Escolha a conta de pagamento
4. Confirme o valor

*O pagamento cria uma transação de despesa na conta selecionada.*
      `
    },
    {
      title: 'Detalhes da Fatura',
      content: `
Clique em uma fatura para ver todas as transações incluídas:

- Compras à vista
- Parcelas de compras parceladas
- Assinaturas e recorrentes

*Você pode editar ou remover transações diretamente.*
      `
    }
  ],
  tips: [
    'Pague a fatura até o vencimento para evitar juros',
    'Verifique as transações antes de pagar',
    'Configure alertas de vencimento nas notificações'
  ],
  relatedPages: [
    { title: 'Cartões', path: '/credit-cards' },
    { title: 'Transações', path: '/transactions' },
    { title: 'Contas', path: '/accounts' }
  ]
}
