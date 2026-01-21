import { useState } from 'react'
import { CheckSquare, Square, CheckCircle2, AlertCircle, Check, AlertTriangle, Clock, Repeat, Plus, Save, X, ChevronDown, ChevronRight, Edit3, CalendarClock } from 'lucide-react'
import { clsx } from 'clsx'
import { ExtractedItem, CATEGORY_MAP } from '../../types/upload'

// Categorias disponíveis para seleção
const AVAILABLE_CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'moradia', label: 'Moradia' },
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'assinaturas', label: 'Assinaturas' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'viagem', label: 'Viagem' },
  { value: 'outros', label: 'Outros' },
  { value: 'pagamento', label: 'Pagamento' },
]

interface PendingDuplicate {
  index: number
  description: string
  message: string
}

interface ProjectedInfo {
  has_projected: boolean
  projected_transaction_id?: number
  projected_date?: string
  series_id?: number
  series_description?: string
  message?: string
}

interface ExtractedItemsListProps {
  items: ExtractedItem[]
  selectedItems: number[]
  editingItemIndex: number | null
  onToggleItem: (index: number) => void
  onToggleAll: () => void
  onEditItem: (index: number | null) => void
  onUpdateItem?: (index: number, updatedItem: Partial<ExtractedItem>) => void
  onBatchAdd: () => void
  onAddAll: () => void
  hasAccount: boolean
  batchAddPending: boolean
  batchAddSuccess: number
  batchAddSkipped: string[]
  batchAddError: string | null
  onClearError: () => void
  onNavigateToTransactions?: () => void
  onReset?: () => void
  pendingDuplicates?: PendingDuplicate[]
  onForceAddDuplicates?: () => void
  onSkipDuplicates?: () => void
  projectedInfo?: Record<number, ProjectedInfo>
  isCheckingProjected?: boolean
  onCreateRecurring?: (index: number) => void
  creatingRecurringIndex?: number | null
  onCreateAllRecurrences?: () => void
  isCreatingAllRecurrences?: boolean
  onDismissRecurring?: (index: number) => void
}

