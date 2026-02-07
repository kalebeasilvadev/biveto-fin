import { useState } from 'react'
import { Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { creditCardsApi, getApiErrorMessage } from '../../services/api'

interface InvoicePasswordManagerProps {
  cardId: number
  cardName: string
  hasPassword: boolean
  onUpdate?: () => void
}

export default function InvoicePasswordManager({
  cardId,
  hasPassword: initialHasPassword,
  onUpdate,
}: InvoicePasswordManagerProps) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword)
  const [isEditing, setIsEditing] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSave = async () => {
    if (!password.trim()) {
      setError('Digite uma senha')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await creditCardsApi.saveInvoicePassword(cardId, password)
      setHasPassword(true)
      setIsEditing(false)
      setPassword('')
      setShowPassword(false)
      setSuccess('Senha salva com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
      onUpdate?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erro ao salvar senha'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja remover a senha salva?')) return

    setIsDeleting(true)
    setError(null)

    try {
      await creditCardsApi.deleteInvoicePassword(cardId)
      setHasPassword(false)
      setIsEditing(false)
      setPassword('')
      setSuccess('Senha removida com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
      onUpdate?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erro ao remover senha'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setPassword('')
    setShowPassword(false)
    setError(null)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
          <Lock size={16} className="text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Senha do PDF da Fatura
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Para upload automático sem digitar senha toda vez
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-900 dark:text-blue-200">
          <strong>Esta senha é apenas para desbloquear o arquivo PDF da fatura.</strong> Alguns bancos protegem PDFs com senha (CPF, data de nascimento, etc.). Não tem relação com a senha do cartão de crédito ou conta bancária.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <Check size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-900 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Current State or Edit Form */}
      {!isEditing ? (
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
          <div className="flex items-center gap-3">
            {hasPassword ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Check size={18} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Senha configurada
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Upload automático ativado
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <Lock size={18} className="text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Nenhuma senha salva
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Configure para facilitar uploads
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {hasPassword && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Removendo...' : 'Remover'}
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-2 text-sm font-medium text-biveto hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
            >
              {hasPassword ? 'Alterar' : 'Adicionar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Password Input */}
          <div>
            <label htmlFor={`invoice-password-${cardId}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {hasPassword ? 'Nova senha' : 'Senha do PDF'}
            </label>
            <div className="relative">
              <input
                id={`invoice-password-${cardId}`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha do PDF"
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-biveto focus:border-transparent transition-all"
                autoFocus
                disabled={isSaving}
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

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!password.trim() || isSaving}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white bg-biveto hover:bg-biveto/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
