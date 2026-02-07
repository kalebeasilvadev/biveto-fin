import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'

// Mapeamento de mensagens de erro do FastAPI para português
const errorMessages: Record<string, string> = {
  'String should have at least 8 characters': 'A senha deve ter pelo menos 8 caracteres',
  'String should have at least 2 characters': 'O nome deve ter pelo menos 2 caracteres',
  'String should have at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  'value is not a valid email address': 'Email inválido',
  'Field required': 'Campo obrigatório',
  // Erros do backend de convite (com e sem acentos)
  'Convite nao encontrado': 'Convite não encontrado',
  'Convite não encontrado': 'Convite não encontrado',
  'Convite expirado': 'Este convite expirou',
  'Email ja cadastrado': 'Este email já está cadastrado',
  'Email já cadastrado': 'Este email já está cadastrado',
}

// Extrai mensagem de erro amigável do FastAPI
export function getApiErrorMessage(error: unknown, defaultMessage: string): string {
  // Verifica se é um erro de rede (sem resposta do servidor)
  const axiosErr = error as { response?: { data?: { detail?: unknown }; status?: number }; message?: string; code?: string }

  // Erro de rede ou servidor offline
  if (!axiosErr?.response) {
    if (axiosErr?.code === 'ERR_NETWORK' || axiosErr?.message?.includes('Network Error')) {
      return 'Erro de conexão. Verifique sua internet e tente novamente.'
    }
    if (axiosErr?.code === 'ECONNABORTED' || axiosErr?.message?.includes('timeout')) {
      return 'O servidor demorou para responder. Tente novamente.'
    }
    return defaultMessage
  }

  const detail = axiosErr.response.data?.detail

  // Se detail é uma string, traduz ou retorna diretamente
  if (typeof detail === 'string') {
    return errorMessages[detail] || detail
  }

  // Se detail é um objeto com message e errors (erro de validação de senha)
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const detailObj = detail as { message?: string; errors?: string[] }
    if (detailObj.errors && Array.isArray(detailObj.errors) && detailObj.errors.length > 0) {
      // Retorna o primeiro erro de senha
      return detailObj.errors[0]
    }
    if (detailObj.message) {
      return detailObj.message
    }
  }

  // Se detail é um array (erro de validação 422), extrai a primeira mensagem
  if (Array.isArray(detail) && detail.length > 0) {
    const firstError = detail[0]
    if (firstError?.msg) {
      // Tenta traduzir a mensagem
      return errorMessages[firstError.msg] || firstError.msg
    }
  }

  // Tratamento por status code
  const status = axiosErr.response?.status
  if (status) {
    if (status === 404) {
      return 'Recurso não encontrado'
    }
    if (status === 429) {
      return 'Muitas tentativas. Aguarde um momento e tente novamente.'
    }
    if (status >= 500) {
      return 'Erro no servidor. Tente novamente mais tarde.'
    }
  }

  return defaultMessage
}

