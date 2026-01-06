import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { debtsApi } from '../services/api'
import { Plus, CreditCard, AlertCircle, CheckCircle, Calculator } from 'lucide-react'
import { clsx } from 'clsx'

interface DebtPayment {
  id: number
  amount: number
  principal_amount: number
  interest_amount: number
  payment_date: string
  notes: string | null
}

interface Debt {
  id: number
  name: string
  description: string | null
  type: string
  creditor: string | null
  original_amount: number
  current_balance: number
  minimum_payment: number
  interest_rate: number
  interest_type: string
  start_date: string
  due_day: number | null
  status: string
  payments: DebtPayment[]
}

interface DebtSummaryAPI {
  total_debts: number
  active_debts: number
  paid_off_debts: number
  total_owed: string
  total_minimum_payments: string
  total_interest_monthly: string
  highest_interest_debt: { debt_id: number; name: string; balance: string; interest_rate: string } | null
  smallest_balance_debt: { debt_id: number; name: string; balance: string; interest_rate: string } | null
}

interface DebtSummary {
  total_debt: number
  total_minimum_payment: number
  total_monthly_interest: number
  debt_count: number
  highest_rate_debt: { name: string; rate: number } | null
  smallest_balance_debt: { name: string; balance: number } | null
}

interface DebtOrderItem {
  debt_id: number
  debt_name: string
  starting_balance: string
  interest_rate: string
  monthly_payment: string
  months_to_payoff: number
  total_interest_paid: string
  order: number
}

interface StrategyResult {
  strategy: string
  monthly_payment: string
  debts_order: DebtOrderItem[]
  total_months: number
  total_interest: string
  debt_free_date: string
}

interface StrategyComparisonAPI {
  snowball: StrategyResult
  avalanche: StrategyResult
  recommendation: string
  recommendation_reason: string
  months_difference: number
  interest_difference: string
}

interface StrategyComparison {
  snowball: {
    total_months: number
    total_interest: number
    order: string[]
  }
  avalanche: {
    total_months: number
    total_interest: number
    order: string[]
  }
  savings_with_avalanche: number
  recommendation: string
}

const debtTypeLabels: Record<string, string> = {
  credit_card: 'Cartão de Crédito',
  personal_loan: 'Empréstimo Pessoal',
  car_loan: 'Financiamento de Carro',
  mortgage: 'Financiamento Imobiliário',
  student_loan: 'Empréstimo Estudantil',
  medical: 'Dívida Médica',
  store_credit: 'Crediário',
  other: 'Outros',
}

