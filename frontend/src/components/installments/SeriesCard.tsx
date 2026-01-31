import { Calendar, DollarSign, CheckCircle2, Clock } from 'lucide-react'

interface InstallmentSeries {
  id: number
  description: string
  merchant_name: string
  total_amount: number
  installment_amount: number
  installment_count: number
  paid_count: number
  remaining_count: number
  remaining_amount: number
  first_installment_date: string
  purchase_date: string | null
  status: string
  created_at: string
}

interface SeriesCardProps {
  series: InstallmentSeries
  onRefresh?: () => void
  isDuplicate?: boolean
  onResolve?: () => void
}

export default function SeriesCard({ series, isDuplicate, onResolve }: SeriesCardProps) {
  const progress = (series.paid_count / series.installment_count) * 100
  const isCompleted = series.status === 'completed'

  return (
    <div className={`bg-slate-800 rounded-xl p-4 border ${
      isDuplicate ? 'border-amber-500/50' : 'border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{series.merchant_name}</h3>
          <p className="text-sm text-gray-400 truncate">{series.description}</p>
        </div>
        {isCompleted && (
          <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 ml-2" />
        )}
        {isDuplicate && (
          <button
            onClick={onResolve}
            className="ml-2 px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
          >
            Resolver
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>{series.paid_count}/{series.installment_count} parcelas pagas</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Parcela</p>
            <p className="font-medium text-white">
              R$ {series.installment_amount.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="font-medium text-white">
              R$ {series.total_amount.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Primeira parcela</p>
            <p className="font-medium text-white">
              {new Date(series.first_installment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {!isCompleted && (
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <div>
              <p className="text-xs text-gray-500">Restante</p>
              <p className="font-medium text-amber-300">
                R$ {series.remaining_amount.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
