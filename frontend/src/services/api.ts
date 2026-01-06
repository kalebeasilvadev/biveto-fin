import axios from 'axios'
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

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor para refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = useAuthStore.getState().refreshToken
        if (refreshToken) {
          const response = await axios.post(`${baseURL}/auth/refresh`, {
            refresh_token: refreshToken,
          })

          const { access_token, refresh_token } = response.data
          useAuthStore.getState().setTokens(access_token, refresh_token)

          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        }
      } catch {
        useAuthStore.getState().logout()
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
  update: (id: number, data: unknown) => api.patch(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
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

  // Convites
  invite: (email: string, nickname?: string) =>
    api.post('/family/invite', { email, nickname }),
  listInvitations: () => api.get('/family/invitations'),
  cancelInvitation: (id: number) => api.delete(`/family/invitations/${id}`),
  resendInvitation: (id: number) => api.post(`/family/invitations/${id}/resend`),
}
