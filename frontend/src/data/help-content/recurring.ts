import type { HelpContent } from './types'

export const recurringHelp: HelpContent = {
  pageId: 'recurring',
  pageTitle: 'Recorrentes',
  description: 'Gerencie transações que se repetem automaticamente.',
  sections: [
    {
      title: 'O que são Recorrentes',
      content: `
Transações recorrentes são despesas ou receitas que acontecem regularmente:

- **Despesas**: Aluguel, streaming, academia, seguros
- **Receitas**: Salário, aluguel recebido, pensão

*O sistema cria as transações automaticamente nas datas configuradas.*
      `
    },
    {
      title: 'Configurar Frequência',
      content: `
Defina quando a transação se repete:

- **Diária**: Todo dia
- **Semanal**: Mesmo dia da semana
- **Mensal**: Mesmo dia do mês
- **Anual**: Mesmo dia do ano

*Você também define a data de início e fim (opcional).*
      `
    },
    {
      title: 'Pausar e Retomar',
      content: `
Pause temporariamente uma recorrente sem excluí-la:

- **Pausar**: Para de gerar novas transações
- **Retomar**: Volta a gerar normalmente

*Útil para assinaturas temporariamente canceladas.*
      `
    },
    {
      title: 'Geração Automática',
      content: `
As transações são criadas automaticamente:

- No início de cada período
- Com status "pendente"
- Na conta/cartão configurado

*Você pode editar ou excluir transações individuais sem afetar as futuras.*
      `
    }
  ],
  tips: [
    'Cadastre todas as assinaturas para não esquecer',
    'Revise periodicamente se ainda usa os serviços',
    'Configure na conta/cartão correto',
    'Use para salário e receitas fixas também'
  ],
  relatedPages: [
    { title: 'Transações', path: '/transactions' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Calendário', path: '/calendar' }
  ]
}
