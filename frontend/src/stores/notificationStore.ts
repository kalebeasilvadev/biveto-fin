import { create } from 'zustand'

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  message: string
  icon: string | null
  color: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  entity_type: string | null
  entity_id: number | null
  action_url: string | null
  action_label: string | null
  is_read: boolean
  read_at: string | null
  is_dismissed: boolean
  dismissed_at: string | null
  sent_in_app: boolean
  sent_email: boolean
  sent_push: boolean
  scheduled_for: string | null
  sent_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface NotificationState {
  // State
  notifications: Notification[]
  unreadCount: number
  highPriorityCount: number
  isOpen: boolean
  isLoading: boolean

  // Actions
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markAsRead: (id: number) => void
  markAllAsRead: () => void
  dismissNotification: (id: number) => void
  setUnreadCount: (count: number, highPriority?: number) => void
  setIsOpen: (isOpen: boolean) => void
  toggleOpen: () => void
  setIsLoading: (isLoading: boolean) => void
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,
  highPriorityCount: 0,
  isOpen: false,
  isLoading: false,

  // Actions
  setNotifications: (notifications) =>
    set({ notifications }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
      highPriorityCount:
        state.highPriorityCount +
        (!notification.is_read && ['high', 'urgent'].includes(notification.priority) ? 1 : 0),
    })),

  markAsRead: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id)
      if (!notification || notification.is_read) return state

      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
        highPriorityCount:
          ['high', 'urgent'].includes(notification.priority)
            ? Math.max(0, state.highPriorityCount - 1)
            : state.highPriorityCount,
      }
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        is_read: true,
        read_at: n.read_at || new Date().toISOString(),
      })),
      unreadCount: 0,
      highPriorityCount: 0,
    })),

  dismissNotification: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id)
      if (!notification) return state

      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification.is_read ? state.unreadCount : Math.max(0, state.unreadCount - 1),
        highPriorityCount:
          !notification.is_read && ['high', 'urgent'].includes(notification.priority)
            ? Math.max(0, state.highPriorityCount - 1)
            : state.highPriorityCount,
      }
    }),

  setUnreadCount: (count, highPriority = 0) =>
    set({ unreadCount: count, highPriorityCount: highPriority }),

  setIsOpen: (isOpen) => set({ isOpen }),

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  setIsLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({
      notifications: [],
      unreadCount: 0,
      highPriorityCount: 0,
      isOpen: false,
      isLoading: false,
    }),
}))
