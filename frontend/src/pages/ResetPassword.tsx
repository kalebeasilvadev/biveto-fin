import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import api, { getApiErrorMessage } from '../services/api'
import { Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const setTokens = useAuthStore((state) => state.setTokens)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Validate reset token
  const {
    data: resetData,
    isLoading: isValidating,
    error: validationError,
  } = useQuery({
    queryKey: ['reset-password', token],
    queryFn: async () => {
      const response = await api.get(`/auth/reset-password/${token}`)
      return response.data
    },
    retry: false,
  })

  // Reset password mutation
  const resetMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const response = await api.post(`/auth/reset-password/${token}`, data)
      return response.data
    },
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token)
      navigate('/')
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Erro ao redefinir senha'))
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

    resetMutation.mutate({ password })
  }

  // Show loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-biveto mx-auto mb-4" />
          <p className="text-gray-600">Validando link...</p>
        </div>
      </div>
    )
  }

  // Show error if invalid
  if (validationError || !resetData?.is_valid) {
    const errorMessage = getApiErrorMessage(validationError, 'Link inválido ou expirado')

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Link Inválido</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <Link to="/login" className="btn-primary inline-block">
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Biveto" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Redefinir Senha</h1>
          <p className="text-gray-600 mt-2">
            Digite sua nova senha abaixo
          </p>
        </div>

        <div className="card">
          {/* Email display */}
          <div className="mb-6 p-3 bg-biveto-light rounded-lg">
            <p className="text-sm text-gray-600">Sua conta</p>
            <p className="font-medium text-gray-900">{resetData.email}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nova senha
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar nova senha
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
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? 'Redefinindo...' : 'Redefinir senha'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Lembrou sua senha?{' '}
            <Link to="/login" className="text-biveto hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
