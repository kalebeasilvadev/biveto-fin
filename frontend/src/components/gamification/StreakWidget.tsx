import { Flame, Snowflake } from 'lucide-react'
import { useGamification } from '../../hooks/useGamification'

export function StreakWidget() {
  const { streakWeek, streakLoading } = useGamification()

  if (streakLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
        <div className="flex justify-between gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 flex-1 bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!streakWeek) {
    return null
  }

  const { days, current_streak, next_milestone, days_until_next_milestone } = streakWeek

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="text-orange-500" size={24} />
          <h3 className="font-semibold text-gray-900 dark:text-white">Streak de Registro</h3>
        </div>
        <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-sm font-medium px-3 py-1 rounded-full">
          {current_streak} {current_streak === 1 ? 'dia' : 'dias'}
        </span>
      </div>

      {/* Calendário da semana */}
      <div className="flex justify-between gap-1">
        {days.map((day, i) => (
          <div
            key={i}
            className={`
              flex flex-col items-center p-2 rounded-lg flex-1 transition-all duration-200
              ${day.completed
                ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                : day.is_today
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 animate-pulse'
                  : day.is_future
                    ? 'bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600'
                    : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
              }
            `}
          >
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {day.day_name}
            </span>
            <span className={`
              text-lg font-bold mt-1
              ${day.completed
                ? 'text-green-600 dark:text-green-400'
                : day.is_today
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : day.is_future
                    ? 'text-gray-300 dark:text-slate-500'
                    : 'text-red-400 dark:text-red-500'
              }
            `}>
              {day.completed ? '✓' : day.is_today ? '?' : day.is_future ? '○' : '✗'}
            </span>
          </div>
        ))}
      </div>

      {/* Progresso para próximo milestone */}
      {next_milestone && days_until_next_milestone && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Próxima conquista: {next_milestone} dias</span>
            <span>{current_streak}/{next_milestone}</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((current_streak / next_milestone) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {days_until_next_milestone === 1
              ? 'Falta 1 dia para a próxima conquista!'
              : `Faltam ${days_until_next_milestone} dias para a próxima conquista`
            }
          </p>
        </div>
      )}

      {/* Streak freeze disponível */}
      {current_streak > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Snowflake size={14} className="text-blue-400" />
          <span>1 freeze disponível (pule 1 dia sem perder o streak)</span>
        </div>
      )}
    </div>
  )
}
