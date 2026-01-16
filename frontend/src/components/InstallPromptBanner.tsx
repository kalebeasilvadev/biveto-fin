import { X, Share, Plus } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export default function InstallPromptBanner() {
  const { isInstallable, isIOS, promptInstall, dismiss } = usePWAInstall()

  if (!isInstallable) return null

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40 lg:hidden animate-slide-up">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-4">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          {/* App Icon */}
          <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden shadow-md bg-white">
            <img
              src="/icons/icon-192x192.png"
              alt="Biveto"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-semibold text-gray-900 dark:text-white text-base">
              Instalar Biveto
            </h3>

            {isIOS ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Toque em{' '}
                <Share size={14} className="inline-block mx-0.5 -mt-0.5" />
                {' '}e depois em{' '}
                <span className="inline-flex items-center gap-0.5">
                  <Plus size={14} className="inline-block" />
                  Tela Inicial
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Adicione o app na sua tela inicial para acesso rapido
              </p>
            )}
          </div>
        </div>

        {!isIOS && (
          <button
            onClick={promptInstall}
            className="w-full mt-4 py-3 px-4 rounded-xl font-semibold text-white gradient-biveto shadow-lg shadow-biveto/20 active:scale-[0.98] transition-transform"
          >
            Instalar App
          </button>
        )}
      </div>
    </div>
  )
}
