import { X, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PasswordInputModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (password: string, saveToCard: boolean) => Promise<void>
  creditCardId?: number
  creditCardName?: string
  error?: string | null
  attemptCount?: number
  maxAttempts?: number
}

export default function PasswordInputModal({
  isOpen,
  onClose,
  onSubmit,
  creditCardId,
  creditCardName,
  error,
  attemptCount = 0,
  maxAttempts = 5,
}: PasswordInputModalProps) {
  const [password, setPassword] = useState('')
  const [saveToCard, setSaveToCard] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Prevent body scroll when modal is open
  useEffect(() => {
    console.log('[PasswordInputModal] isOpen changed to:', isOpen)
    if (isOpen) {
      console.log('[PasswordInputModal] Opening modal - preventing body scroll')
      document.body.style.overflow = 'hidden'
    } else {
      console.log('[PasswordInputModal] Closing modal - restoring body scroll')
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPassword('')
      setSaveToCard(false)
      setShowPassword(false)
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(password, saveToCard)
      // Modal will be closed by parent component on success
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const remainingAttempts = maxAttempts - attemptCount

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up sm:animate-scale-in">
        {/* Header */}
        <div className="relative p-6 pb-4 text-center border-b border-gray-100 dark:border-slate-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>

          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Lock size={28} className="text-orange-600 dark:text-orange-400" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            PDF Protegido
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Este PDF requer senha para ser lido
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 dark:text-red-200">
                  {error}
                </p>
                {remainingAttempts > 0 && (
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {remainingAttempts} {remainingAttempts === 1 ? 'tentativa restante' : 'tentativas restantes'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Password Input */}
          <div>
            <label htmlFor="pdf-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Senha do PDF
            </label>
            <div className="relative">
              <input
                id="pdf-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-biveto focus:border-transparent transition-all"
                autoFocus
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Save to Card Checkbox */}
          {creditCardId && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
              <input
                type="checkbox"
                id="save-password"
                checked={saveToCard}
                onChange={(e) => setSaveToCard(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-biveto bg-white dark:bg-slate-600 border-gray-300 dark:border-slate-500 rounded focus:ring-biveto focus:ring-2"
                disabled={isSubmitting}
              />
              <label htmlFor="save-password" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                Salvar senha no cartão{creditCardName ? ` "${creditCardName}"` : ''}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Próximos uploads de faturas deste cartão não pedirão senha
                </p>
              </label>
            </div>
          )}

          {/* Info */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-900 dark:text-blue-200">
              <strong>Esta senha é apenas para desbloquear o arquivo PDF da fatura.</strong> Não tem relação com a senha do cartão de crédito ou conta bancária.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-biveto hover:bg-biveto/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!password.trim() || isSubmitting}
            >
              {isSubmitting ? 'Verificando...' : 'Desbloquear'}
            </button>
          </div>
        </form>

        {/* Bottom padding for safe area (iOS) */}
        <div className="pb-safe" style={{ paddingBottom: 'max(0rem, env(safe-area-inset-bottom))' }} />
      </div>
    </div>
  )
}
