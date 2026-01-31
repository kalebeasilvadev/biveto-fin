import { AlertTriangle } from 'lucide-react'
import { ExtractedItem } from '../../types/upload'

interface PotentialDuplicateSeries {
  series_id: number
  description: string
  merchant_name: string
  installment_count: number
  installment_amount: number
  paid_count: number
  similarity_score: number
  first_installment_date: string
}

interface DuplicateResolutionModalProps {
  item: ExtractedItem
  itemIndex: number
  duplicate: PotentialDuplicateSeries
  onLink: (seriesId: number) => void
  onCreateNew: () => void
  onClose: () => void
}

export default function DuplicateResolutionModal({
  item,
  duplicate,
  onLink,
  onCreateNew,
  onClose
}: DuplicateResolutionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="text-amber-400" size={20} />
          <h3 className="text-lg font-semibold text-white">
            Parcela Similar Encontrada
          </h3>
        </div>

        <div className="space-y-4">
          {/* Parcela atual */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Parcela no PDF:</p>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="font-medium text-white">{item.description}</p>
              <p className="text-sm text-gray-400">
                {item.installment_current}/{item.installment_total} •
                R$ {Math.abs(item.amount).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Série existente */}
          <div>
            <p className="text-xs text-gray-400 mb-2">
              Pode ser a mesma compra que:
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="font-medium text-amber-300">
                {duplicate.merchant_name}
              </p>
              <p className="text-sm text-amber-400">
                {duplicate.paid_count}/{duplicate.installment_count} parcelas pagas •
                R$ {duplicate.installment_amount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Similaridade: {(duplicate.similarity_score * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onLink(duplicate.series_id)}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              Vincular à Série
            </button>
            <button
              onClick={onCreateNew}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Criar Nova
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full text-sm text-gray-400 hover:text-white transition-colors"
          >
            Decidir depois
          </button>
        </div>
      </div>
    </div>
  )
}
