import { useState } from 'react'
import { AlertTriangle, X, ArrowRight } from 'lucide-react'

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
  status: string
  created_at: string
}

interface ConflictDetail {
  installment_number: number
  series_a_transaction_id: number | null
  series_a_date: string | null
  series_b_transaction_id: number | null
  series_b_date: string | null
  description: string
}

interface DuplicateGroup {
  series: InstallmentSeries[]
  similarity_score: number
  conflicts: ConflictDetail[]
  suggested_primary_id: number
  estimated_excess: number
}

interface MergeModalProps {
  group: DuplicateGroup
  onMerge: (sourceId: number, targetId: number, conflictResolution: string) => void
  onSkip: () => void
  isPending?: boolean
}

export default function MergeModal({ group, onMerge, onSkip, isPending }: MergeModalProps) {
  const [conflictResolution, setConflictResolution] = useState<string>('keep_oldest')

  const [seriesA, seriesB] = group.series
  const suggestedTarget = group.series.find(s => s.id === group.suggested_primary_id)
  const suggestedSource = group.series.find(s => s.id !== group.suggested_primary_id)

  const handleMerge = () => {
    if (suggestedSource && suggestedTarget) {
      onMerge(suggestedSource.id, suggestedTarget.id, conflictResolution)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl max-w-2xl w-full p-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-400" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-white">
                Duplicata Detectada
              </h3>
              <p className="text-sm text-gray-400">
                {(group.similarity_score * 100).toFixed(0)}% de similaridade
              </p>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Séries */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Série A */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-white text-sm">Série 1</h4>
                {seriesA.id === group.suggested_primary_id && (
                  <span className="px-2 py-0.5 text-xs bg-primary-500/20 text-primary-300 rounded">
                    Sugerida
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300 mb-1">{seriesA.merchant_name}</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>{seriesA.paid_count}/{seriesA.installment_count} parcelas pagas</p>
                <p>R$ {seriesA.installment_amount.toFixed(2)} × {seriesA.installment_count}</p>
                <p>Criada em {new Date(seriesA.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* Série B */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-white text-sm">Série 2</h4>
                {seriesB.id === group.suggested_primary_id && (
                  <span className="px-2 py-0.5 text-xs bg-primary-500/20 text-primary-300 rounded">
                    Sugerida
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300 mb-1">{seriesB.merchant_name}</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>{seriesB.paid_count}/{seriesB.installment_count} parcelas pagas</p>
                <p>R$ {seriesB.installment_amount.toFixed(2)} × {seriesB.installment_count}</p>
                <p>Criada em {new Date(seriesB.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conflitos */}
        {group.conflicts.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-white mb-2">
              Conflitos ({group.conflicts.length})
            </h4>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-400 mb-2">
                Ambas as séries têm as mesmas parcelas:
              </p>
              <div className="space-y-1">
                {group.conflicts.slice(0, 3).map((conflict, i) => (
                  <p key={i} className="text-xs text-amber-300">
                    • Parcela {conflict.installment_number}/{seriesA.installment_count}
                  </p>
                ))}
                {group.conflicts.length > 3 && (
                  <p className="text-xs text-amber-400">
                    + {group.conflicts.length - 3} mais
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Impacto */}
        {group.estimated_excess > 0 && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-300">
              Valor duplicado estimado: <strong>R$ {group.estimated_excess.toFixed(2)}</strong>
            </p>
          </div>
        )}

        {/* Resolução de conflitos */}
        {group.conflicts.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-white mb-2">
              Como resolver conflitos?
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="conflict_resolution"
                  value="keep_oldest"
                  checked={conflictResolution === 'keep_oldest'}
                  onChange={(e) => setConflictResolution(e.target.value)}
                  className="text-primary-500"
                />
                <span className="text-sm text-gray-300">
                  Manter a mais antiga (recomendado)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="conflict_resolution"
                  value="keep_newest"
                  checked={conflictResolution === 'keep_newest'}
                  onChange={(e) => setConflictResolution(e.target.value)}
                  className="text-primary-500"
                />
                <span className="text-sm text-gray-300">
                  Manter a mais recente
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="conflict_resolution"
                  value="keep_both"
                  checked={conflictResolution === 'keep_both'}
                  onChange={(e) => setConflictResolution(e.target.value)}
                  className="text-primary-500"
                />
                <span className="text-sm text-gray-300">
                  Manter ambas (não recomendado)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={handleMerge}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Mesclando...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Mesclar Séries
              </>
            )}
          </button>
          <button
            onClick={onSkip}
            disabled={isPending}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Pular
          </button>
        </div>
      </div>
    </div>
  )
}
