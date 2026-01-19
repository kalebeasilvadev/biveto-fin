import { clsx } from 'clsx'

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
  transactions: unknown[]
  projections: unknown[]
}

interface CalendarGridProps {
  entries: DailyEntry[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDayClick: (entry: any) => void
  viewMode: 'month' | 'projections'
}

const formatCurrency = (value: number, compact: boolean = false) => {
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function CalendarGrid({ entries, onDayClick, viewMode }: CalendarGridProps) {
  if (entries.length === 0) {
    return null
  }

  // For monthly view, organize into weeks
  if (viewMode === 'month') {
    const firstDate = new Date(entries[0].date + 'T00:00:00')
    const startWeekday = firstDate.getDay()

    // Create padding for days before the first day of the month
    const paddingDays = Array(startWeekday).fill(null)
    const allDays = [...paddingDays, ...entries]

    // Split into weeks
    const weeks: (DailyEntry | null)[][] = []
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7))
    }

    // Pad the last week if needed
    const lastWeek = weeks[weeks.length - 1]
    while (lastWeek.length < 7) {
      lastWeek.push(null)
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={clsx(
                'py-2 text-center text-sm font-medium',
                index === 0 || index === 6
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-gray-600 dark:text-gray-400'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        {weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            {week.map((entry, dayIndex) => (
              <DayCell
                key={dayIndex}
                entry={entry}
                onClick={entry ? () => onDayClick(entry) : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // For projections view, show as a list or compact grid
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Projeção dos próximos 90 dias
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
        {entries.map((entry) => (
          <ProjectionRow key={entry.date} entry={entry} onClick={() => onDayClick(entry)} />
        ))}
      </div>
    </div>
  )
}

function DayCell({
  entry,
  onClick,
}: {
  entry: DailyEntry | null
  onClick?: () => void
}) {
  if (!entry) {
    return <div className="min-h-[80px] bg-gray-50 dark:bg-gray-800/50" />
  }

  const date = new Date(entry.date + 'T00:00:00')
  const dayNumber = date.getDate()

  const hasIncome = entry.confirmed_income + entry.projected_income > 0
  const hasExpense = entry.confirmed_expense + entry.projected_expense > 0
  const totalIncome = entry.confirmed_income + entry.projected_income
  const totalExpense = entry.confirmed_expense + entry.projected_expense

  return (
    <button
      onClick={onClick}
      className={clsx(
        'min-h-[80px] p-2 text-left transition-colors relative',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50',
        entry.is_weekend && 'bg-gray-50/50 dark:bg-gray-800/50',
        entry.is_today && 'ring-2 ring-inset ring-blue-500'
      )}
    >
      {/* Day number */}
      <div
        className={clsx(
          'text-sm font-medium mb-1',
          entry.is_today
            ? 'text-blue-600 dark:text-blue-400'
            : entry.is_past
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-900 dark:text-white'
        )}
      >
        {dayNumber}
      </div>

      {/* Income indicator */}
      {hasIncome && (
        <div className="text-xs text-green-600 dark:text-green-400 truncate">
          +{formatCurrency(totalIncome, true)}
        </div>
      )}

      {/* Expense indicator */}
      {hasExpense && (
        <div className="text-xs text-red-600 dark:text-red-400 truncate">
          -{formatCurrency(totalExpense, true)}
        </div>
      )}

      {/* Transaction count indicator */}
      {(entry.confirmed_count > 0 || entry.projected_count > 0) && (
        <div className="absolute bottom-1 right-1 flex gap-0.5">
          {entry.confirmed_count > 0 && (
            <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
          )}
          {entry.projected_count > 0 && (
            <span className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 animate-pulse" />
          )}
        </div>
      )}
    </button>
  )
}

function ProjectionRow({
  entry,
  onClick,
}: {
  entry: DailyEntry
  onClick: () => void
}) {
  const date = new Date(entry.date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })

  const totalIncome = entry.confirmed_income + entry.projected_income
  const totalExpense = entry.confirmed_expense + entry.projected_expense
  const net = totalIncome - totalExpense

  // Skip days with no activity
  if (totalIncome === 0 && totalExpense === 0) {
    return null
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-4 py-3 flex items-center justify-between',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
        entry.is_today && 'bg-blue-50 dark:bg-blue-900/20'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium',
            entry.is_today
              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          )}
        >
          {date.getDate()}
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
            {formattedDate}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {entry.confirmed_count + entry.projected_count} transações
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {totalIncome > 0 && (
          <span className="text-sm text-green-600 dark:text-green-400">
            +{formatCurrency(totalIncome)}
          </span>
        )}
        {totalExpense > 0 && (
          <span className="text-sm text-red-600 dark:text-red-400">
            -{formatCurrency(totalExpense)}
          </span>
        )}
        <span
          className={clsx(
            'text-sm font-medium',
            net >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          )}
        >
          {net >= 0 ? '+' : ''}
          {formatCurrency(net)}
        </span>
      </div>
    </button>
  )
}
