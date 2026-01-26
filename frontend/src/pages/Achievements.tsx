import { useEffect, useState } from 'react'
import { Trophy, Award, Flame, Target, Scale, GraduationCap, Star, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGamification, useBadges } from '../hooks/useGamification'
import { BadgeCard } from '../components/gamification/BadgeCard'
import { PointsDisplay } from '../components/gamification/PointsDisplay'

const categories = [
  { id: null, label: 'Todos', icon: Trophy },
  { id: 'registro', label: 'Registro', icon: Award },
  { id: 'streak', label: 'Streaks', icon: Flame },
  { id: 'economia', label: 'Economia', icon: Target },
  { id: 'controle', label: 'Controle', icon: Scale },
  { id: 'dividas', label: 'Dívidas', icon: Star },
  { id: 'especial', label: 'Especial', icon: GraduationCap },
]

export default function Achievements() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { summary, markSeen } = useGamification()
  const { data: badges, isLoading, error } = useBadges(selectedCategory || undefined)

  // Mark badges as seen when entering the page
  useEffect(() => {
    if (summary?.unseen_badges && summary.unseen_badges > 0) {
      markSeen()
    }
  }, [summary?.unseen_badges, markSeen])

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conquistas</h1>
        </div>
        <PointsDisplay points={summary?.current_points || 0} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
          <Trophy className="mx-auto text-yellow-500 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.badges_earned || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Conquistados</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
          <Award className="mx-auto text-gray-400 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.badges_total || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
          <Flame className="mx-auto text-orange-500 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.main_streak?.current_count || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Streak</p>
        </div>
      </div>

      {/* Progress Bar */}
      {summary && summary.badges_total > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Progresso geral</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {Math.round((summary.badges_earned / summary.badges_total) * 100)}%
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${(summary.badges_earned / summary.badges_total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {categories.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id || 'all'}
              onClick={() => setSelectedCategory(cat.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap
                transition-all duration-200 shrink-0
                ${selectedCategory === cat.id
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }
              `}
            >
              <Icon size={16} />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Badges Grid */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
          <p className="text-red-600 dark:text-red-400">Erro ao carregar badges</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse"
            >
              <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/3 mx-auto" />
            </div>
          ))}
        </div>
      ) : badges && badges.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {badges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center shadow-sm">
          <Trophy className="mx-auto text-gray-300 dark:text-slate-600 mb-4" size={48} />
          <p className="text-gray-500 dark:text-gray-400">
            {selectedCategory
              ? 'Nenhum badge nesta categoria ainda'
              : 'Continue usando o Biveto para conquistar badges!'
            }
          </p>
        </div>
      )}

      {/* Recent Badge */}
      {summary?.recent_badge && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 shadow-sm border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
            Última conquista
          </h3>
          <BadgeCard badge={summary.recent_badge} compact />
        </div>
      )}
    </div>
  )
}
