import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { clsx } from 'clsx'
import { notificationsApi } from '../../services/api'
import { useNotificationStore } from '../../stores/notificationStore'
import { NotificationCenter } from './NotificationCenter'

export function NotificationBell() {
  const { unreadCount, highPriorityCount, isOpen, setUnreadCount, toggleOpen, setIsOpen } =
    useNotificationStore()

  // Fetch unread count
  const { data } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const response = await notificationsApi.getUnreadCount()
      return response.data as { unread_count: number; high_priority_count: number }
    },
    refetchInterval: 60 * 1000, // Refetch every minute
    staleTime: 30 * 1000, // 30 seconds
  })

  // Update store when data changes
  useEffect(() => {
    if (data) {
      setUnreadCount(data.unread_count, data.high_priority_count)
    }
  }, [data, setUnreadCount])

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className={clsx(
          'relative p-2 rounded-lg transition-colors',
          'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          'hover:bg-gray-100 dark:hover:bg-gray-700',
          isOpen && 'bg-gray-100 dark:bg-gray-700'
        )}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
      >
        <Bell size={20} />

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={clsx(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
              'flex items-center justify-center',
              'text-[10px] font-bold text-white rounded-full',
              highPriorityCount > 0
                ? 'bg-red-500 animate-pulse'
                : 'bg-blue-500'
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  )
}
