import { useQuery } from '@tanstack/react-query'
import { analyticsApi, budgetsApi } from '../services/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  PiggyBank,
  Target,
  AlertTriangle,
} from 'lucide-react'
import { HelpButton } from '../components/help'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

const COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

export default function Dashboard() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', year, month],
    queryFn: () => analyticsApi.summary(year, month),
  })

  const { data: budgetData } = useQuery({
    queryKey: ['budget-summary', year, month],
    queryFn: () => budgetsApi.get(year, month),
  })

  const summary = data?.data
  const budgetSummary = budgetData?.data

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <HelpButton pageId="dashboard" />
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Receitas</p>
              <p className="text-lg sm:text-2xl font-bold text-income truncate">
                {formatCurrency(summary?.total_income || 0)}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-full flex-shrink-0">
              <TrendingUp className="text-income w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Despesas</p>
              <p className="text-lg sm:text-2xl font-bold text-expense truncate">
                {formatCurrency(summary?.total_expense || 0)}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
              <TrendingDown className="text-expense w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          {/* Breakdown por tipo - hidden on mobile */}
          <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            {(summary?.credit_card_expenses || 0) > 0 && (
              <div className="flex justify-between">
                <span>Cartão:</span>
                <span>{formatCurrency(summary?.credit_card_expenses || 0)}</span>
              </div>
            )}
            {(summary?.debit_cash_expenses || 0) > 0 && (
              <div className="flex justify-between">
                <span>Débito:</span>
                <span>{formatCurrency(summary?.debit_cash_expenses || 0)}</span>
              </div>
            )}
            {(summary?.fixed_expenses || 0) > 0 && (
              <div className="flex justify-between">
                <span>Fixos:</span>
                <span>{formatCurrency(summary?.fixed_expenses || 0)}</span>
              </div>
            )}
          </div>
          {summary?.expense_variation != null && (
            <div className="mt-2 flex items-center text-xs sm:text-sm">
              {summary.expense_variation > 0 ? (
                <>
                  <ArrowUpRight className="text-red-500 w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-red-500">
                    +{summary.expense_variation.toFixed(0)}%
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="text-green-500 w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-green-500">
                    {summary.expense_variation.toFixed(0)}%
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">A pagar</p>
              <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400 truncate">
                {formatCurrency(summary?.pending_invoices || 0)}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full flex-shrink-0">
              <CreditCard className="text-amber-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          {(summary?.pending_invoices || 0) > 0 && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Faturas pendentes
            </p>
          )}
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Saldo</p>
              <p
                className={`text-lg sm:text-2xl font-bold truncate ${
                  (summary?.available_balance || 0) >= 0 ? 'text-income' : 'text-expense'
                }`}
              >
                {formatCurrency(summary?.available_balance || 0)}
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full flex-shrink-0">
              <PiggyBank className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            Receitas - Despesas
          </p>
        </div>
      </div>

      {/* Card de Orçamento */}
      {budgetSummary?.items && budgetSummary.items.length > 0 && (
        <Link to="/budget" className="block">
          <div className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Target className="text-purple-600 w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold dark:text-white">Orçamento do Mês</h2>
              </div>
              {budgetSummary.items.some((item: { status: string }) => item.status === 'overspent' || item.status === 'warning') && (
                <div className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle size={16} />
                  <span className="text-xs sm:text-sm">Atenção</span>
                </div>
              )}
            </div>

            {/* Progress bar geral */}
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Gasto: {formatCurrency(budgetSummary.total_spent || 0)}</span>
                <span>Planejado: {formatCurrency(budgetSummary.total_expense_planned || 0)}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    (budgetSummary.total_spent / budgetSummary.total_expense_planned * 100) > 100
                      ? 'bg-red-500'
                      : (budgetSummary.total_spent / budgetSummary.total_expense_planned * 100) > 80
                      ? 'bg-yellow-500'
                      : 'bg-purple-500'
                  )}
                  style={{
                    width: `${Math.min((budgetSummary.total_spent / budgetSummary.total_expense_planned * 100) || 0, 100)}%`
                  }}
                />
              </div>
            </div>

            {/* Categorias com alertas */}
            <div className="space-y-2">
              {budgetSummary.items
                .filter((item: { status: string }) => item.status === 'overspent' || item.status === 'warning')
                .slice(0, 3)
                .map((item: { category_id: number; category_name: string; status: string; spent_amount: number; planned_amount: number; percentage_used: number }) => (
                  <div key={item.category_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        'w-2 h-2 rounded-full',
                        item.status === 'overspent' ? 'bg-red-500' : 'bg-yellow-500'
                      )} />
                      <span className="text-gray-700 dark:text-gray-300">{item.category_name}</span>
                    </div>
                    <span className={clsx(
                      'font-medium',
                      item.status === 'overspent' ? 'text-red-500' : 'text-yellow-500'
                    )}>
                      {item.percentage_used.toFixed(0)}%
                    </span>
                  </div>
                ))}
              {budgetSummary.items.filter((item: { status: string }) => item.status === 'overspent' || item.status === 'warning').length === 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Todas as categorias dentro do limite
                </p>
              )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-right">
              Clique para ver detalhes
            </p>
          </div>
        </Link>
      )}

      {/* Gastos por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card">
          <h2 className="text-base sm:text-lg font-semibold mb-4 dark:text-white">Gastos por Categoria</h2>
          {summary?.categories && summary.categories.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-36 h-36 sm:w-48 sm:h-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.categories}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                    >
                      {summary.categories.map((_: unknown, index: number) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 w-full">
                {summary.categories.slice(0, 5).map((cat: { category_id: number; category_name: string; percentage: number }, index: number) => (
                  <div key={cat.category_id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs sm:text-sm flex-1 truncate dark:text-gray-300">
                      {cat.category_name}
                    </span>
                    <span className="text-xs sm:text-sm font-medium dark:text-gray-300">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">
              Nenhuma transação registrada
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="text-base sm:text-lg font-semibold mb-4 dark:text-white">Maiores Gastos</h2>
          {summary?.categories && summary.categories.length > 0 ? (
            <div className="space-y-3">
              {summary.categories.slice(0, 5).map((cat: { category_id: number; category_name: string; total: number; count: number; percentage: number }, index: number) => (
                <div
                  key={cat.category_id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base dark:text-white truncate">{cat.category_name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {cat.count} trans.
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-semibold text-sm sm:text-base text-expense">
                      {formatCurrency(cat.total)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {cat.percentage.toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">
              Nenhuma despesa registrada
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
