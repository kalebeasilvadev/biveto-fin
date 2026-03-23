import api from './api'

export const budgetsApi = {
  get: (year: number, month: number) =>
    api.get(`/budgets/${year}/${month}`),
  addItem: (year: number, month: number, data: unknown) =>
    api.post(`/budgets/${year}/${month}/items`, data),
  updateItem: (year: number, month: number, itemId: number, data: unknown) =>
    api.put(`/budgets/${year}/${month}/items/${itemId}`, data),
  deleteItem: (year: number, month: number, itemId: number) =>
    api.delete(`/budgets/${year}/${month}/items/${itemId}`),
  copy: (data: unknown) => api.post('/budgets/copy', data),
  summary: (year: number) => api.get(`/budgets/summary/${year}`),
  comparison: (year: number, month: number) =>
    api.get(`/budgets/comparison/${year}/${month}`),
  transfer: (year: number, month: number, data: { from_category_id: number; to_category_id: number; amount: number; notes?: string }) =>
    api.post(`/budgets/transfer`, data, { params: { year, month } }),
  getItemHistory: (year: number, month: number, categoryId: number, limit = 50) =>
    api.get(`/budgets/items/${categoryId}/history`, { params: { year, month, limit } }),
}

export const goalsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/goals', { params }),
  create: (data: unknown) => api.post('/goals', data),
  get: (id: number) => api.get(`/goals/${id}`),
  update: (id: number, data: unknown) => api.patch(`/goals/${id}`, data),
  delete: (id: number) => api.delete(`/goals/${id}`),
  addContribution: (id: number, data: unknown) =>
    api.post(`/goals/${id}/contributions`, data),
  calculateEmergencyFund: () =>
    api.get('/goals/emergency-fund/calculate'),
  calculatePnif: (annualIncome: number, annualReturn: number) =>
    api.get('/goals/pnif/calculate', {
      params: { annual_income: annualIncome, annual_return: annualReturn }
    }),
}

export const debtsApi = {
  list: (status?: string) =>
    api.get('/debts', { params: status ? { status } : {} }),
  create: (data: unknown) => api.post('/debts', data),
  get: (id: number) => api.get(`/debts/${id}`),
  update: (id: number, data: unknown) => api.patch(`/debts/${id}`, data),
  delete: (id: number) => api.delete(`/debts/${id}`),
  addPayment: (id: number, data: unknown) =>
    api.post(`/debts/${id}/payments`, data),
  summary: () => api.get('/debts/summary'),
  snowball: (monthlyPayment: number) =>
    api.get('/debts/snowball', { params: { monthly_payment: monthlyPayment } }),
  avalanche: (monthlyPayment: number) =>
    api.get('/debts/avalanche', { params: { monthly_payment: monthlyPayment } }),
  compareStrategies: (monthlyPayment: number) =>
    api.get('/debts/compare-strategies', { params: { monthly_payment: monthlyPayment } }),
}

export const recurringApi = {
  list: (includeInactive?: boolean) =>
    api.get('/recurring', { params: includeInactive ? { include_inactive: true } : {} }),
  get: (id: number) => api.get(`/recurring/${id}`),
  create: (data: unknown) => api.post('/recurring', data),
  update: (id: number, data: unknown) => api.patch(`/recurring/${id}`, data),
  delete: (id: number) => api.delete(`/recurring/${id}`),
  pause: (id: number) => api.post(`/recurring/${id}/pause`),
  resume: (id: number) => api.post(`/recurring/${id}/resume`),
  summary: () => api.get('/recurring/summary'),
  generate: () => api.post('/recurring/generate'),
  createFromSuggestion: (data: {
    name: string
    amount: number
    account_id: number
    frequency?: string
    day_of_month?: number
    category_name?: string
    payment_method?: string
    credit_card_id?: number
  }) => api.post('/recurring/from-suggestion', data),
  batchCreateFromSuggestion: (items: Array<{
    name: string
    amount: number
    account_id: number
    frequency?: string
    day_of_month?: number
    category_name?: string
    payment_method?: string
    credit_card_id?: number
  }>) => api.post('/recurring/batch-from-suggestion', { items }),
}

