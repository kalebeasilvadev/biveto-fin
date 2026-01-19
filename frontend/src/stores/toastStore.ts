import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (messageOrToast: string | Omit<Toast, 'id'>, type?: ToastType) => void
  removeToast: (id: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (messageOrToast, type) => {
    const id = Math.random().toString(36).substring(2, 9)
    // Support both addToast('message', 'success') and addToast({ message, type })
    const toast = typeof messageOrToast === 'string'
      ? { message: messageOrToast, type: type ?? 'info' }
      : messageOrToast
    const newToast = { ...toast, id, duration: toast.duration ?? 4000 }

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))

    // Auto remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, newToast.duration)
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  success: (message) => {
    set((state) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast = { id, type: 'success' as ToastType, message, duration: 4000 }

      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, 4000)

      return { toasts: [...state.toasts, newToast] }
    })
  },

  error: (message) => {
    set((state) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast = { id, type: 'error' as ToastType, message, duration: 5000 }

      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, 5000)

      return { toasts: [...state.toasts, newToast] }
    })
  },

  warning: (message) => {
    set((state) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast = { id, type: 'warning' as ToastType, message, duration: 4000 }

      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, 4000)

      return { toasts: [...state.toasts, newToast] }
    })
  },

  info: (message) => {
    set((state) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast = { id, type: 'info' as ToastType, message, duration: 4000 }

      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, 4000)

      return { toasts: [...state.toasts, newToast] }
    })
  },
}))
