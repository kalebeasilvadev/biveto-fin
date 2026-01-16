import { useState } from 'react'
import { X, Download } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'
import IOSInstallModal from './IOSInstallModal'

export default function InstallPromptBanner() {
  const { shouldShowBanner, isIOS, isSafari, promptInstall, dismissBanner } = usePWAInstall()
  const [showIOSModal, setShowIOSModal] = useState(false)

  if (!shouldShowBanner) return null

  const handleInstallClick = () => {
    if (isIOS) {
      setShowIOSModal(true)
    } else {
      promptInstall()
    }
  }

  return (
    <>
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40 lg:hidden animate-slide-up">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-4 relative">
          <button
            onClick={dismissBanner}
            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden shadow-md">
              <img src="/logo-icon.svg" alt="Biveto" className="w-full h-full" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Instalar Biveto
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Acesse mais rapido pela tela inicial
              </p>
            </div>

            <button
              onClick={handleInstallClick}
              className="flex-shrink-0 py-2 px-4 rounded-xl font-semibold text-sm text-white gradient-biveto active:scale-[0.98] transition-transform flex items-center gap-1.5"
            >
              <Download size={16} />
              Instalar
            </button>
          </div>
        </div>
      </div>

      {/* iOS Install Tutorial Modal */}
      <IOSInstallModal
        isOpen={showIOSModal}
        onClose={() => setShowIOSModal(false)}
        isSafari={isSafari}
      />
    </>
  )
}
