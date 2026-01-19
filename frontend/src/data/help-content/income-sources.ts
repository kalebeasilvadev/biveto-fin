import type { HelpContent } from './types'

export const incomeSourcesHelp: HelpContent = {
  pageId: 'income-sources',
  pageTitle: 'Fontes de Receita',
  description: 'Cadastre e acompanhe suas fontes de renda.',
  sections: [
    {
      title: 'Tipos de Receita',
      content: `
Organize suas fontes de renda por tipo:

- **Salário**: Renda do trabalho CLT
- **Freelance**: Trabalhos autônomos
- **Investimentos**: Dividendos, juros, aluguéis
- **Benefícios**: Vale-alimentação, auxílios
- **Outros**: Qualquer outra fonte

*Cada tipo ajuda a entender sua composição de renda.*
      `
    },
    {
      title: 'Frequência de Recebimento',
      content: `
Defina quando você recebe:

- **Mensal**: Mesmo dia todo mês
- **Quinzenal**: A cada 15 dias
- **Semanal**: Toda semana
- **Variável**: Sem data fixa

*Receitas mensais são usadas para projeções.*
      `
    },
    {
      title: 'Benefícios e Descontos',
      content: `
Para salários, registre também:

- **Salário Bruto**: Valor antes dos descontos
- **Descontos**: INSS, IR, plano de saúde
- **Benefícios**: VA, VR, VT, PLR

*O sistema calcula o valor líquido automaticamente.*
      `
    },
    {
      title: 'Projeção de Receitas',
      content: `
Baseado nas suas fontes, o sistema projeta:

- Receita esperada do mês
- Receita anual estimada
- Variação mês a mês

*Útil para planejamento financeiro.*
      `
    }
  ],
  tips: [
    'Cadastre todas as fontes, mesmo as pequenas',
    'Atualize valores quando houver reajuste',
    'Use para calcular quanto pode poupar',
    'Compare receita vs despesas no Dashboard'
  ],
  relatedPages: [
    { title: 'Dashboard', path: '/' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Recorrentes', path: '/recurring' }
  ]
}
