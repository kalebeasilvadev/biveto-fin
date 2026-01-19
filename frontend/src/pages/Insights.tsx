import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analyticsApi } from '../services/api'
import { format, subDays } from 'date-fns'
import {
  Lightbulb,
  TrendingDown,
  AlertCircle,
  Target,
  CreditCard,
  AlertTriangle,
  Layers,
  ExternalLink,
  PieChart,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { HelpButton } from '../components/help'

interface Insight {
  type: 'leak' | 'driver' | 'opportunity' | 'anomaly' | 'credit_alert' | 'interest_warning' | 'consolidation'
  title: string
  description: string
  impact_value: number
  calculation: string
  action: string
  category_id?: number | null
  merchant_id?: number | null
  credit_card_id?: number | null
}

const typeConfig = {
  leak: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    label: 'Vazamento',
  },
  driver: {
    icon: TrendingDown,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    label: 'Principal Gasto',
  },
  opportunity: {
    icon: Target,
    color: 'text-green-600',
    bg: 'bg-green-100',
    label: 'Oportunidade',
  },
  anomaly: {
    icon: Lightbulb,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    label: 'Anomalia',
  },
  credit_alert: {
    icon: CreditCard,
    color: 'text-red-600',
    bg: 'bg-red-100',
    label: 'Alerta Cartão',
  },
  interest_warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    label: 'Atenção Juros',
  },
  consolidation: {
    icon: Layers,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
    label: 'Consolidação',
  },
}

// LocalStorage key for ignored insights
const IGNORED_KEY = 'biveto_ignored_insights'

const getIgnoredInsights = (): string[] => {
  const stored = localStorage.getItem(IGNORED_KEY)
  return stored ? JSON.parse(stored) : []
}

const ignoreInsight = (insightKey: string) => {
  const ignored = getIgnoredInsights()
  if (!ignored.includes(insightKey)) {
    ignored.push(insightKey)
    localStorage.setItem(IGNORED_KEY, JSON.stringify(ignored))
  }
}

const getInsightKey = (insight: Insight) => `${insight.type}:${insight.title}`

const getNavigationUrl = (insight: Insight): string => {
  switch (insight.type) {
    case 'leak':
      return insight.merchant_id ? `/transactions?merchant_id=${insight.merchant_id}` : '/transactions'
    case 'driver':
      return insight.category_id ? `/transactions?category_id=${insight.category_id}` : '/transactions'
    case 'opportunity':
      return '/recurring'
    case 'credit_alert':
    case 'interest_warning':
    case 'consolidation':
      return insight.credit_card_id ? `/invoices?card_id=${insight.credit_card_id}` : '/credit-cards'
    default:
      return '/transactions'
  }
}

export default function Insights() {
  const navigate = useNavigate()
  const [ignoredKeys, setIgnoredKeys] = useState<string[]>(getIgnoredInsights())

  // Use strings for dates to prevent infinite re-renders
  const endDateStr = format(new Date(), 'yyyy-MM-dd')
  const startDateStr = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['insights', startDateStr, endDateStr],
    queryFn: () => analyticsApi.insights(startDateStr, endDateStr),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const insights: Insight[] = data?.data || []

  // Filter out ignored insights
  const visibleInsights = insights.filter(
    insight => !ignoredKeys.includes(getInsightKey(insight))
  )

  const handleIgnore = (insight: Insight) => {
    const key = getInsightKey(insight)
    ignoreInsight(key)
    setIgnoredKeys(prev => [...prev, key])
  }

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

  if (isError) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
        <p className="text-gray-500">
          Erro ao carregar insights.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Tente novamente mais tarde.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h1>
          <HelpButton pageId="insights" />
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          Análise dos últimos 30 dias com recomendações acionáveis
        </p>
      </div>

      {visibleInsights.length === 0 ? (
        <div className="card text-center py-12">
          <Lightbulb className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum insight disponível ainda.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Adicione mais transações para receber análises personalizadas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleInsights.map((insight, index) => {
            const config = typeConfig[insight.type] || typeConfig.opportunity
            const Icon = config.icon

            return (
              <div key={index} className="card">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={clsx(
                      'text-xs font-medium px-2 py-0.5 rounded',
                      config.bg,
                      config.color
                    )}
                  >
                    {config.label}
                  </span>
                  <Icon className={config.color} size={20} />
                </div>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {insight.title.includes(':') ? insight.title.split(':').slice(1).join(':').trim() : insight.title}
                </h3>

                <p className="text-gray-600 dark:text-gray-300 mt-1">{insight.description}</p>

                <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <strong>Cálculo:</strong> {insight.calculation}
                  </p>
                  <p className="text-sm font-medium mt-2 dark:text-gray-300">
                    Impacto potencial:{' '}
                    <span className="text-primary-600 dark:text-primary-400">
                      {formatCurrency(insight.impact_value)}/mês
                    </span>
                  </p>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {/* Ver detalhes */}
                  <button
                    onClick={() => navigate(getNavigationUrl(insight))}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors dark:text-primary-400 dark:bg-primary-900/30 dark:hover:bg-primary-900/50"
                  >
                    <ExternalLink size={14} />
                    Ver detalhes
                  </button>

                  {/* Criar meta - só para opportunity/driver/leak */}
                  {['opportunity', 'driver', 'leak'].includes(insight.type) && (
                    <button
                      onClick={() => navigate(`/goals?new=true&amount=${insight.impact_value}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                    >
                      <Target size={14} />
                      Criar meta
                    </button>
                  )}

                  {/* Ajustar orçamento */}
                  {['driver', 'opportunity'].includes(insight.type) && (
                    <button
                      onClick={() => navigate('/budget')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                    >
                      <PieChart size={14} />
                      Ajustar orçamento
                    </button>
                  )}

                  {/* Ignorar */}
                  <button
                    onClick={() => handleIgnore(insight)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:text-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    <X size={14} />
                    Ignorar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
