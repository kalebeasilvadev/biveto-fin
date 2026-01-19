import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  Target,
  Calendar,
  Lightbulb,
  CheckCircle,
  Wallet,
  Receipt,
  DollarSign,
} from 'lucide-react'
import { reviewApi, transactionsApi, categoriesApi } from '../services/api'
import { HelpButton } from '../components/help'
import { useToastStore } from '../stores/toastStore'

interface WeekSummary {
  week_start: string
  week_end: string
  week_number: number
  year: number
  total_income: number
  income_count: number
  income_vs_previous: number | null
  total_expenses: number
  expenses_count: number
  expenses_vs_previous: number | null
  net_balance: number
  net_vs_previous: number | null
  daily_average_expense: number
  top_expense_categories: Array<{ id: number; name: string; total: number }>
}

interface UncategorizedTransaction {
  id: number
  date: string
  description: string
  amount: number
  type: string
  account_name: string
}

interface BudgetCategoryComparison {
  category_id: number
  category_name: string
  budgeted: number
  spent: number
  remaining: number
  percentage_used: number
  is_over_budget: boolean
}

interface BudgetComparison {
  total_budgeted: number
  total_spent: number
  total_remaining: number
  percentage_used: number
  categories: BudgetCategoryComparison[]
  categories_over_budget: number
  categories_near_limit: number
}

interface GoalProgress {
  id: number
  name: string
  target_amount: number
  current_amount: number
  percentage: number
  contribution_this_week: number
  suggested_contribution: number | null
  target_date: string | null
  days_remaining: number | null
}

interface UpcomingItem {
  type: string
  description: string
  amount: number
  due_date: string
  days_until: number
  entity_id: number
  is_income: boolean
}

interface WeeklyReviewData {
  week_summary: WeekSummary
  uncategorized_transactions: UncategorizedTransaction[]
  uncategorized_count: number
  budget_comparison: BudgetComparison | null
  goal_progress: GoalProgress[]
  upcoming_items: UpcomingItem[]
  review_tips: string[]
  last_review_date: string | null
  streak_weeks: number
}

interface Category {
  id: number
  name: string
  type: string
}

const steps = [
  { id: 'summary', title: 'Resumo', icon: Wallet },
  { id: 'categorize', title: 'Categorizar', icon: Tag },
  { id: 'budget', title: 'Orçamento', icon: DollarSign },
  { id: 'goals', title: 'Metas', icon: Target },
  { id: 'upcoming', title: 'Próximos', icon: Calendar },
  { id: 'tips', title: 'Dicas', icon: Lightbulb },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function TrendIndicator({ value, inverted = false }: { value: number | null; inverted?: boolean }) {
  if (value === null) return null

  const isPositive = inverted ? value < 0 : value > 0
  const isNegative = inverted ? value > 0 : value < 0

  return (
    <span
      className={`flex items-center gap-1 text-sm ${
        isPositive
          ? 'text-green-600 dark:text-green-400'
          : isNegative
          ? 'text-red-600 dark:text-red-400'
          : 'text-gray-500'
      }`}
    >
      {isPositive ? (
        <TrendingUp size={14} />
      ) : isNegative ? (
        <TrendingDown size={14} />
      ) : (
        <Minus size={14} />
      )}
      {Math.abs(value).toFixed(0)}%
    </span>
  )
}

function SummaryStep({ data }: { data: WeeklyReviewData }) {
  const summary = data.week_summary

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Semana {summary.week_number} de {summary.year}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {formatDate(summary.week_start)} - {formatDate(summary.week_end)}
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
          <p className="text-sm text-green-600 dark:text-green-400 mb-1">Receitas</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-300">
            {formatCurrency(summary.total_income)}
          </p>
          <div className="mt-1 flex justify-center">
            <TrendIndicator value={summary.income_vs_previous} />
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-1">Despesas</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">
            {formatCurrency(summary.total_expenses)}
          </p>
          <div className="mt-1 flex justify-center">
            <TrendIndicator value={summary.expenses_vs_previous} inverted />
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 text-center ${
            summary.net_balance >= 0
              ? 'bg-biveto-light dark:bg-biveto/20'
              : 'bg-orange-50 dark:bg-orange-900/20'
          }`}
        >
          <p
            className={`text-sm mb-1 ${
              summary.net_balance >= 0
                ? 'text-biveto'
                : 'text-orange-600 dark:text-orange-400'
            }`}
          >
            Saldo
          </p>
          <p
            className={`text-xl font-bold ${
              summary.net_balance >= 0
                ? 'text-biveto-dark dark:text-biveto'
                : 'text-orange-700 dark:text-orange-300'
            }`}
          >
            {formatCurrency(summary.net_balance)}
          </p>
          <div className="mt-1 flex justify-center">
            <TrendIndicator value={summary.net_vs_previous} />
          </div>
        </div>
      </div>

      {/* Daily Average */}
      <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Média diária de gastos
        </p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {formatCurrency(summary.daily_average_expense)}
        </p>
      </div>

      {/* Top Categories */}
      {summary.top_expense_categories.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Principais categorias de gastos
          </h3>
          <div className="space-y-2">
            {summary.top_expense_categories.slice(0, 5).map((cat, index) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                    {index + 1}
                  </span>
                  <span className="text-gray-900 dark:text-white">{cat.name}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategorizeStep({
  data,
  categories,
}: {
  data: WeeklyReviewData
  categories: Category[]
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const [categorizing, setCategorizing] = useState<number | null>(null)

  const categorizeMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: number; categoryId: number }) =>
      transactionsApi.update(id, { category_id: categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-review'] })
      addToast('Transação categorizada', 'success')
      setCategorizing(null)
    },
    onError: () => {
      addToast('Erro ao categorizar', 'error')
    },
  })

  const uncategorized = data.uncategorized_transactions

  if (uncategorized.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Tudo categorizado!
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Todas as suas transações da semana estão categorizadas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Categorizar Transações
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {uncategorized.length} transaç{uncategorized.length === 1 ? 'ão' : 'ões'} sem
          categoria
        </p>
      </div>

      <div className="space-y-3">
        {uncategorized.slice(0, 10).map((tx) => (
          <div
            key={tx.id}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {tx.description || 'Sem descrição'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(tx.date)} • {tx.account_name}
                </p>
              </div>
              <span
                className={`font-semibold ${
                  tx.type === 'income'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {tx.type === 'income' ? '+' : '-'}
                {formatCurrency(tx.amount)}
              </span>
            </div>

            {categorizing === tx.id ? (
              <select
                autoFocus
                className="input w-full text-sm"
                onChange={(e) => {
                  if (e.target.value) {
                    categorizeMutation.mutate({
                      id: tx.id,
                      categoryId: parseInt(e.target.value),
                    })
                  }
                }}
                onBlur={() => setCategorizing(null)}
              >
                <option value="">Selecione uma categoria...</option>
                {categories
                  .filter((c) => c.type === tx.type || c.type === 'both')
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            ) : (
              <button
                onClick={() => setCategorizing(tx.id)}
                className="btn btn-sm w-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Tag size={14} />
                Categorizar
              </button>
            )}
          </div>
        ))}
      </div>

      {uncategorized.length > 10 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          E mais {uncategorized.length - 10} transações...
        </p>
      )}
    </div>
  )
}

