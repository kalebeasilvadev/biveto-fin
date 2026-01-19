import type { HelpContent } from './types'

export const simulatorsHelp: HelpContent = {
  pageId: 'simulators',
  pageTitle: 'Simuladores',
  description: 'Ferramentas para planejar seu futuro financeiro.',
  sections: [
    {
      title: 'Simulador de Quitação de Dívidas',
      content: `
Calcule quanto tempo levará para quitar suas dívidas:

- Insira o valor total das dívidas
- Defina quanto pode pagar por mês
- Veja quando estará livre das dívidas

*Compare os métodos Snowball e Avalanche.*
      `
    },
    {
      title: 'Simulador de Reserva de Emergência',
      content: `
Descubra quanto guardar e em quanto tempo:

- Baseado nas suas despesas mensais
- Meta: 6 a 12 meses de despesas
- Calcule contribuições mensais necessárias

*A reserva é sua proteção contra imprevistos.*
      `
    },
    {
      title: 'Simulador de Independência Financeira',
      content: `
Calcule seu número para independência financeira:

- Despesas mensais × 300 (regra dos 4%)
- Quanto já tem investido
- Quanto precisa investir por mês

*Descubra quando poderá viver de renda passiva.*
      `
    },
    {
      title: 'Usando os Resultados',
      content: `
Os simuladores ajudam a:

- Definir metas realistas
- Ajustar orçamento
- Tomar decisões financeiras

*Os cálculos são estimativas - resultados reais podem variar.*
      `
    }
  ],
  tips: [
    'Use valores realistas nas simulações',
    'Refaça as simulações periodicamente',
    'Transforme resultados em metas no sistema',
    'Considere inflação em planos de longo prazo'
  ],
  relatedPages: [
    { title: 'Metas', path: '/goals' },
    { title: 'Dívidas', path: '/debts' },
    { title: 'Orçamento', path: '/budget' }
  ]
}
