import { X, Share, Plus } from 'lucide-react'
import { useEffect } from 'react'

interface IOSInstallModalProps {
  isOpen: boolean
  onClose: () => void
  isSafari: boolean
}

export default function IOSInstallModal({ isOpen, onClose, isSafari }: IOSInstallModalProps) {
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

  // If not Safari, show message to open in Safari
  if (!isSafari) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="relative p-6 pb-4 text-center">
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
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                Abra no Safari
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                O Chrome no iOS não suporta instalação de apps. Copie o link e abra no Safari.
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                alert('Link copiado! Cole no Safari.')
              }}
              className="w-full mt-4 py-3 px-4 rounded-xl font-semibold text-white gradient-biveto active:scale-[0.98] transition-transform"
            >
              Copiar Link
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Safari - show step by step tutorial
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
                  <span className="text-xs text-gray-500 dark:text-gray-400">na barra inferior do Safari</span>
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
                Role e toque em "Tela de Início"
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
