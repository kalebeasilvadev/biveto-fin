import type { HelpContent } from './types'

export const onboardingHelp: HelpContent = {
  pageId: 'onboarding',
  pageTitle: 'Primeiros Passos',
  description: 'Configure o Biveto para começar a usar.',
  sections: [
    {
      title: 'Bem-vindo ao Biveto',
      content: `
O onboarding guia você pelos primeiros passos:

1. Criar suas contas bancárias
2. Adicionar cartões de crédito
3. Cadastrar receitas recorrentes
4. Definir orçamento inicial

*Complete cada passo para aproveitar melhor o app.*
      `
    },
    {
      title: 'Passo 1: Contas',
      content: `
Comece cadastrando onde seu dinheiro está:

- Contas bancárias
- Carteiras
- Investimentos

*Informe o saldo atual de cada conta.*
      `
    },
    {
      title: 'Passo 2: Cartões',
      content: `
Cadastre seus cartões de crédito:

- Nome e bandeira
- Limite disponível
- Dias de fechamento e vencimento

*Isso permite controlar faturas automaticamente.*
      `
    },
    {
      title: 'Passo 3: Receitas',
      content: `
Informe suas fontes de renda:

- Salário
- Freelance
- Outros rendimentos

*O sistema usa isso para projeções.*
      `
    },
    {
      title: 'Passo 4: Orçamento',
      content: `
Defina limites para cada categoria:

- Baseie-se em gastos passados
- Ou defina metas de economia
- Ajuste conforme necessário

*Você pode pular e configurar depois.*
      `
    }
  ],
  tips: [
    'Complete todos os passos para melhor experiência',
    'Você pode ajustar tudo depois',
    'Seja preciso com saldos iniciais',
    'Use valores aproximados se não souber exatos'
  ],
  relatedPages: [
    { title: 'Dashboard', path: '/' },
    { title: 'Contas', path: '/accounts' },
    { title: 'Cartões', path: '/credit-cards' }
  ]
}
