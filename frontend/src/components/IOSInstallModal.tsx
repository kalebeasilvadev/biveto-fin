import { X, Share, Plus } from 'lucide-react'
import { useEffect } from 'react'

interface IOSInstallModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function IOSInstallModal({ isOpen, onClose }: IOSInstallModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up sm:animate-scale-in">
        {/* Header */}
        <div className="relative p-6 pb-4 text-center border-b border-gray-100 dark:border-slate-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
            <img src="/logo-icon.svg" alt="Biveto" className="w-full h-full" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Instalar Biveto
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Adicione à sua tela inicial
          </p>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-biveto text-white flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Toque no botão compartilhar
              </p>
              <div className="bg-gray-100 dark:bg-slate-700 rounded-xl p-3 flex items-center justify-center">
                <div className="flex items-center gap-2 text-blue-500">
                  <Share size={24} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">na barra do navegador</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-biveto text-white flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Toque em "Tela de Início"
              </p>
              <div className="bg-gray-100 dark:bg-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-3 bg-white dark:bg-slate-600 rounded-lg px-3 py-2 shadow-sm">
                  <div className="w-6 h-6 rounded bg-gray-200 dark:bg-slate-500 flex items-center justify-center">
                    <Plus size={14} className="text-gray-600 dark:text-gray-300" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Tela de Início</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-biveto text-white flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Toque em "Adicionar"
              </p>
              <div className="bg-gray-100 dark:bg-slate-700 rounded-xl p-3 flex justify-end">
                <span className="text-blue-500 font-semibold text-sm">Adicionar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 pb-safe" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
