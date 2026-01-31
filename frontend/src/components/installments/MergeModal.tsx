import { useState } from 'react'
import { AlertTriangle, X, ArrowRight, RefreshCw } from 'lucide-react'

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

  // Determinar qual é a original (primeira criada) e qual é a duplicada
  const [seriesA, seriesB] = group.series
  const seriesADate = new Date(seriesA.created_at)
  const seriesBDate = new Date(seriesB.created_at)
  const isAOlder = seriesADate < seriesBDate

  // Estado para controlar qual série o usuário escolheu como principal
  const [selectedTargetId, setSelectedTargetId] = useState<number>(
    group.suggested_primary_id
  )

  const targetSeries = group.series.find(s => s.id === selectedTargetId)!
  const sourceSeries = group.series.find(s => s.id !== selectedTargetId)!

  const handleMerge = () => {
    onMerge(sourceSeries.id, targetSeries.id, conflictResolution)
  }

  const handleSwap = () => {
    setSelectedTargetId(sourceSeries.id)
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

        {/* Escolha de série principal */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">
              Escolha qual série manter como principal:
            </h4>
            <button
              onClick={handleSwap}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Inverter
            </button>
          </div>
        </div>

        {/* Séries */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Série A */}
            <div
              onClick={() => setSelectedTargetId(seriesA.id)}
              className={`rounded-lg p-4 border-2 cursor-pointer transition-all ${
                seriesA.id === selectedTargetId
                  ? 'bg-primary-500/10 border-primary-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    seriesA.id === selectedTargetId
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-slate-600'
                  }`}>
                    {seriesA.id === selectedTargetId && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <h4 className="font-medium text-white text-sm">
                    {seriesA.id === selectedTargetId ? 'Principal (Manter)' : 'Remover'}
                  </h4>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  isAOlder
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isAOlder ? 'ORIGINAL' : 'DUPLICADA'}
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-1">{seriesA.merchant_name}</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>{seriesA.paid_count}/{seriesA.installment_count} parcelas pagas</p>
                <p>R$ {seriesA.installment_amount.toFixed(2)} × {seriesA.installment_count}</p>
                <p>Criada em {new Date(seriesA.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* Série B */}
            <div
              onClick={() => setSelectedTargetId(seriesB.id)}
              className={`rounded-lg p-4 border-2 cursor-pointer transition-all ${
                seriesB.id === selectedTargetId
                  ? 'bg-primary-500/10 border-primary-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    seriesB.id === selectedTargetId
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-slate-600'
                  }`}>
                    {seriesB.id === selectedTargetId && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <h4 className="font-medium text-white text-sm">
                    {seriesB.id === selectedTargetId ? 'Principal (Manter)' : 'Remover'}
                  </h4>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  !isAOlder
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {!isAOlder ? 'ORIGINAL' : 'DUPLICADA'}
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-1">{seriesB.merchant_name}</p>
              <div className="space-y-1 text-xs text-gray-400">
                <p>{seriesB.paid_count}/{seriesB.installment_count} parcelas pagas</p>
                <p>R$ {seriesB.installment_amount.toFixed(2)} × {seriesB.installment_count}</p>
                <p>Criada em {new Date(seriesB.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Explicação */}
          <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-white">O que acontecerá:</strong> A série "{sourceSeries.merchant_name}" será removida
              e suas {sourceSeries.paid_count} transação(ões) serão movidas para "{targetSeries.merchant_name}".
            </p>
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
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Mesclando...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Mesclar e Remover Duplicada
              </>
            )}
          </button>
          <button
            onClick={onSkip}
            disabled={isPending}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Pular
          </button>
        </div>

        {/* Resumo da ação */}
        <p className="text-xs text-center text-gray-500 mt-3">
          Ao mesclar, você manterá <strong className="text-white">{targetSeries.merchant_name}</strong> e removerá a duplicata
        </p>
      </div>
    </div>
  )
}
