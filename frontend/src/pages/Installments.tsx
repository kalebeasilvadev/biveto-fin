import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tantml:react-query'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import { installmentsApi } from '../services/api'
import SeriesCard from '../components/installments/SeriesCard'
import MergeModal from '../components/installments/MergeModal'

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

export default function Installments() {
  const [showMergeModal, setShowMergeModal] = useState<DuplicateGroup | null>(null)
  const queryClient = useQueryClient()
  const location = useLocation()

  // Capturar contexto de navegação (se veio de uma fatura)
  const navigationState = location.state as {
    fromInvoice?: number
    highlightDuplicates?: number[][]
  } | null

  // Buscar séries
  const { data: seriesData, isLoading: isLoadingSeries } = useQuery<{ data: InstallmentSeries[] }>({
    queryKey: ['installments'],
    queryFn: () => installmentsApi.list(),
  })

  // Detectar duplicatas
  const { data: duplicatesData, isLoading: isLoadingDuplicates } = useQuery<{
    data: { duplicate_groups: DuplicateGroup[]; total_groups: number }
  }>({
    queryKey: ['installments-duplicates'],
    queryFn: () => installmentsApi.detectDuplicates(),
  })

  // Mutation para merge
  const mergeMutation = useMutation({
    mutationFn: (data: {
      source_series_id: number
      target_series_id: number
      conflict_resolution: string
    }) => installmentsApi.merge(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments'] })
      queryClient.invalidateQueries({ queryKey: ['installments-duplicates'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-duplicates'] })
      setShowMergeModal(null)
    },
  })

  const series = seriesData?.data || []
  const allDuplicateGroups = duplicatesData?.data?.duplicate_groups || []

  // Filtrar duplicatas se vier de uma fatura específica
  const duplicateGroups = navigationState?.highlightDuplicates
    ? allDuplicateGroups.filter(group => {
        const seriesIds = group.series.map(s => s.id)
        return navigationState.highlightDuplicates!.some(pair =>
          pair.every(id => seriesIds.includes(id))
        )
      })
    : allDuplicateGroups

  const handleMerge = (sourceId: number, targetId: number, conflictResolution: string) => {
    mergeMutation.mutate({
      source_series_id: sourceId,
      target_series_id: targetId,
      conflict_resolution: conflictResolution,
    })
  }

  const handleSkip = () => {
    setShowMergeModal(null)
  }

  // Auto-abrir modal se houver duplicatas
  useEffect(() => {
    if (duplicateGroups.length > 0 && !showMergeModal) {
      setShowMergeModal(duplicateGroups[0])
    }
  }, [duplicateGroups.length])

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {navigationState?.fromInvoice && (
            <button
              onClick={() => window.history.back()}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Voltar para a fatura"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Compras Parceladas</h1>
            {navigationState?.fromInvoice && (
              <p className="text-sm text-amber-400 mt-1">
                Mostrando apenas duplicatas da fatura selecionada
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {duplicateGroups.length > 0 && (
            <button
              onClick={() => setShowMergeModal(duplicateGroups[0])}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              <AlertTriangle size={16} />
              {duplicateGroups.length} Duplicata(s)
            </button>
          )}

          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['installments'] })
              queryClient.invalidateQueries({ queryKey: ['installments-duplicates'] })
            }}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Loading states */}
      {(isLoadingSeries || isLoadingDuplicates) && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoadingSeries && series.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">Nenhuma compra parcelada encontrada</p>
        </div>
      )}

      {/* Series list */}
      {!isLoadingSeries && series.length > 0 && (
        <div className="space-y-4">
          {series.map((s) => {
            // Verificar se esta série faz parte de um grupo duplicado
            const isDuplicate = duplicateGroups.some(g =>
              g.series.some(series => series.id === s.id)
            )

            return (
              <SeriesCard
                key={s.id}
                series={s}
                isDuplicate={isDuplicate}
                onResolve={() => {
                  const group = duplicateGroups.find(g =>
                    g.series.some(series => series.id === s.id)
                  )
                  if (group) setShowMergeModal(group)
                }}
                onRefresh={() => {
                  queryClient.invalidateQueries({ queryKey: ['installments'] })
                }}
              />
            )
          })}
        </div>
      )}

      {/* Modal de merge */}
      {showMergeModal && (
        <MergeModal
          group={showMergeModal}
          onMerge={handleMerge}
          onSkip={handleSkip}
          isPending={mergeMutation.isPending}
        />
      )}
    </div>
  )
}
