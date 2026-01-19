import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { simulatorsApi, debtsApi } from '../services/api'
import {
  Calculator,
  TrendingDown,
  Target,
  PiggyBank,
  DollarSign,
  Clock,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Trophy,
  Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { HelpButton } from '../components/help'

interface DebtSummary {
  total_debt: number
  total_minimum_payment: number
  total_monthly_interest: number
  average_interest_rate: number
  total_debts: number
  active_debts: number
  highest_interest_debt: string | null
  lowest_balance_debt: string | null
  estimated_debt_free_date: string | null
}

interface SnowballPlan {
  strategy: string
  monthly_payment: number
  debts_order: Array<{
    id: number
    name: string
    balance: number
    interest_rate: number
    months_to_payoff: number
  }>
  total_months: number
  total_interest: number
  debt_free_date: string
}

interface StrategyComparison {
  snowball: SnowballPlan
  avalanche: {
    strategy: string
    monthly_payment: number
    debts_order: Array<{
      id: number
      name: string
      balance: number
      interest_rate: number
      months_to_payoff: number
    }>
    total_months: number
    total_interest: number
    debt_free_date: string
    interest_saved_vs_snowball: number
  }
  recommendation: string
  recommendation_reason: string
}

interface EmergencyFundCalculation {
  monthly_expenses: number
  recommended_months: number
  target_amount: number
  current_saved: number
  percentage_complete: number
  months_remaining: number | null
  monthly_contribution_needed: number | null
  status: string
}

interface PNIFCalculation {
  annual_expenses: number
  expected_return: number
  pnif_amount: number
  current_net_worth: number
  percentage_achieved: number
  years_to_pnif: number | null
  status: string
}

const formatCurrency = (value: number | null | undefined) => {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safeValue)
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

type SimulatorType = 'debt' | 'emergency' | 'pnif'

export default function Simulators() {
  const [activeSimulator, setActiveSimulator] = useState<SimulatorType>('debt')
  const [monthlyPayment, setMonthlyPayment] = useState<string>('')
  const [emergencyMonths, setEmergencyMonths] = useState<number>(6)
  const [expectedReturn, setExpectedReturn] = useState<number>(8)

  // Debt summary
  const { data: debtSummary } = useQuery<DebtSummary>({
    queryKey: ['debts', 'summary'],
    queryFn: async () => {
      const response = await debtsApi.summary()
      return response.data
    },
  })

  // Strategy comparison
  const { data: comparison, isLoading: isComparing } = useQuery<StrategyComparison>({
    queryKey: ['simulators', 'debt', monthlyPayment],
    queryFn: async () => {
      const response = await simulatorsApi.compareStrategies(parseFloat(monthlyPayment))
      return response.data
    },
    enabled: !!monthlyPayment && parseFloat(monthlyPayment) > 0,
  })

  // Emergency fund calculation
  const { data: emergencyCalc } = useQuery<EmergencyFundCalculation>({
    queryKey: ['simulators', 'emergency', emergencyMonths],
    queryFn: async () => {
      const response = await simulatorsApi.calculateEmergencyFund(emergencyMonths)
      return response.data
    },
    enabled: activeSimulator === 'emergency',
  })

  // PNIF calculation
  const { data: pnifCalc } = useQuery<PNIFCalculation>({
    queryKey: ['simulators', 'pnif', expectedReturn],
    queryFn: async () => {
      const response = await simulatorsApi.calculatePNIF(expectedReturn / 100)
      return response.data
    },
    enabled: activeSimulator === 'pnif',
  })

  // Initialize monthly payment from debt summary
  const suggestedPayment = debtSummary && debtSummary.total_minimum_payment && !isNaN(debtSummary.total_minimum_payment)
    ? debtSummary.total_minimum_payment * 1.5
    : 0

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calculator className="w-7 h-7 text-indigo-500" />
          Simuladores
          <HelpButton pageId="simulators" />
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Simule cenários e planeje suas finanças
        </p>
      </div>

      {/* Simulator tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveSimulator('debt')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            activeSimulator === 'debt'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          <TrendingDown className="w-4 h-4" />
          Quitação de Dívidas
        </button>
        <button
          onClick={() => setActiveSimulator('emergency')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            activeSimulator === 'emergency'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          <PiggyBank className="w-4 h-4" />
          Reserva de Emergência
        </button>
        <button
          onClick={() => setActiveSimulator('pnif')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            activeSimulator === 'pnif'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          <Target className="w-4 h-4" />
          Independência Financeira
        </button>
      </div>

      {/* Debt Simulator */}
      {activeSimulator === 'debt' && (
        <div className="space-y-6">
          {/* Debt summary */}
          {debtSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total em Dívidas</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(debtSummary.total_debt)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Pagamento Mínimo</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(debtSummary.total_minimum_payment)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Juros Mensais</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {formatCurrency(debtSummary.total_monthly_interest)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Dívidas Ativas</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {debtSummary.active_debts}
                </p>
              </div>
            </div>
          )}

          {/* Payment input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              Quanto você pode pagar por mês?
            </h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Pagamento mensal total
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    R$
                  </span>
                  <input
                    type="number"
                    value={monthlyPayment}
                    onChange={(e) => setMonthlyPayment(e.target.value)}
                    placeholder={suggestedPayment > 0 ? suggestedPayment.toFixed(0) : '0'}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
                  />
                </div>
              </div>
              {debtSummary && suggestedPayment > 0 && (
                <button
                  onClick={() => setMonthlyPayment(suggestedPayment.toFixed(0))}
                  className="px-4 py-3 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                >
                  Usar sugestão ({formatCurrency(suggestedPayment)})
                </button>
              )}
            </div>
          </div>

          {/* Strategy comparison */}
          {isComparing && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          {comparison && (
            <div className="space-y-6">
              {/* Recommendation banner */}
              <div
                className={clsx(
                  'rounded-xl p-4 border',
                  comparison.recommendation === 'avalanche'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                )}
              >
                <div className="flex items-start gap-3">
                  <Trophy
                    className={clsx(
                      'w-5 h-5 mt-0.5',
                      comparison.recommendation === 'avalanche'
                        ? 'text-green-500'
                        : 'text-blue-500'
                    )}
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Recomendação:{' '}
                      {comparison.recommendation === 'avalanche' ? 'Avalanche' : 'Bola de Neve'}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {comparison.recommendation_reason}
                    </p>
                  </div>
                </div>
              </div>

              {/* Strategy cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Snowball */}
                <div
                  className={clsx(
                    'bg-white dark:bg-gray-800 rounded-xl p-6 border-2 transition-colors',
                    comparison.recommendation === 'snowball'
                      ? 'border-blue-500'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-500" />
                      Bola de Neve
                    </h3>
                    {comparison.recommendation === 'snowball' && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Pague as menores dívidas primeiro para ganhar motivação.
                  </p>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tempo total</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {comparison.snowball.total_months} meses
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total de juros</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrency(comparison.snowball.total_interest)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Livre de dívidas</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatDate(comparison.snowball.debt_free_date)}
                      </span>
                    </div>
                  </div>

                  {/* Debt order */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Ordem de pagamento:
                    </p>
                    <ol className="space-y-2">
                      {comparison.snowball.debts_order.slice(0, 5).map((debt, index) => (
                        <li
                          key={debt.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 truncate">
                            {debt.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">
                            {formatCurrency(debt.balance)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Avalanche */}
                <div
                  className={clsx(
                    'bg-white dark:bg-gray-800 rounded-xl p-6 border-2 transition-colors',
                    comparison.recommendation === 'avalanche'
                      ? 'border-green-500'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-green-500" />
                      Avalanche
                    </h3>
                    {comparison.recommendation === 'avalanche' && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Pague as dívidas com maior juros primeiro para economizar.
                  </p>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tempo total</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {comparison.avalanche.total_months} meses
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total de juros</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatCurrency(comparison.avalanche.total_interest)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Economia vs Bola de Neve</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(comparison.avalanche.interest_saved_vs_snowball)}
                      </span>
                    </div>
                  </div>

                  {/* Debt order */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Ordem de pagamento:
                    </p>
                    <ol className="space-y-2">
                      {comparison.avalanche.debts_order.slice(0, 5).map((debt, index) => (
                        <li
                          key={debt.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 truncate">
                            {debt.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">
                            {(debt.interest_rate * 100).toFixed(1)}% a.m.
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No debts state */}
          {debtSummary && debtSummary.active_debts === 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center">
              <Trophy className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Parabéns! Você não tem dívidas ativas.
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Continue assim e foque em construir sua reserva de emergência!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Emergency Fund Simulator */}
      {activeSimulator === 'emergency' && (
        <div className="space-y-6">
          {/* Input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              Quantos meses de despesas você quer cobrir?
            </h3>
            <div className="flex gap-2">
              {[3, 6, 9, 12].map((months) => (
                <button
                  key={months}
                  onClick={() => setEmergencyMonths(months)}
                  className={clsx(
                    'flex-1 py-3 rounded-lg font-medium transition-colors',
                    emergencyMonths === months
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {months} meses
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {emergencyCalc && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Progress card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Seu Progresso
                  </h3>
                  <span
                    className={clsx(
                      'text-xs px-2 py-1 rounded-full',
                      emergencyCalc.status === 'complete'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    )}
                  >
                    {emergencyCalc.status === 'complete' ? 'Completo' : 'Em andamento'}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatCurrency(emergencyCalc.current_saved)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatCurrency(emergencyCalc.target_amount)}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${Math.min(emergencyCalc.percentage_complete, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {emergencyCalc.percentage_complete.toFixed(0)}% completo
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Despesas mensais
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(emergencyCalc.monthly_expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Meta</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(emergencyCalc.target_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Falta</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(
                        emergencyCalc.target_amount - emergencyCalc.current_saved
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendation card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Como chegar lá
                </h3>

                {emergencyCalc.monthly_contribution_needed ? (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Contribuição mensal sugerida
                      </p>
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                        {formatCurrency(emergencyCalc.monthly_contribution_needed)}
                      </p>
                    </div>

                    {emergencyCalc.months_remaining && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 text-center">
                        <Clock className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                        <p className="text-sm text-indigo-800 dark:text-indigo-200">
                          Com essa contribuição, você alcança sua meta em{' '}
                          <strong>{emergencyCalc.months_remaining} meses</strong>
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                    <Trophy className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Parabéns! Sua reserva está completa!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PNIF Simulator */}
      {activeSimulator === 'pnif' && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-500 mt-0.5" />
              <div>
                <p className="font-medium text-indigo-800 dark:text-indigo-200">
                  O que é o PNIF?
                </p>
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                  O Patrimônio Necessário para Independência Financeira (PNIF) é o valor
                  que, investido, gera renda suficiente para cobrir suas despesas anuais
                  sem precisar trabalhar. Conceito popularizado por Gustavo Cerbasi.
                </p>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              Retorno anual esperado dos investimentos
            </h3>
            <div className="flex gap-2">
              {[4, 6, 8, 10, 12].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setExpectedReturn(rate)}
                  className={clsx(
                    'flex-1 py-3 rounded-lg font-medium transition-colors',
                    expectedReturn === rate
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {pnifCalc && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Status card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Seu PNIF
                </h3>

                <div className="text-center mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Patrimônio necessário
                  </p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatCurrency(pnifCalc.pnif_amount)}
                  </p>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Progresso</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {pnifCalc.percentage_achieved.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all"
                      style={{
                        width: `${Math.min(pnifCalc.percentage_achieved, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Despesas anuais
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(pnifCalc.annual_expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Patrimônio atual
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(pnifCalc.current_net_worth)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Falta</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(
                        pnifCalc.pnif_amount - pnifCalc.current_net_worth
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Previsão
                </h3>

                {pnifCalc.years_to_pnif ? (
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                      <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {pnifCalc.years_to_pnif}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                      anos para independência financeira
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Mantendo o ritmo atual de economia e investimentos
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    {pnifCalc.percentage_achieved >= 100 ? (
                      <>
                        <Trophy className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Parabéns! Você alcançou a independência financeira!
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                        <p className="text-gray-700 dark:text-gray-300">
                          Não foi possível calcular a previsão. Aumente sua taxa de
                          poupança para alcançar o PNIF.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
