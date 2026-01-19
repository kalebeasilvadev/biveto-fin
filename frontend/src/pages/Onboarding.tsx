import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles,
  Building,
  Receipt,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Check,
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Upload,
  Plus,
} from 'lucide-react'
import { accountsApi, transactionsApi } from '../services/api'
import { useToastStore } from '../stores/toastStore'
import { HelpButton } from '../components/help'
import { useAuthStore } from '../stores/authStore'

const accountTypes = [
  { value: 'checking', label: 'Conta Corrente', icon: Building, description: 'Banco tradicional' },
  { value: 'savings', label: 'Poupança', icon: PiggyBank, description: 'Reserva de emergência' },
  { value: 'wallet', label: 'Carteira', icon: Wallet, description: 'Dinheiro em espécie' },
  { value: 'investment', label: 'Investimento', icon: TrendingUp, description: 'Corretora ou banco' },
]

interface OnboardingStep {
  id: string
  title: string
  subtitle: string
  icon: typeof Sparkles
}

const steps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Biveto!',
    subtitle: 'Vamos configurar seu controle financeiro em poucos minutos',
    icon: Sparkles,
  },
  {
    id: 'account',
    title: 'Sua primeira conta',
    subtitle: 'Comece adicionando sua conta principal',
    icon: Building,
  },
  {
    id: 'transaction',
    title: 'Primeira transação',
    subtitle: 'Registre uma transação para começar',
    icon: Receipt,
  },
  {
    id: 'complete',
    title: 'Pronto para começar!',
    subtitle: 'Você já pode explorar suas finanças',
    icon: Trophy,
  },
]

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-biveto to-biveto-dark rounded-2xl flex items-center justify-center">
        <Sparkles size={40} className="text-white" />
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Olá, {user?.name?.split(' ')[0] || 'Usuário'}!
        </h1>
        <HelpButton pageId="onboarding" />
      </div>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
        Seja bem-vindo ao Biveto, seu novo assistente de finanças pessoais.
        Em poucos minutos você terá seu controle financeiro configurado.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
          <Building className="mx-auto mb-2 text-biveto" size={24} />
          <p className="text-sm font-medium text-gray-900 dark:text-white">Contas</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Organize suas contas</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
          <Receipt className="mx-auto mb-2 text-biveto" size={24} />
          <p className="text-sm font-medium text-gray-900 dark:text-white">Transações</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Registre seus gastos</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
          <TrendingUp className="mx-auto mb-2 text-biveto" size={24} />
          <p className="text-sm font-medium text-gray-900 dark:text-white">Insights</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Entenda seus gastos</p>
        </div>
      </div>

      <button
        onClick={onNext}
        className="btn bg-biveto text-white hover:bg-biveto-dark px-8 py-3 text-lg"
      >
        Começar
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