function BudgetStep({ data }: { data: WeeklyReviewData }) {
  const budget = data.budget_comparison

  if (!budget) {
    return (
      <div className="text-center py-12">
        <Wallet size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Sem orçamento definido
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Defina um orçamento mensal para acompanhar seus gastos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Orçamento vs Realizado
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {budget.percentage_used.toFixed(0)}% do orçamento utilizado
        </p>
      </div>

      {/* Overall Progress */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Gasto</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(budget.total_spent)} / {formatCurrency(budget.total_budgeted)}
          </span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              budget.percentage_used > 100
                ? 'bg-red-500'
                : budget.percentage_used > 80
                ? 'bg-yellow-500'
                : 'bg-biveto'
            }`}
            style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span
            className={`${
              budget.total_remaining >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {budget.total_remaining >= 0 ? 'Disponível: ' : 'Excedido: '}
            {formatCurrency(Math.abs(budget.total_remaining))}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {(budget.categories_over_budget > 0 || budget.categories_near_limit > 0) && (
        <div className="flex gap-3">
          {budget.categories_over_budget > 0 && (
            <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {budget.categories_over_budget}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">Estouradas</p>
            </div>
          )}
          {budget.categories_near_limit > 0 && (
            <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {budget.categories_near_limit}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Perto do limite</p>
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        {budget.categories.slice(0, 8).map((cat) => (
          <div
            key={cat.category_id}
            className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {cat.category_name}
              </span>
              <span
                className={`text-sm ${
                  cat.is_over_budget
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {cat.percentage_used.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  cat.is_over_budget
                    ? 'bg-red-500'
                    : cat.percentage_used > 80
                    ? 'bg-yellow-500'
                    : 'bg-biveto'
                }`}
                style={{ width: `${Math.min(cat.percentage_used, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GoalsStep({ data }: { data: WeeklyReviewData }) {
  const goals = data.goal_progress

  if (goals.length === 0) {
    return (
      <div className="text-center py-12">
        <Target size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Sem metas ativas
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Crie metas financeiras para acompanhar seu progresso.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Progresso das Metas
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Acompanhe o progresso das suas metas financeiras
        </p>
      </div>

      <div className="space-y-3">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{goal.name}</h4>
                {goal.target_date && goal.days_remaining !== null && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {goal.days_remaining > 0
                      ? `${goal.days_remaining} dias restantes`
                      : 'Prazo vencido'}
                  </p>
                )}
              </div>
              <span className="text-lg font-bold text-biveto">
                {goal.percentage.toFixed(0)}%
              </span>
            </div>

            <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-biveto rounded-full"
                style={{ width: `${Math.min(goal.percentage, 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>{formatCurrency(goal.current_amount)}</span>
              <span>{formatCurrency(goal.target_amount)}</span>
            </div>

            {goal.suggested_contribution && (
              <div className="mt-3 p-2 bg-biveto-light dark:bg-biveto/20 rounded-lg">
                <p className="text-sm text-biveto-dark dark:text-biveto">
                  <strong>Sugestão:</strong> Contribua{' '}
                  {formatCurrency(goal.suggested_contribution)}/semana para atingir a meta
                  no prazo.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function UpcomingStep({ data }: { data: WeeklyReviewData }) {
  const upcoming = data.upcoming_items

  if (upcoming.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Nenhum compromisso próximo
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Não há itens financeiros previstos para os próximos 7 dias.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Próximos 7 Dias
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Compromissos financeiros que estão chegando
        </p>
      </div>

      <div className="space-y-3">
        {upcoming.map((item, index) => (
          <div
            key={`${item.type}-${item.entity_id}-${index}`}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    item.is_income
                      ? 'bg-green-100 dark:bg-green-900/20'
                      : 'bg-red-100 dark:bg-red-900/20'
                  }`}
                >
                  {item.type === 'invoice' ? (
                    <Receipt
                      size={16}
                      className={
                        item.is_income
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    />
                  ) : (
                    <Calendar
                      size={16}
                      className={
                        item.is_income
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {item.description}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(item.due_date)} •{' '}
                    {item.days_until === 0
                      ? 'Hoje'
                      : item.days_until === 1
                      ? 'Amanhã'
                      : `Em ${item.days_until} dias`}
                  </p>
                </div>
              </div>
              <span
                className={`font-semibold ${
                  item.is_income
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {item.is_income ? '+' : '-'}
                {formatCurrency(item.amount)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TipsStep({ data }: { data: WeeklyReviewData }) {
  const tips = data.review_tips

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Dicas da Semana
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Insights baseados na sua semana financeira
        </p>
      </div>

      {tips.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
          <p className="text-gray-600 dark:text-gray-400">
            Parabéns! Sua semana financeira está em ordem.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tips.map((tip, index) => (
            <div
              key={index}
              className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800"
            >
              <div className="flex gap-3">
                <Lightbulb size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">{tip}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-biveto-light dark:bg-biveto/20 rounded-xl text-center">
        <CheckCircle size={32} className="mx-auto mb-3 text-biveto" />
        <h3 className="font-semibold text-biveto-dark dark:text-biveto mb-1">
          Revisão Concluída!
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Você revisou sua semana financeira com sucesso.
        </p>
      </div>
    </div>
  )
}

export default function WeeklyReview() {
  const [currentStep, setCurrentStep] = useState(0)
  const { addToast } = useToastStore()

  // Get current week
  const today = new Date()
  const year = today.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const days = Math.floor((today.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7)

  const { data: reviewData, isLoading } = useQuery({
    queryKey: ['weekly-review', year, week],
    queryFn: () => reviewApi.getWeeklyReview(year, week),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const completeMutation = useMutation({
    mutationFn: () => reviewApi.completeReview(year, week),
    onSuccess: () => {
      addToast('Revisão semanal concluída!', 'success')
    },
  })

  const data: WeeklyReviewData | null = reviewData?.data
  const categories: Category[] = categoriesData?.data || []

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeMutation.mutate()
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStep = () => {
    if (!data) return null

    switch (steps[currentStep].id) {
      case 'summary':
        return <SummaryStep data={data} />
      case 'categorize':
        return <CategorizeStep data={data} categories={categories} />
      case 'budget':
        return <BudgetStep data={data} />
      case 'goals':
        return <GoalsStep data={data} />
      case 'upcoming':
        return <UpcomingStep data={data} />
      case 'tips':
        return <TipsStep data={data} />
      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-biveto-light dark:bg-biveto/20 rounded-xl">
            <ClipboardCheck size={24} className="text-biveto" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Revisão Semanal
            </h1>
            <HelpButton pageId="weekly-review" />
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          Revise suas finanças da semana em poucos minutos
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? 'text-biveto'
                    : isCompleted
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-biveto text-white'
                      : isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-gray-100 dark:bg-slate-700'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle size={18} />
                  ) : (
                    <StepIcon size={18} />
                  )}
                </div>
                <span className="text-xs font-medium hidden sm:block">{step.title}</span>
              </button>
            )
          })}
        </div>
        <div className="h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-biveto rounded-full transition-all"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
          </div>
        ) : (
          renderStep()
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="btn bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          <ChevronLeft size={18} />
          Anterior
        </button>
        <button
          onClick={goNext}
          className="btn bg-biveto text-white hover:bg-biveto-dark"
        >
          {currentStep === steps.length - 1 ? (
            <>
              Concluir
              <CheckCircle size={18} />
            </>
          ) : (
            <>
              Próximo
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
