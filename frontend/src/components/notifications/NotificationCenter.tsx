import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, Loader2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { notificationsApi } from '../../services/api'
import { useNotificationStore, type Notification } from '../../stores/notificationStore'
import { NotificationItem } from './NotificationItem'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    notifications,
    setNotifications,
    markAsRead,
    markAllAsRead: markAllAsReadStore,
    dismissNotification,
    setIsLoading,
  } = useNotificationStore()

  // Fetch notifications
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await notificationsApi.list({ limit: 20 })
      return response.data as Notification[]
    },
    enabled: isOpen,
    staleTime: 30 * 1000, // 30 seconds
  })

  // Update store when data changes
  useEffect(() => {
    if (data) {
      setNotifications(data)
    }
  }, [data, setNotifications])

  useEffect(() => {
    setIsLoading(isLoading)
  }, [isLoading, setIsLoading])

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onMutate: (id) => {
      markAsRead(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onMutate: () => {
      markAllAsReadStore()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.dismiss(id),
    onMutate: (id) => {
      dismissNotification(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleNotificationClick = (notification: Notification) => {
    if (notification.action_url) {
      onClose()
      // Navigation will be handled by the link in NotificationItem
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className={clsx(
        'absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)]',
        'bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700',
        'z-50 overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Notificações</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full">
              {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Marcar todas como lidas"
            >
              <Check size={16} />
            </button>
          )}
          <Link
            to="/settings/notifications"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Configurações de notificação"
          >
            <Settings size={16} />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Bell size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Nenhuma notificação
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-1">
              Você será notificado sobre eventos importantes
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                onDismiss={(id) => dismissMutation.mutate(id)}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Link
            to="/notifications"
            onClick={onClose}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Ver todas as notificações
          </Link>
        </div>
      )}
    </div>
  )
}
