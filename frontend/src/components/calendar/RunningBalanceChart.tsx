import { useMemo } from 'react'
import { clsx } from 'clsx'

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

interface RunningBalanceChartProps {
  data: RunningBalanceEntry[]
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function RunningBalanceChart({ data }: RunningBalanceChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 0, range: 0, entries: [] }

    const balances = data.map((d) => d.closing_balance)
    const min = Math.min(...balances)
    const max = Math.max(...balances)
    const range = max - min || 1

    // Add some padding to the range
    const paddedMin = min - range * 0.1
    const paddedMax = max + range * 0.1
    const paddedRange = paddedMax - paddedMin

    return {
      min: paddedMin,
      max: paddedMax,
      range: paddedRange,
      entries: data.map((entry) => ({
        ...entry,
        heightPercent: ((entry.closing_balance - paddedMin) / paddedRange) * 100,
      })),
    }
  }, [data])

  if (data.length === 0) return null

  const todayIndex = data.findIndex((d) => {
    const entryDate = new Date(d.date + 'T00:00:00')
    const today = new Date()
    return (
      entryDate.getDate() === today.getDate() &&
      entryDate.getMonth() === today.getMonth() &&
      entryDate.getFullYear() === today.getFullYear()
    )
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="font-medium text-gray-900 dark:text-white mb-4">
        Projeção de Saldo
      </h3>

      {/* Chart container */}
      <div className="relative h-40">
        {/* Zero line if balance goes negative */}
        {chartData.min < 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-red-300 dark:border-red-700"
            style={{
              bottom: `${((0 - chartData.min) / chartData.range) * 100}%`,
            }}
          >
            <span className="absolute -translate-y-1/2 left-0 text-xs text-red-500 bg-white dark:bg-gray-800 px-1">
              R$ 0
            </span>
          </div>
        )}

        {/* Chart bars */}
        <div className="flex items-end h-full gap-[1px]">
          {chartData.entries.map((entry, index) => {
            const isToday = index === todayIndex
            const barWidth = `${100 / chartData.entries.length}%`

            return (
              <div
                key={entry.date}
                className="relative flex-1 h-full flex flex-col justify-end group"
                style={{ maxWidth: barWidth }}
              >
                {/* Bar */}
                <div
                  className={clsx(
                    'w-full rounded-t transition-all',
                    entry.is_negative
                      ? 'bg-red-400 dark:bg-red-500'
                      : entry.is_projected
                        ? 'bg-blue-300 dark:bg-blue-600'
                        : 'bg-green-400 dark:bg-green-500',
                    isToday && 'ring-2 ring-blue-500 dark:ring-blue-400'
                  )}
                  style={{
                    height: `${Math.max(entry.heightPercent, 2)}%`,
                  }}
                />

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    <div className="font-medium">
                      {new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </div>
                    <div className={entry.is_negative ? 'text-red-300' : 'text-green-300'}>
                      {formatCurrency(entry.closing_balance)}
                    </div>
                  </div>
                </div>

                {/* Today marker */}
                {isToday && (
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-blue-500 font-medium">
                    Hoje
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-400 dark:bg-green-500" />
          <span className="text-gray-600 dark:text-gray-400">Confirmado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-300 dark:bg-blue-600" />
          <span className="text-gray-600 dark:text-gray-400">Projetado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-400 dark:bg-red-500" />
          <span className="text-gray-600 dark:text-gray-400">Negativo</span>
        </div>
      </div>
    </div>
  )
}
