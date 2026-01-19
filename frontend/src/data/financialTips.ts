/**
 * Financial Tips Database
 *
 * Contextual tips shown to users based on their current page/action.
 */

export interface FinancialTip {
  id: string
  contexts: string[]  // Pages or actions where this tip should appear
  title: string
  content: string
  link?: string
  icon?: string
  category: 'basic' | 'intermediate' | 'advanced'
  priority: number  // Higher = shown first
}

export const financialTips: FinancialTip[] = [
  // Budget-related tips
  {
    id: 'budget-50-30-20',
    contexts: ['budget', 'budget-create'],
    title: 'Regra 50-30-20',
    content: 'Divida sua renda em 50% para necessidades, 30% para desejos e 20% para poupança/investimentos. É uma base simples para começar.',
    category: 'basic',
    priority: 10,
  },
  {
    id: 'budget-review-monthly',
    contexts: ['budget'],
    title: 'Revise mensalmente',
    content: 'Orçamentos não são fixos. Revise e ajuste seu orçamento todo mês com base nos gastos reais.',
    category: 'basic',
    priority: 8,
  },
  {
    id: 'budget-envelope-method',
    contexts: ['envelopes', 'envelope-create'],
    title: 'Método dos Envelopes',
    content: 'O método envelope divide seu dinheiro em categorias específicas. Quando o envelope esvazia, você para de gastar naquela categoria.',
    category: 'basic',
    priority: 9,
  },

  // Debt-related tips
  {
    id: 'debt-snowball',
    contexts: ['debts', 'simulators-debt'],
    title: 'Método Bola de Neve',
    content: 'Pague primeiro as dívidas menores para ganhar motivação. Estudos mostram que esse método aumenta as chances de quitar todas as dívidas.',
    category: 'intermediate',
    priority: 10,
  },
  {
    id: 'debt-avalanche',
    contexts: ['debts', 'simulators-debt'],
    title: 'Método Avalanche',
    content: 'Pague primeiro as dívidas com maior taxa de juros. Matematicamente, você paga menos juros no total.',
    category: 'intermediate',
    priority: 9,
  },
  {
    id: 'debt-avoid-minimum',
    contexts: ['debts', 'credit-cards'],
    title: 'Evite o mínimo do cartão',
    content: 'Pagar apenas o mínimo do cartão pode resultar em juros de mais de 400% ao ano. Priorize quitar o valor total.',
    category: 'basic',
    priority: 10,
  },
  {
    id: 'debt-cet-important',
    contexts: ['debts', 'debt-create'],
    title: 'Entenda o CET',
    content: 'O Custo Efetivo Total (CET) inclui todos os custos de um empréstimo, não apenas os juros. Compare o CET, não a taxa anunciada.',
    category: 'intermediate',
    priority: 8,
  },

  // Goals-related tips
  {
    id: 'goals-emergency-fund',
    contexts: ['goals', 'simulators-emergency'],
    title: 'Reserva de Emergência',
    content: 'Especialistas recomendam ter 3 a 6 meses de despesas guardados para emergências. Comece com 1 mês e vá aumentando.',
    category: 'basic',
    priority: 10,
  },
  {
    id: 'goals-pnif',
    contexts: ['goals', 'simulators'],
    title: 'PNIF - Patrimônio Necessário',
    content: 'Gustavo Cerbasi sugere que seu patrimônio ideal é sua renda anual multiplicada pela sua idade e dividido por 10.',
    category: 'advanced',
    priority: 7,
  },
  {
    id: 'goals-automation',
    contexts: ['goals', 'automations'],
    title: 'Automatize seus aportes',
    content: 'Configure transferências automáticas para suas metas logo após receber o salário. "Pague-se primeiro" funciona.',
    category: 'intermediate',
    priority: 9,
  },

  // Credit Card tips
  {
    id: 'credit-card-closing-date',
    contexts: ['credit-cards', 'invoices'],
    title: 'Data de fechamento',
    content: 'Compras feitas logo após o fechamento da fatura só são cobradas no mês seguinte. Use isso a seu favor.',
    category: 'intermediate',
    priority: 8,
  },
  {
    id: 'credit-card-limit-usage',
    contexts: ['credit-cards'],
    title: 'Uso do limite',
    content: 'Mantenha o uso abaixo de 30% do limite do cartão. Isso ajuda seu score de crédito e evita descontrole.',
    category: 'basic',
    priority: 9,
  },

  // Transaction tips
  {
    id: 'transactions-categorize',
    contexts: ['transactions', 'weekly-review'],
    title: 'Categorize tudo',
    content: 'Categorizar transações permite identificar padrões de gastos. Separe 5 minutos por semana para isso.',
    category: 'basic',
    priority: 8,
  },
  {
    id: 'transactions-small-expenses',
    contexts: ['transactions', 'insights'],
    title: 'Pequenos gastos somam',
    content: 'Um café de R$10 por dia útil são R$200/mês ou R$2.400/ano. Pequenos gastos recorrentes fazem diferença.',
    category: 'basic',
    priority: 9,
  },

  // Investment tips
  {
    id: 'invest-compound-interest',
    contexts: ['goals', 'simulators'],
    title: 'Juros compostos',
    content: 'Einstein chamou os juros compostos de "a força mais poderosa do universo". Comece cedo, mesmo com pouco.',
    category: 'intermediate',
    priority: 10,
  },
  {
    id: 'invest-diversification',
    contexts: ['accounts'],
    title: 'Diversificação',
    content: 'Não coloque todos os ovos na mesma cesta. Diversifique entre renda fixa, variável e reserva de emergência.',
    category: 'intermediate',
    priority: 7,
  },

  // General tips
  {
    id: 'general-track-everything',
    contexts: ['dashboard', 'transactions'],
    title: 'Registre tudo',
    content: 'O primeiro passo para melhorar suas finanças é saber para onde vai seu dinheiro. Registre todas as transações.',
    category: 'basic',
    priority: 10,
  },
  {
    id: 'general-needs-vs-wants',
    contexts: ['budget', 'transactions'],
    title: 'Necessidades vs Desejos',
    content: 'Antes de comprar, pergunte: "Preciso disso ou quero isso?" Esperar 24h antes de compras não essenciais ajuda.',
    category: 'basic',
    priority: 8,
  },
  {
    id: 'general-review-subscriptions',
    contexts: ['recurring'],
    title: 'Revise assinaturas',
    content: 'Revise suas assinaturas trimestralmente. Aquela que você não usa há meses pode estar drenando seu orçamento.',
    category: 'basic',
    priority: 9,
  },
  {
    id: 'general-inflation',
    contexts: ['goals', 'simulators'],
    title: 'Considere a inflação',
    content: 'Dinheiro parado perde valor com a inflação. Mesmo a poupança deve render acima da inflação.',
    category: 'intermediate',
    priority: 7,
  },

  // Calendar tips
  {
    id: 'calendar-plan-ahead',
    contexts: ['calendar', 'cash-calendar'],
    title: 'Planeje com antecedência',
    content: 'Visualizar despesas futuras ajuda a evitar surpresas. Use o calendário para antecipar meses difíceis.',
    category: 'basic',
    priority: 8,
  },

  // Automation tips
  {
    id: 'automation-pay-yourself',
    contexts: ['automations', 'automation-create'],
    title: 'Pague-se primeiro',
    content: 'Configure uma automação para transferir uma porcentagem do salário para poupança assim que cair na conta.',
    category: 'intermediate',
    priority: 10,
  },

  // Review tips
  {
    id: 'review-weekly-habit',
    contexts: ['weekly-review'],
    title: 'Hábito semanal',
    content: 'Dedicar 5-10 minutos por semana para revisar suas finanças pode evitar surpresas no fim do mês.',
    category: 'basic',
    priority: 9,
  },
]

/**
 * Get tips for a specific context
 */
export function getTipsForContext(context: string, limit: number = 3): FinancialTip[] {
  return financialTips
    .filter(tip => tip.contexts.includes(context))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
}

/**
 * Get a random tip for a context
 */
export function getRandomTip(context: string): FinancialTip | null {
  const contextTips = financialTips.filter(tip => tip.contexts.includes(context))
  if (contextTips.length === 0) return null
  return contextTips[Math.floor(Math.random() * contextTips.length)]
}