export default function ExtractedItemsList({
  items,
  selectedItems,
  editingItemIndex,
  onToggleItem,
  onToggleAll,
  onEditItem,
  onUpdateItem,
  onBatchAdd,
  onAddAll,
  hasAccount,
  batchAddPending,
  batchAddSuccess,
  batchAddSkipped,
  batchAddError,
  onClearError,
  onNavigateToTransactions,
  onReset,
  pendingDuplicates = [],
  onForceAddDuplicates,
  onSkipDuplicates,
  projectedInfo = {},
  isCheckingProjected = false,
  onCreateRecurring,
  creatingRecurringIndex,
  onCreateAllRecurrences,
  isCreatingAllRecurrences = false,
  onDismissRecurring,
}: ExtractedItemsListProps) {
  // Estado para alertas colapsáveis
  const [alertsExpanded, setAlertsExpanded] = useState(true)

  // Estado para modal de edição
  const [editForm, setEditForm] = useState<{
    description: string
    category: string
    amount: string
    is_installment: boolean
    installment_current: string
    installment_total: string
  } | null>(null)

  // Contagens
  const duplicateCount = items.filter(item => item.is_duplicate).length
  const projectedCount = Object.values(projectedInfo).filter(info => info.has_projected).length
  const recurringCount = items.filter(item =>
    item.recurring_detection?.is_known_service &&
    !item.recurring_detection?.is_user_recurring
  ).length
  const hasAlerts = duplicateCount > 0 || projectedCount > 0 || recurringCount > 0 || isCheckingProjected

  // Calcular totais (TODOS os items, não apenas selecionados)
  const totalDespesas = items
    .filter(item => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0)
  // Estornos: valores negativos que NÃO são pagamento
  const totalEstornos = items
    .filter(item => item.amount < 0 && item.category?.toLowerCase() !== 'pagamento')
    .reduce((sum, item) => sum + item.amount, 0)
  // Pagamentos: categoria = pagamento (sempre negativo)
  const totalPagamentos = items
    .filter(item => item.category?.toLowerCase() === 'pagamento')
    .reduce((sum, item) => sum + item.amount, 0)
  const totalFatura = totalDespesas + totalEstornos

  // Funções de edição
  const startEditing = (index: number, item: ExtractedItem) => {
    setEditForm({
      description: item.description || '',
      category: item.category || 'outros',
      amount: Math.abs(item.amount).toString(),
      is_installment: item.is_installment || false,
      installment_current: item.installment_current?.toString() || '',
      installment_total: item.installment_total?.toString() || '',
    })
    onEditItem(index)
  }

  const saveEdit = (index: number, item: ExtractedItem) => {
    if (!editForm || !onUpdateItem) return
    const amount = parseFloat(editForm.amount) || item.amount
    const finalAmount = item.amount < 0 ? -Math.abs(amount) : Math.abs(amount)
    onUpdateItem(index, {
      description: editForm.description.trim() || item.description,
      category: editForm.category,
      amount: finalAmount,
      is_installment: editForm.is_installment,
      installment_current: editForm.is_installment ? parseInt(editForm.installment_current) || null : null,
      installment_total: editForm.is_installment ? parseInt(editForm.installment_total) || null : null,
    })
    setEditForm(null)
    onEditItem(null)
  }

  const cancelEdit = () => {
    setEditForm(null)
    onEditItem(null)
  }

  // Obter item sendo editado
  const editingItem = editingItemIndex !== null ? items[editingItemIndex] : null

  return (
    <div className="space-y-3">
      {/* ========== ALERTAS COLAPSÁVEIS ========== */}
      {hasAlerts && (
        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setAlertsExpanded(!alertsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              {alertsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Alertas e ações</span>
            </div>
            <div className="flex items-center gap-1.5">
              {projectedCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center bg-purple-500/20 text-purple-400 rounded-full text-[10px]">
                  {projectedCount}
                </span>
              )}
              {recurringCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center bg-green-500/20 text-green-400 rounded-full text-[10px]">
                  {recurringCount}
                </span>
              )}
              {duplicateCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center bg-amber-500/20 text-amber-400 rounded-full text-[10px]">
                  {duplicateCount}
                </span>
              )}
            </div>
          </button>

          {alertsExpanded && (
            <div className="px-3 pb-3 space-y-2">
              {/* Verificando projetadas */}
              {isCheckingProjected && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg text-xs text-blue-400">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent" />
                  Verificando parcelas projetadas...
                </div>
              )}

              {/* Projetadas */}
              {!isCheckingProjected && projectedCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 rounded-lg text-xs">
                  <Clock size={14} className="text-purple-400 flex-shrink-0" />
                  <span className="text-purple-300">
                    <strong>{projectedCount}</strong> parcela(s) já projetada(s) - serão confirmadas
                  </span>
                </div>
              )}

              {/* Recorrentes */}
              {recurringCount > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-green-500/10 rounded-lg">
                  <div className="flex items-center gap-2 text-xs">
                    <Repeat size={14} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-300">
                      <strong>{recurringCount}</strong> serviço(s) recorrente(s)
                    </span>
                  </div>
                  {onCreateAllRecurrences && (
                    <button
                      onClick={onCreateAllRecurrences}
                      disabled={isCreatingAllRecurrences}
                      className="px-2 py-1 text-[10px] font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                    >
                      {isCreatingAllRecurrences ? '...' : `Criar (${recurringCount})`}
                    </button>
                  )}
                </div>
              )}

              {/* Duplicados */}
              {duplicateCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg text-xs">
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                  <span className="text-amber-300">
                    <strong>{duplicateCount}</strong> item(ns) pode(m) já existir
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== HEADER: SELEÇÃO + RESUMO ========== */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleAll}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {selectedItems.length === items.length ? (
            <CheckSquare size={18} className="text-primary-500" />
          ) : (
            <Square size={18} />
          )}
          <span>{selectedItems.length === items.length ? 'Desmarcar' : 'Selecionar todos'}</span>
        </button>
        <span className="text-xs text-gray-500">
          {selectedItems.length} de {items.length}
        </span>
      </div>

      {/* ========== LISTA DE ITEMS (CARDS COMPACTOS) ========== */}
      <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
        {items.map((item, index) => {
          const isSelected = selectedItems.includes(index)
          const isEditing = editingItemIndex === index
          const hasProjected = projectedInfo[index]?.has_projected
          const isRecurring = item.recurring_detection?.is_known_service && !item.recurring_detection?.is_user_recurring
          const isUserRecurring = item.recurring_detection?.is_user_recurring
          const hasFutureInstallments = item.future_installments && item.future_installments.length > 0

          return (
            <div
              key={index}
              className={clsx(
                'rounded-xl border-2 transition-all',
                isEditing && 'border-primary-500 bg-primary-500/10',
                item.is_duplicate && !isEditing && 'border-amber-500/30 bg-amber-500/5',
                isSelected && !isEditing && !item.is_duplicate && 'border-primary-500/50 bg-primary-500/5',
                !isSelected && !isEditing && !item.is_duplicate && 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              )}
            >
              {/* Card content */}
              <div
                onClick={() => onToggleItem(index)}
                className="flex items-start gap-3 p-3 cursor-pointer"
              >
                {/* Checkbox */}
                <div className="flex-shrink-0 mt-0.5">
                  {isSelected ? (
                    <CheckCircle2 size={20} className="text-primary-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Linha 1: Descrição */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white text-sm leading-tight">
                      {item.description}
                    </p>
                    <span className={clsx(
                      'flex-shrink-0 font-bold text-sm',
                      item.amount < 0 ? 'text-green-400' : 'text-white'
                    )}>
                      {item.amount < 0 ? '+' : ''}R$ {Math.abs(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Linha 2: Meta info */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* Data */}
                    <span className="text-xs text-gray-500">
                      {item.date ? new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </span>

                    <span className="text-gray-600">•</span>

                    {/* Categoria */}
                    <span className="text-xs text-gray-400">
                      {CATEGORY_MAP[item.category?.toLowerCase() || ''] || item.category || 'Outros'}
                    </span>

                    {/* Badges */}
                    {hasProjected && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded">
                        <Clock size={10} />
                        Projetado
                      </span>
                    )}
                    {item.is_duplicate && !hasProjected && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-300 rounded">
                        <AlertTriangle size={10} />
                        Duplicado
                      </span>
                    )}
                    {isRecurring && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-300 rounded">
                        <Repeat size={10} />
                        {item.recurring_detection?.known_service_name || 'Recorrente'}
                      </span>
                    )}
                    {isUserRecurring && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-teal-500/20 text-teal-300 rounded">
                        <Repeat size={10} />
                        Cadastrado
                      </span>
                    )}
                    {item.is_installment && item.installment_current && item.installment_total && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 rounded">
                        {item.installment_current}/{item.installment_total}
                      </span>
                    )}
                    {hasFutureInstallments && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-indigo-500/20 text-indigo-300 rounded" title="Parcelas futuras serão projetadas">
                        <CalendarClock size={10} />
                        +{item.future_installments!.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botão editar */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    startEditing(index, item)
                  }}
                  className="flex-shrink-0 p-1.5 text-gray-500 hover:text-primary-400 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit3 size={16} />
                </button>
              </div>

              {/* Ação de criar recorrência (se aplicável e selecionado) */}
              {isSelected && isRecurring && item.recurring_detection?.suggested_recurring && onCreateRecurring && (
                <div className="px-3 pb-3 pt-0 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateRecurring(index)
                    }}
                    disabled={creatingRecurringIndex === index}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {creatingRecurringIndex === index ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-green-400 border-t-transparent" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        Criar Recorrência
                      </>
                    )}
                  </button>
                  {onDismissRecurring && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDismissRecurring(index)
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Não é recorrente"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ========== RESUMO TOTAIS ========== */}
      <div className="bg-slate-800/50 rounded-xl p-3 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Despesas:</span>
          <span className="font-medium text-white">
            R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        {totalEstornos < 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Estornos/Créditos:</span>
            <span className="font-medium text-green-400">
              R$ {totalEstornos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
        {totalPagamentos !== 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Pagamento fatura:</span>
            <span className="font-medium text-blue-400">
              R$ {totalPagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-700">
          <span className="font-medium text-gray-300">Total fatura:</span>
          <span className="font-bold text-white">
            R$ {totalFatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* ========== STATUS E AÇÕES ========== */}
      {/* Batch add progress */}
      {batchAddPending && (
        <div className="bg-primary-500/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent" />
            <span className="font-medium text-primary-300">Adicionando transações...</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${((batchAddSuccess + batchAddSkipped.length) / selectedItems.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-primary-400 mt-1">
            {batchAddSuccess} adicionadas, {batchAddSkipped.length} ignoradas
          </p>
        </div>
      )}

      {/* Pending duplicates */}
      {!batchAddPending && pendingDuplicates.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-amber-400" size={18} />
            <span className="font-medium text-amber-300">
              {pendingDuplicates.length} item(ns) pode(m) ser duplicado(s)
            </span>
          </div>
          <div className="flex gap-2">
            {onForceAddDuplicates && (
              <button onClick={onForceAddDuplicates} className="flex-1 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors">
                Adicionar Mesmo Assim
              </button>
            )}
            {onSkipDuplicates && (
              <button onClick={onSkipDuplicates} className="flex-1 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                Ignorar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success message */}
      {!batchAddPending && pendingDuplicates.length === 0 && batchAddSuccess > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="text-green-400" size={18} />
            <span className="font-medium text-green-300">
              {batchAddSuccess} transações adicionadas!
            </span>
          </div>
          {batchAddSkipped.length > 0 && (
            <p className="text-xs text-yellow-400 mb-2">
              {batchAddSkipped.length} item(ns) já existiam
            </p>
          )}
          <div className="flex gap-2">
            {onNavigateToTransactions && (
              <button onClick={onNavigateToTransactions} className="flex-1 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
                Ver Transações
              </button>
            )}
            {onReset && (
              <button onClick={onReset} className="flex-1 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                Nova Fatura
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {batchAddError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-400" size={18} />
            <span className="font-medium text-red-300">Erro ao adicionar</span>
          </div>
          <p className="text-sm text-red-400 mt-1">{batchAddError}</p>
          <button onClick={onClearError} className="text-xs text-red-400 hover:underline mt-2">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!batchAddPending && pendingDuplicates.length === 0 && batchAddSuccess === 0 && (
        <div className="space-y-2">
          <button
            onClick={onAddAll}
            disabled={!hasAccount || items.length === 0}
            className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckSquare size={18} />
            Adicionar Todos ({items.length})
          </button>
          {selectedItems.length > 0 && selectedItems.length < items.length && (
            <button
              onClick={onBatchAdd}
              disabled={!hasAccount}
              className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <Check size={18} />
              Adicionar Selecionados ({selectedItems.length})
            </button>
          )}
        </div>
      )}

      {/* ========== MODAL DE EDIÇÃO ========== */}
      {editingItemIndex !== null && editForm && editingItem && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={cancelEdit}
          />

          {/* Modal (bottom sheet em mobile, centered em desktop) */}
          <div className="fixed z-50 bg-slate-900 border border-slate-700 overflow-y-auto animate-slide-up
            inset-x-0 bottom-0 rounded-t-2xl p-4 pb-8 max-h-[80vh]
            sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:w-full sm:max-w-md sm:max-h-[90vh] sm:p-6">
            {/* Handle (só no mobile) */}
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Editar Item</h3>
              <button
                onClick={cancelEdit}
                className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Descrição */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Nome do item"
              />
            </div>

            {/* Categoria */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {AVAILABLE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Valor */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Parcelamento */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_installment}
                  onChange={(e) => setEditForm({ ...editForm, is_installment: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-300">É parcelado</span>
              </label>

              {editForm.is_installment && (
                <div className="flex items-center gap-3 mt-3 pl-8">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Parcela atual</label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={editForm.installment_current}
                      onChange={(e) => setEditForm({ ...editForm, installment_current: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white"
                    />
                  </div>
                  <span className="text-gray-500 mt-5">/</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Total parcelas</label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={editForm.installment_total}
                      onChange={(e) => setEditForm({ ...editForm, installment_total: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Criar recorrência */}
            {editingItem.recurring_detection?.is_known_service &&
             !editingItem.recurring_detection?.is_user_recurring &&
             editingItem.recurring_detection?.suggested_recurring &&
             onCreateRecurring && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => onCreateRecurring(editingItemIndex)}
                  disabled={creatingRecurringIndex === editingItemIndex}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  {creatingRecurringIndex === editingItemIndex ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-400 border-t-transparent" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Criar Recorrência
                    </>
                  )}
                </button>
                {onDismissRecurring && (
                  <button
                    onClick={() => {
                      onDismissRecurring(editingItemIndex)
                      cancelEdit()
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-gray-400 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                    title="Não é recorrente"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex gap-3">
              <button
                onClick={() => saveEdit(editingItemIndex, editingItem)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors"
              >
                <Save size={18} />
                Salvar
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X size={18} />
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* CSS para animação */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