export const chatApi = {
  sendMessage: (message: string, conversationId?: string) =>
    api.post('/chat', { message, conversation_id: conversationId }),
  getSuggestions: () => api.get('/chat/suggestions'),
}

export const incomeSourcesApi = {
  list: () => api.get('/income-sources'),
  get: (id: number) => api.get(`/income-sources/${id}`),
  create: (data: unknown) => api.post('/income-sources', data),
  update: (id: number, data: unknown) => api.patch(`/income-sources/${id}`, data),
  delete: (id: number) => api.delete(`/income-sources/${id}`),
  previewTransactions: (year: number, month: number) =>
    api.get(`/income-sources/preview-transactions?year=${year}&month=${month}`),
  generateTransactions: (data: {
    year: number
    month: number
    overwrite?: boolean
    source_ids?: number[]
    amount_overrides?: Array<{ source_id: number; amount: number }>
  }) => api.post('/income-sources/generate-transactions', data),
  generateSingleTransaction: (sourceId: number, data: { year: number; month: number; overwrite?: boolean }) =>
    api.post(`/income-sources/${sourceId}/generate-transaction`, data),
}

// Income Split Rules - Regras de divisao de receita (Dizimo, Poupanca, etc)
export const incomeSplitRulesApi = {
  list: (activeOnly: boolean = true) =>
    api.get('/income-split-rules', { params: { active_only: activeOnly } }),
  get: (id: number) => api.get(`/income-split-rules/${id}`),
  create: (data: {
    name: string
    split_type: 'percentage' | 'fixed'
    percentage?: number
    fixed_amount?: number
    category_id?: number
    description_template?: string
    priority?: number
  }) => api.post('/income-split-rules', data),
  update: (id: number, data: {
    name?: string
    split_type?: 'percentage' | 'fixed'
    percentage?: number
    fixed_amount?: number
    category_id?: number
    description_template?: string
    is_active?: boolean
    priority?: number
  }) => api.patch(`/income-split-rules/${id}`, data),
  delete: (id: number) => api.delete(`/income-split-rules/${id}`),
  preview: (data: { amount: number; rule_ids?: number[]; description?: string }) =>
    api.post('/income-split-rules/preview', data),
}

