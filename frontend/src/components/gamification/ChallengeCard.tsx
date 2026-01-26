import { Clock, Trophy, Zap, Play, Check, X } from 'lucide-react'
import * as Icons from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface Challenge {
  id: number
  name: string
  description: string
  icon: string
  difficulty: 'easy' | 'medium' | 'hard'
  status: 'active' | 'completed' | 'failed' | null
  progress: Record<string, number> | null
  progress_percentage: number
  points_reward: number
  badge_reward_id: string | null
  started_at: string | null
  expires_at: string | null
  completed_at: string | null
  duration_days: number
  is_available: boolean
}

interface ChallengeCardProps {
  challenge: Challenge
  onStart?: () => void
  onClick?: () => void
}

const difficultyStyles: Record<string, string> = {
  easy: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  hard: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
}

const difficultyLabels: Record<string, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
}

export function ChallengeCard({ challenge, onStart, onClick }: ChallengeCardProps) {
  const IconComponent = ((Icons as unknown) as Record<string, LucideIcon>)[challenge.icon] || Icons.Target

  const isAvailable = challenge.status === null
  const isActive = challenge.status === 'active'
  const isCompleted = challenge.status === 'completed'
  const isFailed = challenge.status === 'failed'

  let timeLeft = ''
  if (challenge.expires_at && isActive) {
    try {
      timeLeft = formatDistanceToNow(new Date(challenge.expires_at), {
        locale: ptBR,
        addSuffix: false,
      })
    } catch {
      timeLeft = ''
    }
  }

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm cursor-pointer
        transition-all duration-200 hover:shadow-md
        ${isCompleted && 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}
        ${isFailed && 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 opacity-60'}
        ${isAvailable && 'border border-gray-200 dark:border-slate-700'}
        ${isActive && 'border border-blue-200 dark:border-blue-800'}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${difficultyStyles[challenge.difficulty]}`}>
            <IconComponent size={24} />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{challenge.name}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
              {challenge.description}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${difficultyStyles[challenge.difficulty]}`}>
          {difficultyLabels[challenge.difficulty]}
        </span>
      </div>

      {/* Progress bar for active challenges */}
      {isActive && (
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Progresso</span>
            <span>{Math.round(challenge.progress_percentage * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${challenge.progress_percentage * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          {isActive && timeLeft && (
            <>
              <Clock size={16} />
              <span>Termina em {timeLeft}</span>
            </>
          )}
          {isCompleted && (
            <>
              <Check size={16} className="text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-medium">Completo!</span>
            </>
          )}
          {isFailed && (
            <>
              <X size={16} className="text-red-500" />
              <span className="text-red-600 dark:text-red-400">Não completado</span>
            </>
          )}
          {isAvailable && (
            <>
              <Clock size={16} />
              <span>{challenge.duration_days} dias</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-primary-600 dark:text-blue-400">
            <Zap size={16} />
            <span className="font-semibold">{challenge.points_reward} pts</span>
          </div>

          {isAvailable && onStart && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStart()
              }}
              className="flex items-center gap-1 px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={14} />
              Iniciar
            </button>
          )}

          {isCompleted && (
            <Trophy size={20} className="text-yellow-500" />
          )}
        </div>
      </div>
    </div>
  )
}
