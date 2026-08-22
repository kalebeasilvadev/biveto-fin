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

  // Se estiver acessando via Cloudflare Tunnel (trycloudflare.com),
  // o backend precisa ser informado via VITE_CLOUDFLARE_BACKEND (URLs de túnel mudam a cada sessão)
  if (hostname.endsWith('.trycloudflare.com') && import.meta.env.VITE_CLOUDFLARE_BACKEND) {
    return `${import.meta.env.VITE_CLOUDFLARE_BACKEND}/api/v1`
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

// Backward-compatible re-exports: all API groups are now in separate files
// but existing imports like `import { authApi } from '../services/api'` still work
export { authApi } from './auth.api'
export { transactionsApi, installmentsApi, categoriesApi } from './transactions.api'
export { documentsApi, invoicesApi } from './documents.api'
export { analyticsApi, reviewApi, calendarApi, simulatorsApi } from './analytics.api'
export { accountsApi, creditCardsApi, benefitCardsApi } from './accounts.api'
export { adminApi, apiKeysApi, familyApi, notificationsApi, automationsApi } from './settings.api'
export { budgetsApi, goalsApi, debtsApi, recurringApi, incomeSourcesApi, incomeSplitRulesApi, chatApi, groceryApi, receiptsApi, gamificationApi } from './features.api'
