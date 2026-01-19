import type { HelpContent } from './types'

export const insightsHelp: HelpContent = {
  pageId: 'insights',
  pageTitle: 'Insights',
  description: 'Análises e recomendações personalizadas para suas finanças.',
  sections: [
    {
      title: 'O que são Insights',
      content: `
Insights são análises automáticas que identificam:

- Padrões nos seus gastos
- Oportunidades de economia
- Alertas importantes
- Sugestões de melhoria

*O sistema analisa seus dados e gera recomendações personalizadas.*
      `
    },
    {
      title: 'Tipos de Insights',
      content: `
Os insights são organizados por tipo:

- **Alertas**: Situações que precisam de atenção urgente
- **Economia**: Oportunidades de reduzir gastos
- **Tendências**: Mudanças no seu comportamento
- **Conquistas**: Metas atingidas e progressos

*Cada tipo tem prioridade e ações sugeridas.*
      `
    },
    {
      title: 'Ações Sugeridas',
      content: `
Cada insight pode ter ações:

- **Ver detalhes**: Ir para a tela relacionada
- **Criar meta**: Transformar sugestão em meta
- **Ajustar orçamento**: Modificar limites
- **Ignorar**: Marcar como não relevante

*Ações executadas atualizam o insight automaticamente.*
      `
    },
    {
      title: 'Exemplos de Insights',
      content: `
Alguns insights que você pode receber:

- "Gastos com delivery aumentaram 40% este mês"
- "Você pode economizar R$ 200 cancelando assinaturas não usadas"
- "Parabéns! Você economizou R$ 500 em Alimentação"
- "Fatura do cartão X vence em 3 dias"

*Insights são gerados diariamente baseados nos seus dados.*
      `
    }
  ],
  tips: [
    'Verifique os insights regularmente',
    'Execute as ações sugeridas quando fizer sentido',
    'Use insights para ajustar seu comportamento',
    'Insights negativos são oportunidades de melhoria'
  ],
  relatedPages: [
    { title: 'Dashboard', path: '/' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Metas', path: '/goals' }
  ]
}
