import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import api, { getApiErrorMessage, familyApi } from '../services/api'
import { Lock, User, Mail, Check, AlertCircle, Users, ChevronRight, Database, Key, Eye, EyeOff } from 'lucide-react'

export default function Settings() {
  const user = useAuthStore((state) => state.user)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Verifica se é owner para mostrar opção de API Keys
  const { data: familyContext } = useQuery({
    queryKey: ['family-context'],
    queryFn: async () => {
      const response = await familyApi.getContext()
      return response.data as { is_owner: boolean }
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      const response = await api.post('/users/me/change-password', data)
      return response.data
    },
    onSuccess: () => {
      setSuccess(true)
      setError('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Erro ao alterar senha'))
      setSuccess(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres')
      return
    }

    changePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-gray-500 dark:text-gray-400">Gerencie sua conta e preferências</p>
      </div>

      {/* Family Link Card */}
      <Link
        to="/family"
        className="card flex items-center justify-between hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-biveto-light dark:bg-primary-900/30 rounded-lg">
            <Users size={20} className="text-biveto dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Família</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie membros do plano familiar</p>
          </div>
        </div>
        <ChevronRight size={20} className="text-gray-400" />
      </Link>

      {/* Household Migration Link Card */}
      <Link
        to="/household-migration"
        className="card flex items-center justify-between hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Database size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tornar Familiar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Compartilhar recursos com toda a família</p>
          </div>
        </div>
        <ChevronRight size={20} className="text-gray-400" />
      </Link>

      {/* API Keys Link Card - apenas para owner */}
      {familyContext?.is_owner && (
        <Link
          to="/api-keys"
          className="card flex items-center justify-between hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Key size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Keys</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Integração com Claude Code e outras ferramentas</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>
      )}

      {/* User Info Card */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações da Conta</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div className="p-2 bg-white dark:bg-slate-600 rounded-lg shadow-sm">
              <User size={20} className="text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nome</p>
              <p className="font-medium text-gray-900 dark:text-white">{user?.name || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg overflow-hidden">
            <div className="p-2 bg-white dark:bg-slate-600 rounded-lg shadow-sm flex-shrink-0">
              <Mail size={20} className="text-gray-600 dark:text-gray-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white truncate">{user?.email || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-biveto-light dark:bg-primary-900/30 rounded-lg">
            <Lock size={20} className="text-biveto dark:text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alterar Senha</h2>
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
            <Check size={18} />
            <span>Senha alterada com sucesso!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Senha Atual
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input pr-10"
                required
                placeholder="Digite sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nova Senha
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pr-10"
                required
                minLength={8}
                placeholder="Digite a nova senha (mín. 8 caracteres)"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pr-10"
                required
                minLength={8}
                placeholder="Confirme a nova senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
