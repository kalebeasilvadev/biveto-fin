import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { installmentsApi } from '../../services/api'

interface DuplicateAlertProps {
  invoiceId: number
}

export default function DuplicateAlert({ invoiceId }: DuplicateAlertProps) {
  const navigate = useNavigate()

  const { data: duplicateWarnings } = useQuery({
    queryKey: ['invoice-duplicates', invoiceId],
    queryFn: () => installmentsApi.getDuplicateWarnings(invoiceId),
    enabled: !!invoiceId,
  })

  if (!duplicateWarnings?.data?.has_duplicates) {
    return null
  }

  const { estimated_excess, duplicate_count, affected_series_pairs } = duplicateWarnings.data

  const handleResolve = () => {
    // Navegar para /installments
    navigate('/installments')
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-amber-300">
            Possível duplicata detectada
          </span>
        </div>
      </div>
      <p className="text-xs text-amber-400 mb-3">
        Esta fatura pode estar com <strong>R$ {estimated_excess.toFixed(2)}</strong> a mais
        devido a {duplicate_count} parcela(s) duplicada(s)
      </p>
      <button
        onClick={handleResolve}
        className="w-full px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Resolver Agora
      </button>
    </div>
  )
}
