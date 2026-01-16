import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { useToastStore, ToastType } from '../../stores/toastStore'

const toastConfig: Record<ToastType, { icon: typeof CheckCircle; bg: string; text: string; border: string }> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-200 dark:border-green-800',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-200 dark:border-red-800',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-200 dark:border-blue-800',
  },
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type]
        const Icon = config.icon

        return (
          <div
            key={toast.id}
            className={clsx(
              'flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-up',
              config.bg,
              config.border
            )}
            role="alert"
          >
            <Icon size={20} className={clsx('flex-shrink-0 mt-0.5', config.text)} />
            <p className={clsx('flex-1 text-sm font-medium', config.text)}>
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className={clsx('flex-shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10', config.text)}
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
