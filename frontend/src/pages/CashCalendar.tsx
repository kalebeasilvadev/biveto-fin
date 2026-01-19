import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { calendarApi } from '../services/api'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import { HelpButton } from '../components/help'
import CalendarGrid from '../components/calendar/CalendarGrid'
import RunningBalanceChart from '../components/calendar/RunningBalanceChart'
import DayDetailModal from '../components/calendar/DayDetailModal'

interface DailyEntry {
  date: string
  is_past: boolean
  is_today: boolean
  is_weekend: boolean
  confirmed_income: number
  confirmed_expense: number
  confirmed_count: number
  projected_income: number
  projected_expense: number
  projected_count: number
  net_confirmed: number
  net_projected: number
  net_total: number
  transactions: TransactionSummary[]
  projections: ProjectionItem[]
}

interface TransactionSummary {
  id: number
  description: string
  amount: number
  type: string
  category_name: string | null
  category_icon: string | null
  account_name: string | null
  is_paid: boolean
}

interface ProjectionItem {
  projection_type: string
  description: string
  amount: number
  is_income: boolean
  category_name: string | null
  category_icon: string | null
  account_name: string | null
  entity_type: string | null
  entity_id: number | null
  confidence: number
}

interface RunningBalanceEntry {
  date: string
  opening_balance: number
  income: number
  expense: number
  net: number
  closing_balance: number
  is_projected: boolean
  is_negative: boolean
}

interface MajorExpense {
  date: string
  description: string
  amount: number
  type: string
  entity_id: number | null
  days_until: number
}

interface CashCalendarResponse {
  start_date: string
  end_date: string
  current_balance: number
  projected_end_balance: number
  shortfall_dates: string[]
  major_expenses: MajorExpense[]
  daily_entries: DailyEntry[]
  running_balance: RunningBalanceEntry[]
  total_confirmed_income: number
  total_confirmed_expense: number
  total_projected_income: number
  total_projected_expense: number
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

type ViewMode = 'month' | 'projections'

export default function CashCalendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<DailyEntry | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // Fetch monthly data
  const { data: calendarData, isLoading, refetch } = useQuery<CashCalendarResponse>({
    queryKey: ['calendar', year, month, viewMode],
    queryFn: async () => {
      if (viewMode === 'projections') {
        const response = await calendarApi.getProjections(90, true)
        return response.data
      }
      const response = await calendarApi.getMonthly(year, month, true)
      return response.data
    },
  })

  const navigateMonth = (delta: number) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + delta)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthLabel = currentDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  const hasShortfalls = calendarData && calendarData.shortfall_dates.length > 0

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-500" />
            Calendário de Caixa
            <HelpButton pageId="calendar" />
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Visualize seu fluxo de caixa e projeções futuras
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                viewMode === 'month'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setViewMode('projections')}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                viewMode === 'projections'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              90 dias
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Balance Summary Cards */}
      {calendarData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Saldo Atual</p>
            <p
              className={clsx(
                'text-xl font-bold mt-1',
                calendarData.current_balance >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {formatCurrency(calendarData.current_balance)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Saldo Projetado</p>
            <p
              className={clsx(
                'text-xl font-bold mt-1',
                calendarData.projected_end_balance >= 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {formatCurrency(calendarData.projected_end_balance)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Receitas
            </p>
            <p className="text-xl font-bold mt-1 text-green-600 dark:text-green-400">
              {formatCurrency(
                calendarData.total_confirmed_income + calendarData.total_projected_income
              )}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Despesas
            </p>
            <p className="text-xl font-bold mt-1 text-red-600 dark:text-red-400">
              {formatCurrency(
                calendarData.total_confirmed_expense + calendarData.total_projected_expense
              )}
            </p>
          </div>
        </div>
      )}

      {/* Shortfall Warning */}
      {hasShortfalls && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                Alerta de saldo negativo
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                O saldo pode ficar negativo em {calendarData.shortfall_dates.length} dia(s):{' '}
                {calendarData.shortfall_dates.slice(0, 3).map(formatDate).join(', ')}
                {calendarData.shortfall_dates.length > 3 && '...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Major Upcoming Expenses */}
      {calendarData && calendarData.major_expenses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Principais despesas previstas
          </h3>
          <div className="space-y-2">
            {calendarData.major_expenses.map((expense, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                      {formatDate(expense.date).split(' ')[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {expense.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      em {expense.days_until} dia(s)
                    </p>
                  </div>
                </div>
                <p className="font-medium text-red-600 dark:text-red-400">
                  {formatCurrency(expense.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation for monthly view */}
      {viewMode === 'month' && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <span className="text-lg font-medium text-gray-900 dark:text-white capitalize">
              {monthLabel}
            </span>
            <button
              onClick={goToToday}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Hoje
            </button>
          </div>

          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Calendar Grid or Loading */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        </div>
      ) : calendarData ? (
        <>
          <CalendarGrid
            entries={calendarData.daily_entries}
            onDayClick={(entry) => setSelectedDay(entry)}
            viewMode={viewMode}
          />

          {/* Running Balance Chart */}
          <RunningBalanceChart data={calendarData.running_balance} />
        </>
      ) : (
        <EmptyState
          icon={Calendar}
          title="Nenhum dado disponível"
          description="Não foi possível carregar os dados do calendário."
          actionLabel="Tentar novamente"
          actionOnClick={() => refetch()}
        />
      )}

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  )
}
