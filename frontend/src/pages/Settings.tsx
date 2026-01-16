import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import api, { getApiErrorMessage } from '../services/api'
import { Lock, User, Mail, Check, AlertCircle, Users, ChevronRight, Database } from 'lucide-react'

export default function Settings() {
  const user = useAuthStore((state) => state.user)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Familia</h2>
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

      {/* User Info Card */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informacoes da Conta</h2>
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

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div className="p-2 bg-white dark:bg-slate-600 rounded-lg shadow-sm">
              <Mail size={20} className="text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{user?.email || '-'}</p>
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
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
              required
              placeholder="Digite sua senha atual"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nova Senha
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              required
              minLength={8}
              placeholder="Digite a nova senha (mín. 8 caracteres)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
              minLength={8}
              placeholder="Confirme a nova senha"
            />
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
