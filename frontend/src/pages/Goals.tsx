import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { goalsApi } from '../services/api'
import { Plus, Target, Wallet, TrendingUp, PiggyBank, Calculator } from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'

interface GoalContribution {
  id: number
  amount: number
  contribution_date: string
  notes: string | null
}

interface Goal {
  id: number
  name: string
  description: string | null
  type: string
  icon: string | null
  color: string | null
  target_amount: number
  current_amount: number
  initial_amount: number
  start_date: string
  target_date: string | null
  monthly_contribution: number | null
  progress_percentage: number
  remaining_amount: number
  status: string
  contributions: GoalContribution[]
}

interface EmergencyFund {
  average_monthly_expense: number
  recommended_minimum: number
  recommended_maximum: number
  current_emergency_fund: number | null
  current_progress_percentage: number | null
  months_covered: number | null
}

interface PnifResult {
  age: number
  annual_income: number
  patrimony_target: number
  current_patrimony: number
  patrimony_percentage: number
  is_on_track: boolean
}

const goalTypeLabels: Record<string, string> = {
  savings: 'Poupança',
  emergency_fund: 'Reserva de Emergência',
  debt_free: 'Livre de Dívidas',
  investment: 'Investimento',
  retirement: 'Aposentadoria',
  purchase: 'Compra',
  custom: 'Personalizado',
}

const goalTypeIcons: Record<string, typeof Target> = {
  savings: PiggyBank,
  emergency_fund: Wallet,
  investment: TrendingUp,
  default: Target,
}