// Em produção usa a URL completa, em dev usa proxy
// Se acessando via IP de rede local, usa URL direta do backend (porta 8000)
function getBaseURL(): string {
  const hostname = window.location.hostname

  // PRIMEIRO: Se estiver acessando via localtunnel (loca.lt)
  if (hostname.endsWith('.loca.lt')) {
    const backendHost = hostname.replace('biveto-app', 'biveto-api')
    return `https://${backendHost}/api/v1`
  }

  // Se estiver acessando via Cloudflare Tunnel (trycloudflare.com)
  if (hostname.endsWith('.trycloudflare.com')) {
    // Usar variável de ambiente ou URL hardcoded temporária para dev
    const cloudflareBackend = import.meta.env.VITE_CLOUDFLARE_BACKEND || 'https://oldest-guaranteed-being-incidence.trycloudflare.com'
    return `${cloudflareBackend}/api/v1`
  }

  // Se estiver acessando via IP de rede local, usa backend direto com HTTPS
  // Isso tem prioridade sobre VITE_API_URL para funcionar no celular
  const isLocalNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname)
  if (isLocalNetwork) {
    return `https://${hostname}:8000/api/v1`
  }

  // Se variável de ambiente definida (e não está em rede local), usa ela
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api/v1`
  }

  // Localhost ou produção: usa proxy ou caminho relativo
  return '/api/v1'
}

const baseURL = getBaseURL()

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Fila de requisições aguardando refresh do token
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: Error) => void
}> = []

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else if (token) {
      promise.resolve(token)
    }
  })
  failedQueue = []
}

// Interceptor para adicionar token e verificar expiração
api.interceptors.request.use(async (config) => {
  const store = useAuthStore.getState()
  const { accessToken, isTokenExpired, isRefreshTokenExpired } = store

  // Se não há token, continua sem header de autorização
  if (!accessToken) {
    return config
  }

  // Se o refresh token expirou, faz logout imediatamente
  if (isRefreshTokenExpired()) {
    store.logout()
    // Redireciona para login se não estiver lá
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
    return Promise.reject(new Error('Sessão expirada'))
  }

  // Se o access token está expirado mas o refresh ainda é válido, tenta renovar
  if (isTokenExpired() && !isRefreshing) {
    isRefreshing = true
    store.setIsRefreshing(true)

    try {
      const response = await axios.post(`${baseURL}/auth/refresh`, {
        refresh_token: store.refreshToken,
      })

      const { access_token, refresh_token } = response.data
      store.setTokens(access_token, refresh_token)
      processQueue(null, access_token)

      config.headers.Authorization = `Bearer ${access_token}`
    } catch (refreshError) {
      processQueue(refreshError as Error, null)
      store.logout()
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
      store.setIsRefreshing(false)
    }
  } else if (isTokenExpired() && isRefreshing) {
    // Se já está refreshando, adiciona à fila
    return new Promise((resolve, reject) => {
      failedQueue.push({
        resolve: (token: string) => {
          config.headers.Authorization = `Bearer ${token}`
          resolve(config)
        },
        reject: (err: Error) => {
          reject(err)
        },
      })
    }) as Promise<InternalAxiosRequestConfig>
  } else {
    // Token válido, adiciona ao header
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

// Rotas que não devem tentar refresh automático em caso de 401
const authRoutes = ['/auth/login', '/auth/register', '/auth/invite', '/auth/refresh', '/auth/reset-password']

const isAuthRoute = (url: string | undefined): boolean => {
  if (!url) return false
  return authRoutes.some(route => url.includes(route))
}

// Interceptor de resposta para tratar erros 401 inesperados
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const store = useAuthStore.getState()

    // Se é uma rota de autenticação, não tenta refresh - apenas retorna o erro
    if (isAuthRoute(originalRequest?.url)) {
      return Promise.reject(error)
    }

    // Se recebeu 401 e não é retry, tenta refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      // Se já está refreshando, adiciona à fila
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject: (err: Error) => {
              reject(err)
            },
          })
        })
      }

      // Se o refresh token já expirou, faz logout
      if (store.isRefreshTokenExpired()) {
        store.logout()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(new Error('Sessão expirada'))
      }

      isRefreshing = true
      store.setIsRefreshing(true)

      try {
        const response = await axios.post(`${baseURL}/auth/refresh`, {
          refresh_token: store.refreshToken,
        })

        const { access_token, refresh_token } = response.data
        store.setTokens(access_token, refresh_token)
        processQueue(null, access_token)

        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError as Error, null)
        store.logout()
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
        store.setIsRefreshing(false)
      }
    }

    return Promise.reject(error)
  }
)

export default api

// API endpoints
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
}

export const transactionsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/transactions', { params }),
  create: (data: unknown) => api.post('/transactions', data),
  confirm: (data: unknown) => api.post('/transactions/confirm', data),
  batchConfirm: (data: {
    items: unknown[]
    card_closing_day?: number
    card_due_day?: number
  }) => api.post('/transactions/batch-confirm', data),
  update: (id: number, data: unknown) => api.patch(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
  checkProjected: (data: {
    items: Array<{
      index: number
      description: string
      amount: number
      date?: string
      is_installment?: boolean
      installment_current?: number
      installment_total?: number
    }>
    credit_card_id?: number
    invoice_month?: number
    invoice_year?: number
  }) => api.post('/transactions/check-projected', data),
  exportCSV: async (params?: Record<string, unknown>) => {
    const response = await api.get('/transactions/export/csv', {
      params,
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    link.setAttribute('download', `transacoes_${date}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}

