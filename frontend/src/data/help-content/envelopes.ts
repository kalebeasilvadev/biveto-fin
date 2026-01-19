import type { HelpContent } from './types'

export const envelopesHelp: HelpContent = {
  pageId: 'envelopes',
  pageTitle: 'Envelopes',
  description: 'Sistema de orçamento por envelopes virtuais.',
  sections: [
    {
      title: 'O que é o Método dos Envelopes',
      content: `
O método dos envelopes é uma técnica de orçamento onde você:

1. Separa dinheiro em "envelopes" virtuais por categoria
2. Gasta apenas o que está no envelope
3. Quando acaba, para de gastar naquela categoria

*É como ter vários cofrinhos, um para cada tipo de gasto.*
      `
    },
    {
      title: 'Criar Envelopes',
      content: `
Para cada envelope, defina:

- **Nome**: Categoria de gasto (ex: Alimentação, Lazer)
- **Valor Mensal**: Quanto separar por mês
- **Cor**: Para identificação visual

*No início do mês, o valor é "depositado" no envelope.*
      `
    },
    {
      title: 'Usar os Envelopes',
      content: `
Ao registrar uma transação:

1. Selecione o envelope correspondente
2. O valor é descontado do envelope
3. Acompanhe o saldo restante

*Transações sem envelope são consideradas "extras".*
      `
    },
    {
      title: 'Rollover (Acumular Saldo)',
      content: `
Configure se o saldo não usado passa para o próximo mês:

- **Com Rollover**: Saldo acumula (útil para gastos variáveis)
- **Sem Rollover**: Saldo zera todo mês (força uso consciente)

*Exemplo: Envelope "Presentes" pode acumular para o Natal.*
      `
    }
  ],
  tips: [
    'Comece com poucos envelopes e aumente conforme necessário',
    'Envelopes funcionam melhor para gastos variáveis',
    'Revise os valores mensalmente',
    'Use junto com o Orçamento por categorias'
  ],
  relatedPages: [
    { title: 'Orçamento', path: '/budget' },
    { title: 'Transações', path: '/transactions' },
    { title: 'Metas', path: '/goals' }
  ]
}
