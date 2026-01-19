/**
 * Test Data Fixtures
 * Centralized test data for E2E tests
 */

export const TEST_CREDENTIALS = {
  email: process.env.E2E_USER_EMAIL || 'teste@biveto.com',
  password: process.env.E2E_USER_PASSWORD || 'Teste@123',
}

export const INVALID_CREDENTIALS = {
  email: 'teste@biveto.com',
  password: 'senhaerrada123',
}

export const TEST_ACCOUNT = {
  name: 'Conta Teste E2E',
  nameEdited: 'Conta Teste E2E Editada',
  type: 'wallet' as const,
  typeLabel: 'Carteira',
  balance: '1000',
  balanceFormatted: 'R$ 1.000,00',
  color: '#22c55e',
}

export const TEST_CREDIT_CARD = {
  name: 'Cartão Teste E2E',
  limit: '5000',
  limitFormatted: 'R$ 5.000,00',
  closingDay: '10',
  dueDay: '20',
  color: '#3b82f6',
}

export const TEST_TRANSACTION = {
  description: 'Transação Teste E2E',
  descriptionEdited: 'Transação Teste E2E Editada',
  amount: '150',
  amountEdited: '200',
  amountFormatted: 'R$ 150,00',
  category: 'Supermercado',  // Matches actual API category name
  type: 'expense' as const,
}

export const TEST_GOAL = {
  name: 'Meta Teste E2E',
  nameEdited: 'Meta Teste E2E Editada',
  target: '10000',
  targetFormatted: 'R$ 10.000,00',
  contribution: '500',
  contributionFormatted: 'R$ 500,00',
}

export const TEST_DEBT = {
  name: 'Dívida Teste E2E',
  originalValue: '5000',
  currentBalance: '4500',
  interestRate: '2',
  creditor: 'Banco X',
  payment: '500',
}

export const TEST_RECURRING = {
  name: 'Netflix Teste E2E',
  nameEdited: 'Netflix Teste E2E Editada',
  amount: '55.90',
  amountEdited: '65.90',
  frequency: 'monthly' as const,
  day: '15',
  type: 'expense' as const,
}

export const TEST_INCOME_SOURCE = {
  name: 'Salário Teste E2E',
  type: 'salary' as const,
  typeLabel: 'Salário',
  expectedAmount: '8000',
  frequency: 'monthly' as const,
  day: '5',
}

export const TEST_ENVELOPE = {
  name: 'Alimentação Envelope E2E',
  limit: '1500',
  period: 'monthly' as const,
  allowRollover: true,
  transfer: '200',
}

export const TEST_AUTOMATION = {
  name: 'Automação Teste E2E',
  triggerType: 'scheduled' as const,
  actionType: 'transfer' as const,
  amount: '100',
}

export const TEST_BUDGET_ITEM = {
  category: 'Lazer',
  planned: '500',
  plannedFormatted: 'R$ 500,00',
}

export const TEST_FAMILY = {
  inviteEmail: 'membro.teste@biveto.com',
}

// Account types for selection
export const ACCOUNT_TYPES = [
  { value: 'wallet', label: 'Carteira' },
  { value: 'bank', label: 'Banco' },
  { value: 'investment', label: 'Investimento' },
]

// Common expense categories (matches API category names)
export const EXPENSE_CATEGORIES = [
  'Moradia',
  'Supermercado',
  'Transporte',
  'Saúde',
  'Educação',
  'Contas e Serviços',
  'Alimentação Fora',
  'Lazer',
  'Vestuário',
  'Beleza e Cuidados',
  'Assinaturas',
  'Compras Online',
  'Pet',
  'Filhos',
  'Presentes e Doações',
  'Impostos e Taxas',
  'Viagens',
  'Outros',
]

// Income categories
export const INCOME_CATEGORIES = [
  'Salário',
  'Freelance',
  'Investimentos',
  'Vendas',
  'Outros',
]

// Legacy alias
export const CATEGORIES = EXPENSE_CATEGORIES

// Viewports for responsive testing
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  mobileSmall: { width: 360, height: 800 },
  mobileMedium: { width: 390, height: 844 },
  mobileLarge: { width: 412, height: 915 },
  tablet: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
}

// All app pages for navigation tests
export const APP_PAGES = [
  { path: '/', name: 'Dashboard', title: 'Dashboard' },
  { path: '/transactions', name: 'Transações', title: 'Transações' },
  { path: '/accounts', name: 'Contas', title: 'Minhas Contas' },
  { path: '/credit-cards', name: 'Cartões', title: 'Cartões de Crédito' },
  { path: '/invoices', name: 'Faturas', title: 'Faturas' },
  { path: '/income-sources', name: 'Receitas', title: 'Fontes de Receita' },
  { path: '/budget', name: 'Orçamento', title: 'Orçamento' },
  { path: '/goals', name: 'Metas', title: 'Metas' },
  { path: '/debts', name: 'Dívidas', title: 'Dívidas' },
  { path: '/recurring', name: 'Recorrentes', title: 'Transações Recorrentes' },
  { path: '/calendar', name: 'Calendário', title: 'Calendário' },
  { path: '/envelopes', name: 'Envelopes', title: 'Envelopes' },
  { path: '/simulators', name: 'Simuladores', title: 'Simuladores' },
  { path: '/automations', name: 'Automações', title: 'Automações' },
  { path: '/weekly-review', name: 'Revisão', title: 'Revisão' },
  { path: '/upload', name: 'Adicionar', title: 'Adicionar' },
  { path: '/insights', name: 'Insights', title: 'Insights' },
  { path: '/chat', name: 'Assistente', title: 'Assistente' },
  { path: '/settings', name: 'Configurações', title: 'Configurações' },
  { path: '/family', name: 'Família', title: 'Família' },
]

// Sidebar navigation items (desktop)
export const SIDEBAR_NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transações' },
  { to: '/accounts', label: 'Contas' },
  { to: '/credit-cards', label: 'Cartões' },
  { to: '/invoices', label: 'Faturas' },
  { to: '/income-sources', label: 'Receitas' },
  { to: '/budget', label: 'Orçamento' },
  { to: '/goals', label: 'Metas' },
  { to: '/debts', label: 'Dívidas' },
  { to: '/recurring', label: 'Recorrentes' },
  { to: '/calendar', label: 'Calendário' },
  { to: '/envelopes', label: 'Envelopes' },
  { to: '/simulators', label: 'Simuladores' },
  { to: '/automations', label: 'Automações' },
  { to: '/weekly-review', label: 'Revisão' },
  { to: '/upload', label: 'Adicionar' },
  { to: '/insights', label: 'Insights' },
  { to: '/chat', label: 'Assistente' },
]

// Bottom navigation items (mobile)
export const BOTTOM_NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/transactions', label: 'Transações' },
  { to: '/upload', label: 'Adicionar' },
  { to: '/insights', label: 'Insights' },
  { to: '/chat', label: 'Chat' },
]

// Alias for ALL_PAGES (used in theme and mobile tests)
export const ALL_PAGES = APP_PAGES

// Mobile viewport constant
export const MOBILE_VIEWPORT = VIEWPORTS.mobile