export const installmentsApi = {
  list: (params?: { status_filter?: string; limit?: number }) =>
    api.get('/installments', { params }),
  getById: (id: number) => api.get(`/installments/${id}`),
  detectDuplicates: (minSimilarity = 0.7) =>
    api.post('/installments/detect-duplicates', { min_similarity: minSimilarity }),
  merge: (data: {
    source_series_id: number
    target_series_id: number
    conflict_resolution?: string
    new_merchant_name?: string
  }) => api.post('/installments/merge', data),
  update: (id: number, data: {
    description?: string
    merchant_name?: string
    not_duplicate_with?: number[]
  }) => api.patch(`/installments/${id}`, data),
  getDuplicateWarnings: (invoiceId: number) =>
    api.get(`/invoices/${invoiceId}/duplicate-warnings`),
}

export const documentsApi = {
  upload: (file: File, password?: string, creditCardId?: number) => {
    const formData = new FormData()
    formData.append('file', file)
    if (password) formData.append('password', password)
    if (creditCardId) formData.append('credit_card_id', creditCardId.toString())
    return api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  // Upload async: retorna imediatamente com status "processing"
  uploadAsync: (file: File, password?: string, creditCardId?: number) => {
    const formData = new FormData()
    formData.append('file', file)
    if (password) formData.append('password', password)
    if (creditCardId) formData.append('credit_card_id', creditCardId.toString())
    return api.post('/documents/async', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadBatch: (files: File[]) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post('/documents/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: () => api.get('/documents'),
  get: (id: number) => api.get(`/documents/${id}`),
}

export const analyticsApi = {
  summary: (year: number, month: number) =>
    api.get('/analytics/summary', { params: { year, month } }),
  insights: (startDate: string, endDate: string) =>
    api.get('/analytics/insights', {
      params: { start_date: startDate, end_date: endDate },
    }),
}

export const accountsApi = {
  list: () => api.get('/accounts'),
  get: (id: number) => api.get(`/accounts/${id}`),
  create: (data: unknown) => api.post('/accounts', data),
  update: (id: number, data: unknown) => api.patch(`/accounts/${id}`, data),
  delete: (id: number) => api.delete(`/accounts/${id}`),
}

export const categoriesApi = {
  list: () => api.get('/categories'),
}

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

export const chatApi = {
  sendMessage: (message: string, conversationId?: string) =>
    api.post('/chat', { message, conversation_id: conversationId }),
  getSuggestions: () => api.get('/chat/suggestions'),
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

export const adminApi = {
  // Dashboard
  dashboard: () => api.get('/admin/dashboard'),

  // Users
  listUsers: () => api.get('/admin/users'),
  getUser: (id: number) => api.get(`/admin/users/${id}`),
  createUser: (data: unknown) => api.post('/admin/users', data),
  updateUser: (id: number, data: unknown) => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),

  // Licenses
  listLicenses: () => api.get('/admin/licenses'),
  createLicense: (data: unknown) => api.post('/admin/licenses', data),
  updateLicense: (id: number, data: unknown) => api.patch(`/admin/licenses/${id}`, data),
  deleteLicense: (id: number) => api.delete(`/admin/licenses/${id}`),
  resendLicenseInvitation: (licenseId: number) => api.post(`/admin/licenses/${licenseId}/resend-invitation`),

  // Invitations
  listInvitations: () => api.get('/admin/invitations'),
  resendInvitation: (id: number) => api.post(`/admin/invitations/${id}/resend`),
  cancelInvitation: (id: number) => api.delete(`/admin/invitations/${id}`),
}

export const familyApi = {
  // Contexto da familia
  getContext: () => api.get('/family/context'),

  // Membros
  listMembers: () => api.get('/family/members'),
  removeMember: (memberId: number) => api.delete(`/family/members/${memberId}`),

  // Convites
  invite: (email: string, nickname?: string) =>
    api.post('/family/invite', { email, nickname }),
  listInvitations: () => api.get('/family/invitations'),
  cancelInvitation: (id: number) => api.delete(`/family/invitations/${id}`),
  resendInvitation: (id: number) => api.post(`/family/invitations/${id}/resend`),
}

export const creditCardsApi = {
  list: () => api.get('/credit-cards'),
  get: (id: number) => api.get(`/credit-cards/${id}`),
  create: (data: unknown) => api.post('/credit-cards', data),
  update: (id: number, data: unknown) => api.patch(`/credit-cards/${id}`, data),
  delete: (id: number) => api.delete(`/credit-cards/${id}`),
  recalculateInvoices: (id: number) => api.post(`/credit-cards/${id}/recalculate-invoices`),
  projectRecurring: (id: number, monthsAhead?: number) =>
    api.post(`/credit-cards/${id}/project-recurring`, null, {
      params: monthsAhead ? { months_ahead: monthsAhead } : {}
    }),
  // Invoice PDF password management
  saveInvoicePassword: (id: number, password: string) =>
    api.post(`/credit-cards/${id}/invoice-password`, { password }),
  deleteInvoicePassword: (id: number) =>
    api.delete(`/credit-cards/${id}/invoice-password`),
}

export const benefitCardsApi = {
  list: () => api.get('/benefit-cards'),
  get: (id: number) => api.get(`/benefit-cards/${id}`),
  create: (data: unknown) => api.post('/benefit-cards', data),
  update: (id: number, data: unknown) => api.patch(`/benefit-cards/${id}`, data),
  delete: (id: number) => api.delete(`/benefit-cards/${id}`),
  adjustBalance: (id: number, data: { adjustment_amount: number; reason: string }) =>
    api.post(`/benefit-cards/${id}/adjust-balance`, data),
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

// Income Split Rules - Regras de divisão de receita (Dízimo, Poupança, etc)
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

export const invoicesApi = {
  list: (params?: {
    credit_card_id?: number
    status?: string
    year?: number
    month?: number
    limit?: number
    offset?: number
  }) => api.get('/invoices', { params }),
  get: (id: number) => api.get(`/invoices/${id}`),
  create: (data: unknown) => api.post('/invoices', data),
  createFromDocument: (data: unknown) => api.post('/invoices/from-document', data),
  update: (id: number, data: unknown) => api.patch(`/invoices/${id}`, data),
  delete: (id: number, deleteTransactions: boolean = false) =>
    api.delete(`/invoices/${id}`, { params: { delete_transactions: deleteTransactions } }),
  pay: (id: number, data: { amount: number; payment_account_id: number; payment_date?: string }) =>
    api.post(`/invoices/${id}/pay`, data),
  listByCard: (cardId: number, year?: number) =>
    api.get(`/invoices/credit-card/${cardId}`, { params: year ? { year } : {} }),
  getCurrentByCard: (cardId: number) =>
    api.get(`/invoices/credit-card/${cardId}/current`),
  detectCard: (documentData: { card_issuer?: string; card_last_digits?: string }) =>
    api.post('/invoices/detect-card', documentData),
  createCardFromInvoice: (data: {
    card_issuer: string
    card_last_digits?: string
    card_name?: string
    closing_day?: number
    due_day?: number
    credit_limit?: number
    color?: string
    icon?: string
  }) => api.post('/invoices/create-card-from-invoice', data),
  projectFuture: (data: {
    credit_card_id: number
    months_ahead?: number
    include_installments?: boolean
    include_recurring?: boolean
  }) => api.post('/invoices/project-future', data),
  reprocessOrphanTransactions: (creditCardId?: number) =>
    api.post('/invoices/reprocess-orphan-transactions', null, {
      params: creditCardId ? { credit_card_id: creditCardId } : {},
    }),
}

export const apiKeysApi = {
  list: () => api.get('/api-keys'),
  create: (data: { name: string; notes?: string; expires_in_days?: number }) =>
    api.post('/api-keys', data),
  get: (id: number) => api.get(`/api-keys/${id}`),
  revoke: (id: number) => api.post(`/api-keys/${id}/revoke`),
  delete: (id: number) => api.delete(`/api-keys/${id}`),
}

export const notificationsApi = {
  // Notifications
  list: (params?: { limit?: number; offset?: number; unread_only?: boolean; type?: string }) =>
    api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  getSummary: () => api.get('/notifications/summary'),
  get: (id: number) => api.get(`/notifications/${id}`),
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
  dismiss: (id: number) => api.delete(`/notifications/${id}`),

  // Preferences
  listPreferences: () => api.get('/notifications/preferences'),
  getPreference: (type: string) => api.get(`/notifications/preferences/${type}`),
  updatePreference: (type: string, data: unknown) =>
    api.put(`/notifications/preferences/${type}`, data),

  // Settings
  getSettings: () => api.get('/notifications/settings'),
  updateSettings: (data: unknown) => api.put('/notifications/settings', data),

  // Push
  subscribePush: (data: {
    endpoint: string
    p256dh_key: string
    auth_key: string
    user_agent?: string
    device_name?: string
  }) => api.post('/notifications/push/subscribe', data),
  unsubscribePush: (endpoint: string) =>
    api.post('/notifications/push/unsubscribe', null, { params: { endpoint } }),
  listPushSubscriptions: () => api.get('/notifications/push/subscriptions'),
}

// Simulator API extensions (using existing debt/goal endpoints)
export const simulatorsApi = {
  // Debt simulators
  getSnowballPlan: (monthlyPayment: number) =>
    api.get('/debts/snowball', { params: { monthly_payment: monthlyPayment } }),
  getAvalanchePlan: (monthlyPayment: number) =>
    api.get('/debts/avalanche', { params: { monthly_payment: monthlyPayment } }),
  compareStrategies: (monthlyPayment: number) =>
    api.get('/debts/compare-strategies', { params: { monthly_payment: monthlyPayment } }),

  // Goal simulators
  calculateEmergencyFund: (months: number = 6) =>
    api.get('/goals/emergency-fund', { params: { months } }),
  calculatePNIF: (expectedReturn: number = 0.08) =>
    api.get('/goals/pnif', { params: { expected_return: expectedReturn } }),

  // Cash flow projection (using calendar)
  projectCashFlow: (daysAhead: number = 90) =>
    api.get(`/calendar/projections/${daysAhead}`),
}

// Envelopes module removed - functionality merged into Budgets module
// export const envelopesApi = {
//   list: (includeInactive: boolean = false) =>
//     api.get('/envelopes', { params: { include_inactive: includeInactive } }),
//   get: (id: number) => api.get(`/envelopes/${id}`),
//   create: (data: unknown) => api.post('/envelopes', data),
//   update: (id: number, data: unknown) => api.patch(`/envelopes/${id}`, data),
//   delete: (id: number) => api.delete(`/envelopes/${id}`),
//   getSummary: () => api.get('/envelopes/summary'),
//   refill: (id: number) => api.post(`/envelopes/${id}/refill`),
//   transfer: (data: unknown) => api.post('/envelopes/transfer', data),
// }

export const calendarApi = {
  // Daily calendar with projections
  getDaily: (params?: {
    start_date?: string
    end_date?: string
    include_details?: boolean
  }) => api.get('/calendar/daily', { params }),

  // Weekly summary
  getWeekly: (year: number, week: number, comparePrevious: boolean = true) =>
    api.get(`/calendar/weekly/${year}/${week}`, {
      params: { compare_previous: comparePrevious },
    }),

  // Monthly calendar
  getMonthly: (year: number, month: number, includeDetails: boolean = false) =>
    api.get(`/calendar/monthly/${year}/${month}`, {
      params: { include_details: includeDetails },
    }),

  // Running balance projection
  getRunningBalance: (params?: {
    start_date?: string
    end_date?: string
    days?: number
  }) => api.get('/calendar/running-balance', { params }),

  // Future projections
  getProjections: (daysAhead: number, includeDetails: boolean = true) =>
    api.get(`/calendar/projections/${daysAhead}`, {
      params: { include_details: includeDetails },
    }),
}

export const automationsApi = {
  // Automation rules CRUD
  list: (params?: {
    include_inactive?: boolean
    trigger_type?: string
    action_type?: string
  }) => api.get('/automations', { params }),
  get: (id: number) => api.get(`/automations/${id}`),
  create: (data: {
    name: string
    description?: string
    trigger_type: string
    trigger_config: Record<string, unknown>
    conditions?: Record<string, unknown>
    action_type: string
    action_config: Record<string, unknown>
    is_active?: boolean
    priority?: number
  }) => api.post('/automations', data),
  update: (id: number, data: unknown) => api.patch(`/automations/${id}`, data),
  delete: (id: number) => api.delete(`/automations/${id}`),

  // Actions
  toggle: (id: number) => api.post(`/automations/${id}/toggle`),
  test: (id: number) => api.post(`/automations/${id}/test`),
  execute: (id: number) => api.post(`/automations/${id}/execute`),

  // Execution history
  listExecutions: (params?: {
    rule_id?: number
    status?: string
    limit?: number
  }) => api.get('/automations/executions', { params }),
  getRuleExecutions: (ruleId: number, limit: number = 20) =>
    api.get(`/automations/${ruleId}/executions`, { params: { limit } }),
}

export const reviewApi = {
  // Weekly review
  getWeeklyReview: (year: number, week: number) =>
    api.get(`/review/weekly/${year}/${week}`),
  getCurrentWeekReview: () =>
    api.get('/review/weekly/current'),
  completeReview: (year: number, week: number, notes?: string) =>
    api.post(`/review/weekly/${year}/${week}/complete`, { year, week, notes }),
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
