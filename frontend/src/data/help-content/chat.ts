import type { HelpContent } from './types'

export const chatHelp: HelpContent = {
  pageId: 'chat',
  pageTitle: 'Assistente Financeiro',
  description: 'Converse com a IA para tirar dúvidas e obter insights.',
  sections: [
    {
      title: 'O que o Assistente Pode Fazer',
      content: `
O assistente de IA pode ajudar com:

- **Perguntas**: "Quanto gastei com alimentação esse mês?"
- **Análises**: "Compare meus gastos de janeiro e fevereiro"
- **Dicas**: "Como posso economizar mais?"
- **Explicações**: "O que é reserva de emergência?"

*Use linguagem natural, como se estivesse conversando.*
      `
    },
    {
      title: 'Fazendo Perguntas',
      content: `
Exemplos de perguntas que funcionam bem:

- "Qual meu saldo total em todas as contas?"
- "Quais foram minhas maiores despesas do mês?"
- "Estou dentro do orçamento de alimentação?"
- "Quanto falta para minha meta de viagem?"

*O assistente acessa seus dados para responder.*
      `
    },
    {
      title: 'Histórico de Conversas',
      content: `
Suas conversas são salvas:

- Acesse conversas anteriores
- Continue de onde parou
- Busque por assuntos específicos

*O histórico ajuda o assistente a entender o contexto.*
      `
    },
    {
      title: 'Sugestões de Perguntas',
      content: `
Não sabe o que perguntar? Use as sugestões:

- Aparecem baseadas nos seus dados
- Cobrem análises úteis
- São atualizadas regularmente

*Clique em uma sugestão para enviar automaticamente.*
      `
    }
  ],
  tips: [
    'Seja específico nas perguntas para respostas melhores',
    'Use o assistente para aprender sobre finanças',
    'Peça explicações quando não entender algo',
    'O assistente não executa ações, apenas informa'
  ],
  relatedPages: [
    { title: 'Dashboard', path: '/' },
    { title: 'Insights', path: '/insights' },
    { title: 'Transações', path: '/transactions' }
  ]
}