export default function Goals() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showContributeModal, setShowContributeModal] = useState<number | null>(null)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [showPnifModal, setShowPnifModal] = useState(false)
  const [emergencyData, setEmergencyData] = useState<EmergencyFund | null>(null)
  const [pnifData, setPnifData] = useState<PnifResult | null>(null)

  const { data: goalsData, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsApi.list(),
  })

  const goals: Goal[] = goalsData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: unknown) => goalsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setShowCreateModal(false)
    },
  })

  const contributeMutation = useMutation({
    mutationFn: ({ goalId, data }: { goalId: number; data: unknown }) =>
      goalsApi.addContribution(goalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setShowContributeModal(null)
    },
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  const fetchEmergencyFund = async () => {
    const response = await goalsApi.calculateEmergencyFund()
    setEmergencyData(response.data)
    setShowEmergencyModal(true)
  }

  const fetchPnif = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const response = await goalsApi.calculatePnif(
      Number(formData.get('annual_income')),
      Number(formData.get('annual_return')) / 100
    )
    setPnifData(response.data)
  }

  const activeGoals = goals.filter((g) => g.status === 'active')
  const completedGoals = goals.filter((g) => g.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Metas Financeiras</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Meta
        </button>
      </div>

      {/* Calculator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={fetchEmergencyFund}
          className="card text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Wallet className="text-blue-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold dark:text-white">Calcular Reserva de Emergência</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Descubra quanto você precisa poupar</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowPnifModal(true)}
          className="card text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Calculator className="text-purple-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold dark:text-white">Calcular PNIF (Cerbasi)</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Patrimônio para independência financeira</p>
            </div>
          </div>
        </button>
      </div>

      {/* Active Goals */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : activeGoals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta ativa"
          description="Defina metas financeiras para organizar suas economias e alcançar seus objetivos."
          actionLabel="Criar primeira meta"
          actionOnClick={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeGoals.map((goal) => {
            const IconComponent = goalTypeIcons[goal.type] || goalTypeIcons.default
            return (
              <div key={goal.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: goal.color ? `${goal.color}20` : '#e5e7eb' }}
                    >
                      {goal.icon ? (
                        <span className="text-2xl">{goal.icon}</span>
                      ) : (
                        <IconComponent size={24} style={{ color: goal.color || '#6b7280' }} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold dark:text-white">{goal.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{goalTypeLabels[goal.type]}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowContributeModal(goal.id)}
                    className="btn-primary text-sm px-3 py-1"
                  >
                    + Contribuir
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Progresso</span>
                    <span className="font-medium dark:text-white">{goal.progress_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all"
                      style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{formatCurrency(goal.current_amount)}</span>
                    <span className="text-gray-500 dark:text-gray-400">{formatCurrency(goal.target_amount)}</span>
                  </div>
                </div>

                {goal.monthly_contribution && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                    Contribuição mensal: {formatCurrency(goal.monthly_contribution)}
                  </p>
                )}
                {goal.target_date && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Prazo: {new Date(goal.target_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Metas Concluídas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGoals.map((goal) => (
              <div key={goal.id} className="card bg-green-50 border-green-200">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{goal.icon || '🎉'}</span>
                  <div>
                    <h3 className="font-semibold text-green-800">{goal.name}</h3>
                    <p className="text-sm text-green-600">
                      {formatCurrency(goal.target_amount)} alcançado!
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Goal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Nova Meta</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                createMutation.mutate({
                  name: formData.get('name'),
                  type: formData.get('type'),
                  target_amount: Number(formData.get('target_amount')),
                  initial_amount: Number(formData.get('initial_amount')) || 0,
                  target_date: formData.get('target_date') || null,
                  description: formData.get('description') || null,
                })
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Meta
                  </label>
                  <input type="text" name="name" className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select name="type" className="input" required>
                    {Object.entries(goalTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Alvo
                  </label>
                  <input
                    type="number"
                    name="target_amount"
                    step="0.01"
                    min="0"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Inicial (opcional)
                  </label>
                  <input
                    type="number"
                    name="initial_amount"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Limite (opcional)
                  </label>
                  <input type="date" name="target_date" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea name="description" className="input" rows={2} />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContributeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Adicionar Contribuição</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                contributeMutation.mutate({
                  goalId: showContributeModal,
                  data: {
                    amount: Number(formData.get('amount')),
                    contribution_date: formData.get('date'),
                    notes: formData.get('notes') || null,
                  },
                })
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    name="date"
                    className="input"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observação (opcional)
                  </label>
                  <input type="text" name="notes" className="input" />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowContributeModal(null)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={contributeMutation.isPending}
                >
                  {contributeMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Fund Modal */}
      {showEmergencyModal && emergencyData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Reserva de Emergência</h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Média de gastos mensais</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(emergencyData.average_monthly_expense)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Mínimo (3 meses)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(emergencyData.recommended_minimum)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Ideal (6 meses)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(emergencyData.recommended_maximum)}
                  </p>
                </div>
              </div>
              {emergencyData.current_emergency_fund && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Sua reserva atual</p>
                  <p className="text-xl font-bold text-green-700">
                    {formatCurrency(emergencyData.current_emergency_fund)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Cobre {emergencyData.months_covered?.toFixed(1)} meses de despesas
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowEmergencyModal(false)}
              className="btn-primary w-full mt-6"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* PNIF Modal */}
      {showPnifModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">Cálculo PNIF</h3>
            <p className="text-sm text-gray-500 mb-4">
              Patrimônio Necessário para Independência Financeira (Gustavo Cerbasi)
            </p>
            <form onSubmit={fetchPnif}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sua Idade
                  </label>
                  <input
                    type="number"
                    name="age"
                    min="18"
                    max="100"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Renda Anual Bruta
                  </label>
                  <input
                    type="number"
                    name="annual_income"
                    step="0.01"
                    min="0"
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retorno Anual Esperado (%)
                  </label>
                  <input
                    type="number"
                    name="annual_return"
                    step="0.1"
                    defaultValue="6"
                    className="input"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary w-full">
                  Calcular
                </button>
              </div>
            </form>

            {pnifData && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Patrimônio necessário</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(pnifData.patrimony_target)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Fórmula: (Idade × Renda Anual) ÷ 10
                </p>
                <div className={clsx(
                  'mt-3 p-2 rounded text-sm',
                  pnifData.is_on_track ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                )}>
                  {pnifData.is_on_track
                    ? 'Parabéns! Você está no caminho certo.'
                    : `Você está em ${pnifData.patrimony_percentage.toFixed(0)}% do ideal.`}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowPnifModal(false)
                setPnifData(null)
              }}
              className="btn-secondary w-full mt-4"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
