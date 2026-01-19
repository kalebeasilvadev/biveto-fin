import type { HelpContent } from './types'

export const creditCardsHelp: HelpContent = {
  pageId: 'credit-cards',
  pageTitle: 'Cartões de Crédito',
  description: 'Gerencie seus cartões e acompanhe limites e faturas.',
  sections: [
    {
      title: 'Cadastrar Cartão',
      content: `
Ao criar um cartão, informe:

- **Nome**: Identificação do cartão (ex: Nubank, Inter)
- **Bandeira**: Visa, Mastercard, Elo, etc.
- **Limite**: Valor total disponível
- **Dia de Fechamento**: Dia do mês em que a fatura fecha
- **Dia de Vencimento**: Dia do mês para pagamento

*O sistema calcula automaticamente a fatura de cada período.*
      `
    },
    {
      title: 'Limite e Uso',
      content: `
Acompanhe o uso do seu limite:

- **Limite Total**: Valor máximo do cartão
- **Usado**: Soma das compras não pagas
- **Disponível**: Limite menos o usado

*A barra de progresso mostra visualmente o uso do limite.*
      `
    },
    {
      title: 'Faturas',
      content: `
Cada cartão gera faturas mensais automaticamente.

A fatura inclui:
- Compras do período de fechamento
- Parcelas de compras parceladas
- Assinaturas recorrentes

*Acesse "Ver Faturas" para detalhes de cada período.*
      `
    },
    {
      title: 'Pontos e Benefícios',
      content: `
Registre os pontos acumulados do seu cartão.

Use essa informação para:
- Acompanhar acúmulo de pontos
- Decidir qual cartão usar
- Planejar resgates
      `
    }
  ],
  tips: [
    'Configure o dia de fechamento corretamente para faturas precisas',
    'Use cartões diferentes para tipos de compra',
    'Acompanhe o limite disponível antes de grandes compras'
  ],
  relatedPages: [
    { title: 'Faturas', path: '/invoices' },
    { title: 'Transações', path: '/transactions' },
    { title: 'Contas', path: '/accounts' }
  ]
}
