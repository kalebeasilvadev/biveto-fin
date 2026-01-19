import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Bell,
  CreditCard,
  Target,
  Wallet,
  Calendar,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  X,
  ExternalLink,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Notification } from '../../stores/notificationStore'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: number) => void
  onDismiss: (id: number) => void
  onClick?: (notification: Notification) => void
}

const typeIconMap: Record<string, React.ElementType> = {
  invoice_due_7_days: CreditCard,
  invoice_due_3_days: CreditCard,
  invoice_due_1_day: CreditCard,
  invoice_overdue: CreditCard,
  budget_warning_80: Wallet,
  budget_exceeded: Wallet,
  credit_limit_80: CreditCard,
  credit_limit_exceeded: CreditCard,
  goal_milestone_25: Target,
  goal_milestone_50: Target,
  goal_milestone_75: Target,
  goal_achieved: CheckCircle,
  recurring_due_tomorrow: Calendar,
  balance_low: AlertTriangle,
  balance_negative_risk: TrendingDown,
  weekly_digest: Bell,
  daily_digest: Bell,
}

const priorityColors: Record<string, string> = {
  low: 'border-l-gray-300 dark:border-l-gray-600',
  normal: 'border-l-blue-400 dark:border-l-blue-500',
  high: 'border-l-orange-400 dark:border-l-orange-500',
  urgent: 'border-l-red-500 dark:border-l-red-500',
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
  onClick,
}: NotificationItemProps) {
  const Icon = typeIconMap[notification.type] || Bell
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  })

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
    if (onClick) {
      onClick(notification)
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDismiss(notification.id)
  }

  return (
    <div
      className={clsx(
        'relative flex gap-3 p-3 border-l-4 cursor-pointer transition-colors',
        priorityColors[notification.priority],
        notification.is_read
          ? 'bg-white dark:bg-gray-800'
          : 'bg-blue-50 dark:bg-blue-900/20',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50'
      )}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className={clsx(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          notification.is_read
            ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            : 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300'
        )}
      >
        <Icon size={20} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={clsx(
              'text-sm font-medium truncate',
              notification.is_read
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-gray-900 dark:text-white'
            )}
          >
            {notification.title}
          </h4>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            aria-label="Dispensar notificação"
          >
            <X size={14} />
          </button>
        </div>

        <p
          className={clsx(
            'text-sm mt-0.5 line-clamp-2',
            notification.is_read
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-600 dark:text-gray-300'
          )}
        >
          {notification.message}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {timeAgo}
          </span>

          {notification.action_url && notification.action_label && (
            <a
              href={notification.action_url}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {notification.action_label}
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
      )}
    </div>
  )
}
