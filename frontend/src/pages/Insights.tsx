import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../services/api'
import { format, subDays } from 'date-fns'
import {
  Lightbulb,
  TrendingDown,
  AlertCircle,
  Target,
} from 'lucide-react'
import { clsx } from 'clsx'

interface Insight {
  type: 'leak' | 'driver' | 'opportunity' | 'anomaly'
  title: string
  description: string
  impact_value: number
  calculation: string
  action: string
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
}

export default function Insights() {
  // Use strings for dates to prevent infinite re-renders
  const endDateStr = format(new Date(), 'yyyy-MM-dd')
  const startDateStr = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['insights', startDateStr, endDateStr],
    queryFn: () => analyticsApi.insights(startDateStr, endDateStr),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const insights: Insight[] = data?.data || []

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
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="text-gray-500">
          Análise dos últimos 30 dias com recomendações acionáveis
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="card text-center py-12">
          <Lightbulb className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500">
            Nenhum insight disponível ainda.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Adicione mais transações para receber análises personalizadas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight, index) => {
            const config = typeConfig[insight.type] || typeConfig.opportunity
            const Icon = config.icon

            return (
              <div key={index} className="card">
                <div className="flex gap-4">
                  <div className={clsx('p-3 rounded-full h-fit', config.bg)}>
                    <Icon className={config.color} size={24} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={clsx(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          config.bg,
                          config.color
                        )}
                      >
                        {config.label}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900">
                      {insight.title}
                    </h3>

                    <p className="text-gray-600 mt-1">{insight.description}</p>

                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">
                        <strong>Cálculo:</strong> {insight.calculation}
                      </p>
                      <p className="text-sm font-medium mt-2">
                        Impacto potencial:{' '}
                        <span className="text-primary-600">
                          {formatCurrency(insight.impact_value)}/mês
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 p-3 bg-primary-50 rounded-lg border border-primary-100">
                      <p className="text-sm font-medium text-primary-700">
                        Ação sugerida:
                      </p>
                      <p className="text-sm text-primary-600 mt-1">
                        {insight.action}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
