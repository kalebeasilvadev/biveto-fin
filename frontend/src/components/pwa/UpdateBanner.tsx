import { Download, X, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

interface UpdateBannerProps {
  isVisible: boolean
  isUpdating: boolean
  onUpdate: () => void
  onDismiss: () => void
}

export function UpdateBanner({
  isVisible,
  isUpdating,
  onUpdate,
  onDismiss,
}: UpdateBannerProps) {
  if (!isVisible) return null

  return (
    <div
      className={clsx(
        'fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 z-50',
        'bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700',
        'p-4 animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-biveto-light dark:bg-biveto/20 flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-biveto" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
            Nova versão disponível
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Atualize para obter as últimas melhorias e correções.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onUpdate}
              disabled={isUpdating}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                'bg-biveto text-white hover:bg-biveto-dark',
                isUpdating && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isUpdating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Atualizar agora
                </>
              )}
            </button>
            <button
              onClick={onDismiss}
              disabled={isUpdating}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Depois
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          disabled={isUpdating}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
