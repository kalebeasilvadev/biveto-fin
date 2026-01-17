import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'

// Mapeamento de mensagens de erro do FastAPI para português
const errorMessages: Record<string, string> = {
  'String should have at least 8 characters': 'A senha deve ter pelo menos 8 caracteres',
  'String should have at least 2 characters': 'O nome deve ter pelo menos 2 caracteres',
  'value is not a valid email address': 'Email inválido',
  'Field required': 'Campo obrigatório',
}

// Extrai mensagem de erro amigável do FastAPI
export function getApiErrorMessage(error: unknown, defaultMessage: string): string {
  const err = error as { response?: { data?: { detail?: unknown } } }
  const detail = err?.response?.data?.detail

  // Se detail é uma string, retorna diretamente
  if (typeof detail === 'string') {
    return detail
  }

  // Se detail é um array (erro de validação 422), extrai a primeira mensagem
  if (Array.isArray(detail) && detail.length > 0) {
    const firstError = detail[0]
    if (firstError?.msg) {
      // Tenta traduzir a mensagem
      return errorMessages[firstError.msg] || firstError.msg
    }
  }

  return defaultMessage
}

// Em produção usa a URL completa, em dev usa proxy
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

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

export const documentsApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/documents', formData, {
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
}

export const incomeSourcesApi = {
  list: () => api.get('/income-sources'),
  get: (id: number) => api.get(`/income-sources/${id}`),
  create: (data: unknown) => api.post('/income-sources', data),
  update: (id: number, data: unknown) => api.patch(`/income-sources/${id}`, data),
  delete: (id: number) => api.delete(`/income-sources/${id}`),
  previewTransactions: (year: number, month: number) =>
    api.get(`/income-sources/preview-transactions?year=${year}&month=${month}`),
  generateTransactions: (data: { year: number; month: number; overwrite?: boolean }) =>
    api.post('/income-sources/generate-transactions', data),
  generateSingleTransaction: (sourceId: number, data: { year: number; month: number; overwrite?: boolean }) =>
    api.post(`/income-sources/${sourceId}/generate-transaction`, data),
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
}