export default function Debts() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null)
  const [showStrategyModal, setShowStrategyModal] = useState(false)
  const [monthlyPayment, setMonthlyPayment] = useState('')
  const [strategyData, setStrategyData] = useState<StrategyComparison | null>(null)

  const { data: debtsData, isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: () => debtsApi.list(),
  })

  const { data: summaryData } = useQuery({
    queryKey: ['debts-summary'],
    queryFn: () => debtsApi.summary(),
  })

  const debts: Debt[] = debtsData?.data || []

  // Map API response to expected format
  const apiSummary: DebtSummaryAPI | null = summaryData?.data
  const summary: DebtSummary = apiSummary ? {
    total_debt: parseFloat(apiSummary.total_owed) || 0,
    total_minimum_payment: parseFloat(apiSummary.total_minimum_payments) || 0,
    total_monthly_interest: parseFloat(apiSummary.total_interest_monthly) || 0,
    debt_count: apiSummary.active_debts || 0,
    highest_rate_debt: apiSummary.highest_interest_debt ? {
      name: apiSummary.highest_interest_debt.name,
      rate: parseFloat(apiSummary.highest_interest_debt.interest_rate)
    } : null,
    smallest_balance_debt: apiSummary.smallest_balance_debt ? {
      name: apiSummary.smallest_balance_debt.name,
      balance: parseFloat(apiSummary.smallest_balance_debt.balance)
    } : null,
  } : {
    total_debt: 0,
    total_minimum_payment: 0,
    total_monthly_interest: 0,
    debt_count: 0,
    highest_rate_debt: null,
    smallest_balance_debt: null,
  }

  const createMutation = useMutation({
    mutationFn: (data: unknown) => debtsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['debts-summary'] })
      setShowCreateModal(false)
    },
  })

  const paymentMutation = useMutation({
    mutationFn: ({ debtId, data }: { debtId: number; data: unknown }) =>
      debtsApi.addPayment(debtId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['debts-summary'] })
      setShowPaymentModal(null)
    },
  })

  const formatCurrency = (value: number | undefined | null) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0)

  const formatPercent = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 2,
    }).format(value)

  const fetchStrategy = async () => {
    if (!monthlyPayment) return
    const response = await debtsApi.compareStrategies(Number(monthlyPayment))
    const apiData: StrategyComparisonAPI = response.data

    // Convert API response to expected format
    const converted: StrategyComparison = {
      snowball: {
        total_months: apiData.snowball.total_months,
        total_interest: parseFloat(apiData.snowball.total_interest) || 0,
        order: apiData.snowball.debts_order.map(d => d.debt_name),
      },
      avalanche: {
        total_months: apiData.avalanche.total_months,
        total_interest: parseFloat(apiData.avalanche.total_interest) || 0,
        order: apiData.avalanche.debts_order.map(d => d.debt_name),
      },
      savings_with_avalanche: parseFloat(apiData.interest_difference) || 0,
      recommendation: apiData.recommendation_reason,
    }
    setStrategyData(converted)
  }

  const activeDebts = debts.filter((d) => d.status === 'active')
  const paidDebts = debts.filter((d) => d.status === 'paid_off')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestão de Dívidas</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Dívida
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Dívida Total</p>
            <p className="text-2xl font-bold text-expense">{formatCurrency(summary.total_debt)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Pagamento Mínimo</p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(summary.total_minimum_payment)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Juros Mensais</p>
            <p className="text-xl font-bold text-yellow-600">
              {formatCurrency(summary.total_monthly_interest)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Qtd. Dívidas</p>
            <p className="text-xl font-bold text-gray-900">{summary.debt_count}</p>
          </div>
        </div>

      {/* Strategy Calculator */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary-100 rounded-lg">
            <Calculator className="text-primary-600" size={24} />
          </div>
          <div>
            <h3 className="font-semibold">Comparar Estratégias de Quitação</h3>
            <p className="text-sm text-gray-500">Snowball (Dave Ramsey) vs Avalanche</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quanto você pode pagar por mês?
            </label>
            <input
              type="number"
              className="input"
              placeholder="Ex: 1500"
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              fetchStrategy()
              setShowStrategyModal(true)
            }}
            className="btn-primary self-end"
            disabled={!monthlyPayment}
          >
            Comparar
          </button>
        </div>
      </div>

      {/* Debts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : activeDebts.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
          <p className="text-gray-500 mb-4">Parabéns! Você não tem dívidas ativas.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Registrar dívida
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeDebts.map((debt) => (
            <div key={debt.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <CreditCard className="text-red-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{debt.name}</h3>
                    <p className="text-sm text-gray-500">
                      {debtTypeLabels[debt.type]} {debt.creditor && `• ${debt.creditor}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentModal(debt.id)}
                  className="btn-primary text-sm px-3 py-1"
                >
                  Pagar
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Saldo Atual</p>
                  <p className="font-bold text-expense">{formatCurrency(debt.current_balance)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Valor Original</p>
                  <p className="font-medium">{formatCurrency(debt.original_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Pagamento Mínimo</p>
                  <p className="font-medium">{formatCurrency(debt.minimum_payment)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Taxa de Juros</p>
                  <p className="font-medium text-yellow-600">
                    {formatPercent(debt.interest_rate)} {debt.interest_type === 'monthly' ? 'a.m.' : 'a.a.'}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Pago</span>
                  <span>
                    {((1 - debt.current_balance / debt.original_amount) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${((1 - debt.current_balance / debt.original_amount) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {debt.due_day && (
                <p className="text-sm text-gray-500 mt-2">
                  Vencimento: dia {debt.due_day} de cada mês
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paid Off Debts */}
      {paidDebts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Dívidas Quitadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paidDebts.map((debt) => (
              <div key={debt.id} className="card bg-green-50 border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-600" size={24} />
                  <div>
                    <h3 className="font-semibold text-green-800">{debt.name}</h3>
                    <p className="text-sm text-green-600">
                      {formatCurrency(debt.original_amount)} quitado!
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Debt Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Registrar Dívida</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                createMutation.mutate({
                  name: formData.get('name'),
                  type: formData.get('type'),
                  creditor: formData.get('creditor') || null,
                  original_amount: Number(formData.get('original_amount')),
                  current_balance: Number(formData.get('current_balance')),
                  minimum_payment: Number(formData.get('minimum_payment')),
                  interest_rate: Number(formData.get('interest_rate')) / 100,
                  interest_type: formData.get('interest_type'),
                  start_date: formData.get('start_date'),
                  due_day: Number(formData.get('due_day')) || null,
                })
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Dívida
                  </label>
                  <input type="text" name="name" className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select name="type" className="input" required>
                    {Object.entries(debtTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credor (opcional)
                  </label>
                  <input type="text" name="creditor" className="input" placeholder="Ex: Nubank" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor Original
                    </label>
                    <input
                      type="number"
                      name="original_amount"
                      step="0.01"
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saldo Atual
                    </label>
                    <input
                      type="number"
                      name="current_balance"
                      step="0.01"
                      className="input"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pagamento Mínimo
                  </label>
                  <input
                    type="number"
                    name="minimum_payment"
                    step="0.01"
                    className="input"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taxa de Juros (%)
                    </label>
                    <input
                      type="number"
                      name="interest_rate"
                      step="0.01"
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Juros
                    </label>
                    <select name="interest_type" className="input" required>
                      <option value="monthly">Mensal</option>
                      <option value="annual">Anual</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      className="input"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dia de Vencimento
                    </label>
                    <input
                      type="number"
                      name="due_day"
                      min="1"
                      max="31"
                      className="input"
                      placeholder="Ex: 10"
                    />
                  </div>
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
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Registrar Pagamento</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                paymentMutation.mutate({
                  debtId: showPaymentModal,
                  data: {
                    amount: Number(formData.get('amount')),
                    payment_date: formData.get('date'),
                    notes: formData.get('notes') || null,
                  },
                })
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor do Pagamento
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
                    Data do Pagamento
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
                  onClick={() => setShowPaymentModal(null)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={paymentMutation.isPending}
                >
                  {paymentMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Strategy Comparison Modal */}
      {showStrategyModal && strategyData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Comparação de Estratégias</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Snowball */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Snowball</h4>
                <p className="text-xs text-gray-600 mb-3">Menor saldo primeiro</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tempo total:</span>
                    <span className="font-medium">{strategyData.snowball.total_months} meses</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Juros pagos:</span>
                    <span className="font-medium text-expense">
                      {formatCurrency(strategyData.snowball.total_interest)}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Ordem:</p>
                  <ol className="text-xs space-y-1">
                    {strategyData.snowball.order.map((name, idx) => (
                      <li key={idx}>{idx + 1}. {name}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Avalanche */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-2">Avalanche</h4>
                <p className="text-xs text-gray-600 mb-3">Maior juros primeiro</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tempo total:</span>
                    <span className="font-medium">{strategyData.avalanche.total_months} meses</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Juros pagos:</span>
                    <span className="font-medium text-expense">
                      {formatCurrency(strategyData.avalanche.total_interest)}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Ordem:</p>
                  <ol className="text-xs space-y-1">
                    {strategyData.avalanche.order.map((name, idx) => (
                      <li key={idx}>{idx + 1}. {name}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className={clsx(
              'p-4 rounded-lg mb-4',
              strategyData.recommendation.includes('Avalanche') ? 'bg-purple-100' : 'bg-blue-100'
            )}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-gray-700 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-800">{strategyData.recommendation}</p>
                  {strategyData.savings_with_avalanche > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Economia com Avalanche: {formatCurrency(strategyData.savings_with_avalanche)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowStrategyModal(false)}
              className="btn-primary w-full"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