export const groceryApi = {
  // Products
  listProducts: (params?: { search?: string; category?: string; limit?: number; offset?: number }) =>
    api.get('/grocery/products', { params }),
  createProduct: (data: { name: string; category?: string; necessity_type?: string; default_unit?: string }) =>
    api.post('/grocery/products', data),
  updateProduct: (id: number, data: unknown) =>
    api.patch(`/grocery/products/${id}`, data),
  deleteProduct: (id: number) =>
    api.delete(`/grocery/products/${id}`),

  // Purchases
  listPurchases: (params?: {
    start_date?: string
    end_date?: string
    category?: string
    necessity_type?: string
    merchant_id?: number
    search?: string
    limit?: number
    offset?: number
  }) => api.get('/grocery/purchases', { params }),
  createPurchase: (data: unknown) =>
    api.post('/grocery/purchases', data),
  createPurchasesBulk: (data: unknown) =>
    api.post('/grocery/purchases/bulk', data),
  getPurchaseSummary: (month: number, year: number) =>
    api.get('/grocery/purchases/summary', { params: { month, year } }),
  getPurchaseComparison: (month: number, year: number) =>
    api.get('/grocery/purchases/comparison', { params: { month, year } }),
  updatePurchase: (id: number, data: unknown) =>
    api.patch(`/grocery/purchases/${id}`, data),
  deletePurchase: (id: number) =>
    api.delete(`/grocery/purchases/${id}`),

  // Shopping Lists
  listShoppingLists: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/grocery/lists', { params }),
  createShoppingList: (data: { name: string; notes?: string; items?: unknown[] }) =>
    api.post('/grocery/lists', data),
  generateShoppingList: (data: { period_days?: number; include_non_essential?: boolean; filter_non_grocery?: boolean; name?: string }) =>
    api.post('/grocery/lists/generate-smart', data),
  getShoppingList: (id: number) =>
    api.get(`/grocery/lists/${id}`),
  updateShoppingList: (id: number, data: unknown) =>
    api.patch(`/grocery/lists/${id}`, data),
  deleteShoppingList: (id: number) =>
    api.delete(`/grocery/lists/${id}`),

  // Shopping List Items
  addListItem: (listId: number, data: unknown) =>
    api.post(`/grocery/lists/${listId}/items`, data),
  updateListItem: (listId: number, itemId: number, data: unknown) =>
    api.patch(`/grocery/lists/${listId}/items/${itemId}`, data),
  deleteListItem: (listId: number, itemId: number) =>
    api.delete(`/grocery/lists/${listId}/items/${itemId}`),

  // Prices
  getPriceHistory: (productId: number, days?: number) =>
    api.get(`/grocery/prices/${productId}`, { params: days ? { days } : {} }),
  getCheapestPrices: (productIds?: string, limit?: number) =>
    api.get('/grocery/prices/cheapest', { params: { product_ids: productIds, limit } }),

  // Analytics
  getSpendingAnalytics: (params?: { start_date?: string; end_date?: string; granularity?: string }) =>
    api.get('/grocery/analytics/spending', { params }),
  getCategoryAnalytics: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/grocery/analytics/by-category', { params }),
  getNecessityAnalytics: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/grocery/analytics/by-necessity', { params }),
  getInsights: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/grocery/insights', { params }),
  getBudgetStatus: (month: number, year: number) =>
    api.get('/grocery/budget/status', { params: { month, year } }),

  // Backfill
  backfillPurchases: (data: { dry_run?: boolean; category_names?: string[] }) =>
    api.post('/grocery/backfill', data),
}

export const receiptsApi = {
  // Confirm receipt from document extraction
  confirm: (data: {
    document_id: number
    store_name: string
    store_cnpj?: string
    purchase_date: string
    total_amount: number
    subtotal?: number
    discount?: number
    items: Array<{
      description: string
      amount: number
      category_id?: number
      quantity?: number
      unit?: string
      unit_price?: number
    }>
    payments: Array<{
      payment_method: string
      amount: number
      account_id: number
      benefit_card_id?: number
      original_label?: string
      // Installment fields for credit card payments
      is_installment?: boolean
      installment_count?: number
      credit_card_id?: number
    }>
    default_category_id?: number
  }) => api.post('/receipts/confirm', data),

  // List receipts
  list: (params?: { limit?: number; offset?: number; status?: string }) =>
    api.get('/receipts', { params }),

  // Get receipt details
  get: (id: number) => api.get(`/receipts/${id}`),

  // Get receipt items (transactions)
  getItems: (id: number) => api.get(`/receipts/${id}/items`),

  // Update receipt
  update: (id: number, data: { store_name?: string; store_cnpj?: string; purchase_date?: string }) =>
    api.patch(`/receipts/${id}`, data),

  // Cancel receipt
  cancel: (id: number) => api.delete(`/receipts/${id}`),
}

// Gamification API
export const gamificationApi = {
  // Summary for dashboard
  getSummary: () => api.get('/gamification/summary'),

  // Streak week view for widget
  getStreakWeek: () => api.get('/gamification/streak/week'),

  // List all badges with user status
  getBadges: (category?: string) =>
    api.get('/gamification/badges', { params: category ? { category } : {} }),

  // Mark badges as seen
  markBadgesSeen: () => api.post('/gamification/badges/mark-seen'),

  // List challenges by status
  getChallenges: () => api.get('/gamification/challenges'),

  // Start a challenge
  startChallenge: (challengeId: number) =>
    api.post(`/gamification/challenges/${challengeId}/start`),

  // Get points history
  getPointsHistory: (limit = 20, offset = 0) =>
    api.get('/gamification/points/history', { params: { limit, offset } }),
}
