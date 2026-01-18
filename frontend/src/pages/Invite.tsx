import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import api, { getApiErrorMessage } from '../services/api'
import { Lock, User, AlertCircle, Check, Loader2, Eye, EyeOff } from 'lucide-react'

export default function Invite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const setTokens = useAuthStore((state) => state.setTokens)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Validate invitation
  const {
    data: invitation,
    isLoading: isValidating,
    error: validationError,
  } = useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => {
      const response = await api.get(`/auth/invite/${token}`)
      return response.data
    },
    retry: false,
  })

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: { name: string; password: string }) => {
      const response = await api.post(`/auth/invite/${token}`, data)
      return response.data
    },
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token)
      navigate('/')
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Erro ao criar conta'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres')
      return
    }

    registerMutation.mutate({ name, password })
  }

  // Show loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-biveto mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Validando convite...</p>
        </div>
      </div>
    )
  }

  // Show error if invalid
  if (validationError || !invitation?.is_valid) {
    const errorMessage = getApiErrorMessage(validationError, 'Convite inválido ou expirado')

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Convite Inválido</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{errorMessage}</p>
            <Link to="/login" className="btn-primary inline-block">
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Biveto" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crie sua conta</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Você foi convidado para o Biveto
          </p>
        </div>

        <div className="card">
          {/* Email display */}
          <div className="mb-6 p-3 bg-biveto-light dark:bg-biveto/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Seu email</p>
            <p className="font-medium text-gray-900 dark:text-white">{invitation.email}</p>
          </div>

          {/* License info */}
          {invitation.license_type && (
            <div className="mb-6 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Licença</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {invitation.license_type}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Seu nome
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input pl-10"
                  placeholder="Digite seu nome"
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirmar senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="Digite a senha novamente"
                  required
                  minLength={8}
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
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Criando conta...' : 'Criar minha conta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-biveto hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
