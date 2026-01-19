import type { HelpContent } from './types'

export const weeklyReviewHelp: HelpContent = {
  pageId: 'weekly-review',
  pageTitle: 'Revisão Semanal',
  description: 'Revise e organize suas finanças semanalmente.',
  sections: [
    {
      title: 'Por que Fazer Revisão Semanal',
      content: `
A revisão semanal ajuda a:

- Manter transações categorizadas
- Identificar gastos esquecidos
- Corrigir erros rapidamente
- Manter o controle financeiro em dia

*Dedicar 15 minutos por semana evita acúmulo de pendências.*
      `
    },
    {
      title: 'O Wizard de Revisão',
      content: `
O assistente guia você por:

1. **Transações sem categoria**: Categorize uma a uma
2. **Transações duplicadas**: Identifique e remova
3. **Valores suspeitos**: Revise transações incomuns
4. **Resumo da semana**: Veja totais e comparações

*Cada passo pode ser pulado se não houver pendências.*
      `
    },
    {
      title: 'Categorização Rápida',
      content: `
Para cada transação sem categoria:

- Veja descrição e valor
- Escolha a categoria correta
- Use sugestões baseadas no histórico
- Pule se não souber (revise depois)

*O sistema aprende com suas escolhas para sugerir melhor.*
      `
    },
    {
      title: 'Comparação Semanal',
      content: `
Ao final da revisão, veja:

- Total de receitas e despesas da semana
- Comparação com semana anterior
- Categorias com maior variação
- Progresso do orçamento mensal

*Use para ajustar gastos na próxima semana.*
      `
    }
  ],
  tips: [
    'Faça a revisão no mesmo dia toda semana',
    'Configure um lembrete semanal',
    'Não deixe acumular mais de 2 semanas',
    'Use o celular para revisões rápidas'
  ],
  relatedPages: [
    { title: 'Transações', path: '/transactions' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Insights', path: '/insights' }
  ]
}
