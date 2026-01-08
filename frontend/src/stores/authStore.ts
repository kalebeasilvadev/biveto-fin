import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  email: string
  name: string
  is_admin?: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isRefreshing: boolean
  setUser: (user: User) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setIsRefreshing: (isRefreshing: boolean) => void
  logout: () => void
  isTokenExpired: () => boolean
  isRefreshTokenExpired: () => boolean
  hasValidSession: () => boolean
}

/**
 * Decodifica um JWT e retorna o payload
 */
function decodeToken(token: string): { exp?: number; sub?: string; type?: string } | null {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Verifica se um token está expirado
 * @param token - JWT token
 * @param bufferSeconds - Segundos de margem antes da expiração (default: 30s)
 */
function isExpired(token: string | null, bufferSeconds = 30): boolean {
  if (!token) return true

  const payload = decodeToken(token)
  if (!payload?.exp) return true

  // exp está em segundos, Date.now() em milissegundos
  const expirationTime = payload.exp * 1000
  const now = Date.now()
  const bufferMs = bufferSeconds * 1000

  return now >= expirationTime - bufferMs
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isRefreshing: false,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setIsRefreshing: (isRefreshing) => set({ isRefreshing }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isRefreshing: false,
        }),

      /**
       * Verifica se o access token está expirado
       */
      isTokenExpired: () => {
        const { accessToken } = get()
        return isExpired(accessToken, 30) // 30s de margem
      },

      /**
       * Verifica se o refresh token está expirado
       */
      isRefreshTokenExpired: () => {
        const { refreshToken } = get()
        return isExpired(refreshToken, 60) // 1min de margem
      },

      /**
       * Verifica se a sessão é válida (tem tokens e pelo menos o refresh não expirou)
       */
      hasValidSession: () => {
        const { isAuthenticated, refreshToken } = get()
        if (!isAuthenticated || !refreshToken) return false
        return !isExpired(refreshToken, 60)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
)
