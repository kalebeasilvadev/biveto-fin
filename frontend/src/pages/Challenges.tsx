import { useState } from 'react'
import { Zap, ArrowLeft, Calendar, CheckCircle, XCircle, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGamification, useChallenges } from '../hooks/useGamification'
import { ChallengeCard } from '../components/gamification/ChallengeCard'
import { PointsDisplay } from '../components/gamification/PointsDisplay'

type TabType = 'active' | 'available' | 'completed' | 'failed'

const tabs: { id: TabType; label: string; icon: typeof Zap }[] = [
  { id: 'active', label: 'Ativos', icon: Zap },
  { id: 'available', label: 'Disponíveis', icon: Sparkles },
  { id: 'completed', label: 'Completos', icon: CheckCircle },
  { id: 'failed', label: 'Não completados', icon: XCircle },
]

export default function Challenges() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const { summary, startChallenge, startChallengeLoading } = useGamification()
  const { data: challenges, isLoading, error, refetch } = useChallenges()

  const handleStartChallenge = async (challengeId: number) => {
    startChallenge(challengeId, {
      onSuccess: () => {
        refetch()
      },
    })
  }

  const getCurrentChallenges = () => {
    if (!challenges) return []

    switch (activeTab) {
      case 'active':
        return challenges.active
      case 'available':
        return challenges.available
      case 'completed':
        return challenges.completed
      case 'failed':
        return challenges.failed
      default:
        return []
    }
  }

  const currentChallenges = getCurrentChallenges()

  // Get current month name
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desafios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{currentMonth}</p>
        </div>
        <PointsDisplay points={summary?.current_points || 0} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
          <Zap className="mx-auto text-blue-500 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {challenges?.active.length || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ativos</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
          <CheckCircle className="mx-auto text-green-500 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.completed_challenges_month || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Completos</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm">
          <Calendar className="mx-auto text-purple-500 mb-2" size={28} />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {challenges?.available.length || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Disponíveis</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const count =
            tab.id === 'active'
              ? challenges?.active.length
              : tab.id === 'available'
              ? challenges?.available.length
              : tab.id === 'completed'
              ? challenges?.completed.length
              : challenges?.failed.length

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap
                transition-all duration-200 shrink-0
                ${activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }
              `}
            >
              <Icon size={16} />
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.id
                    ? 'bg-white/20'
                    : 'bg-gray-200 dark:bg-slate-600'
                  }
                `}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Challenges List */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
          <p className="text-red-600 dark:text-red-400">Erro ao carregar desafios</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-200 dark:bg-slate-700 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                </div>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full" />
            </div>
          ))}
        </div>
      ) : currentChallenges.length > 0 ? (
        <div className="space-y-3">
          {currentChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onStart={
                activeTab === 'available'
                  ? () => handleStartChallenge(challenge.id)
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center shadow-sm">
          {activeTab === 'active' ? (
            <>
              <Zap className="mx-auto text-gray-300 dark:text-slate-600 mb-4" size={48} />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Você não tem desafios ativos no momento
              </p>
              <button
                onClick={() => setActiveTab('available')}
                className="text-primary-600 dark:text-blue-400 font-medium hover:underline"
              >
                Ver desafios disponíveis
              </button>
            </>
          ) : activeTab === 'available' ? (
            <>
              <Sparkles className="mx-auto text-gray-300 dark:text-slate-600 mb-4" size={48} />
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                Parabéns! Você já iniciou todos os desafios disponíveis.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Novos desafios ficam disponíveis todo mês.
              </p>
            </>
          ) : activeTab === 'completed' ? (
            <>
              <CheckCircle className="mx-auto text-gray-300 dark:text-slate-600 mb-4" size={48} />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum desafio completado ainda este mês
              </p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto text-gray-300 dark:text-slate-600 mb-4" size={48} />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum desafio não completado
              </p>
            </>
          )}
        </div>
      )}

      {/* Loading overlay for starting challenge */}
      {startChallengeLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Iniciando desafio...</p>
          </div>
        </div>
      )}
    </div>
  )
}