function AccountStep({
  onNext,
  onSkip,
}: {
  onNext: () => void
  onSkip: () => void
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('checking')
  const [initialBalance, setInitialBalance] = useState('')

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: string; initial_balance: number }) =>
      accountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      addToast('Conta criada com sucesso!', 'success')
      onNext()
    },
    onError: () => {
      addToast('Erro ao criar conta', 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      name: accountName,
      type: accountType,
      initial_balance: parseFloat(initialBalance) || 0,
    })
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-biveto-light dark:bg-biveto/20 rounded-2xl flex items-center justify-center">
          <Building size={32} className="text-biveto" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Adicione sua primeira conta
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Comece com sua conta principal do dia a dia
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nome da conta
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="input w-full"
            placeholder="Ex: Nubank, Itaú, Carteira"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tipo de conta
          </label>
          <div className="grid grid-cols-2 gap-2">
            {accountTypes.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAccountType(type.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    accountType === type.value
                      ? 'border-biveto bg-biveto-light dark:bg-biveto/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon
                    size={20}
                    className={
                      accountType === type.value
                        ? 'text-biveto'
                        : 'text-gray-400'
                    }
                  />
                  <p className="font-medium text-gray-900 dark:text-white text-sm mt-1">
                    {type.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {type.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Saldo inicial (opcional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              R$
            </span>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="input w-full pl-10"
              placeholder="0,00"
              step="0.01"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onSkip}
            className="btn flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Pular
          </button>
          <button
            type="submit"
            disabled={!accountName || createMutation.isPending}
            className="btn flex-1 bg-biveto text-white hover:bg-biveto-dark disabled:opacity-50"
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Conta'}
          </button>
        </div>
      </form>
    </div>
  )
}

function TransactionStep({
  onNext,
  onSkip,
}: {
  onNext: () => void
  onSkip: () => void
}) {
  const navigate = useNavigate()
  const { addToast } = useToastStore()

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-biveto-light dark:bg-biveto/20 rounded-2xl flex items-center justify-center">
          <Receipt size={32} className="text-biveto" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Adicione sua primeira transação
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Escolha como deseja começar
        </p>
      </div>

      <div className="space-y-4">
        {/* Option 1: Quick add */}
        <button
          onClick={() => {
            addToast('Use o botão + no rodapé para adicionar transações', 'info')
            onNext()
          }}
          className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-biveto dark:hover:border-biveto transition-colors text-left"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Plus size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Adicionar manualmente
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Registre transações uma a uma
              </p>
            </div>
          </div>
        </button>

        {/* Option 2: Import */}
        <button
          onClick={() => {
            navigate('/upload')
          }}
          className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-biveto dark:hover:border-biveto transition-colors text-left"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Upload size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Importar extrato
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Envie um PDF ou imagem do extrato
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={onSkip}
          className="btn flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          Fazer depois
        </button>
        <button
          onClick={onNext}
          className="btn flex-1 bg-biveto text-white hover:bg-biveto-dark"
        >
          Continuar
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

function CompleteStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center">
      <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-bounce">
        <Trophy size={48} className="text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Parabéns!
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
        Você concluiu a configuração inicial. Agora é só explorar o Biveto e
        começar a controlar suas finanças!
      </p>

      <div className="space-y-4 max-w-sm mx-auto mb-8">
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <Check className="text-green-500" size={20} />
          <span className="text-sm text-green-700 dark:text-green-300">
            Conta configurada
          </span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
          <Check className="text-green-500" size={20} />
          <span className="text-sm text-green-700 dark:text-green-300">
            Pronto para registrar transações
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={onFinish}
          className="btn bg-biveto text-white hover:bg-biveto-dark px-8 py-3 text-lg w-full max-w-sm"
        >
          Ir para o Dashboard
          <ChevronRight size={20} />
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dica: Use o botão + no rodapé para adicionar transações rapidamente
        </p>
      </div>
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = () => {
    // Mark onboarding as complete in localStorage
    localStorage.setItem('biveto_onboarding_complete', 'true')
    navigate('/')
  }

  const renderStep = () => {
    switch (steps[currentStep].id) {
      case 'welcome':
        return <WelcomeStep onNext={goNext} />
      case 'account':
        return <AccountStep onNext={goNext} onSkip={goNext} />
      case 'transaction':
        return <TransactionStep onNext={goNext} onSkip={goNext} />
      case 'complete':
        return <CompleteStep onFinish={handleFinish} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      {/* Progress */}
      <div className="p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep

              return (
                <div
                  key={step.id}
                  className={`flex-1 flex flex-col items-center ${
                    index < steps.length - 1 ? 'relative' : ''
                  }`}
                >
                  {/* Line connector */}
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute top-4 left-1/2 w-full h-0.5 ${
                        isCompleted
                          ? 'bg-biveto'
                          : 'bg-gray-200 dark:bg-slate-700'
                      }`}
                    />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                      isActive
                        ? 'bg-biveto text-white'
                        : isCompleted
                        ? 'bg-biveto text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check size={16} />
                    ) : (
                      <StepIcon size={16} />
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1 hidden sm:block ${
                      isActive
                        ? 'text-biveto font-medium'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.title.split(' ')[0]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">{renderStep()}</div>
      </div>

      {/* Back button (not on first or last step) */}
      {currentStep > 0 && currentStep < steps.length - 1 && (
        <div className="p-4">
          <button
            onClick={goPrev}
            className="btn bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 mx-auto"
          >
            <ChevronLeft size={18} />
            Voltar
          </button>
        </div>
      )}
    </div>
  )
}
