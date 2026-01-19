import { RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  threshold: number
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null

  const progress = Math.min(pullDistance / threshold, 1)
  const rotation = progress * 180

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-200 lg:hidden"
      style={{
        top: `calc(env(safe-area-inset-top, 0px) + 3.5rem + ${Math.min(pullDistance, threshold)}px)`,
        opacity: progress > 0.2 ? 1 : progress * 5,
      }}
    >
      <div
        className={clsx(
          'w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center border border-gray-100 dark:border-slate-700',
          isRefreshing && 'animate-pulse'
        )}
      >
        <RefreshCw
          size={20}
          className={clsx(
            'text-biveto transition-transform',
            isRefreshing && 'animate-spin'
          )}
          style={{
            transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
          }}
        />
      </div>
      {progress >= 1 && !isRefreshing && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
          Solte para atualizar
        </p>
      )}
    </div>
  )
}
