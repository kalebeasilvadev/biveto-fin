import { CheckSquare, Square, CheckCircle2, AlertCircle, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { ExtractedItem, CATEGORY_MAP } from '../../types/upload'

interface ExtractedItemsListProps {
  items: ExtractedItem[]
  selectedItems: number[]
  editingItemIndex: number | null
  onToggleItem: (index: number) => void
  onToggleAll: () => void
  onEditItem: (index: number | null) => void
  onBatchAdd: () => void
  onAddAll: () => void
  hasAccount: boolean
  batchAddPending: boolean
  batchAddSuccess: number
  batchAddSkipped: string[]
  batchAddError: string | null
  onClearError: () => void
}

export default function ExtractedItemsList({
  items,
  selectedItems,
  editingItemIndex,
  onToggleItem,
  onToggleAll,
  onEditItem,
  onBatchAdd,
  onAddAll,
  hasAccount,
  batchAddPending,
  batchAddSuccess,
  batchAddSkipped,
  batchAddError,
  onClearError,
}: ExtractedItemsListProps) {
  return (
    <div className="space-y-4">
      {/* Header with select all */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleAll}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors"
          >
            {selectedItems.length === items.length ? (
              <CheckSquare size={20} className="text-primary-600" />
            ) : (
              <Square size={20} />
            )}
            <span>
              {selectedItems.length === items.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </span>
          </button>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {selectedItems.length} de {items.length} selecionados
        </span>
      </div>

      {/* Items list */}
      <div className="max-h-80 overflow-y-auto space-y-2 -mx-1 px-1">
        {items.map((item, index) => {
          const isSelected = selectedItems.includes(index)
          const isEditing = editingItemIndex === index

          return (
            <div
              key={index}
              className={clsx(
                'rounded-xl border-2 transition-all overflow-hidden',
                isSelected
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                  : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-600'
              )}
            >
              {/* Main row */}
              <div
                onClick={() => onToggleItem(index)}
                className="flex items-center gap-3 p-3 cursor-pointer"
              >
                {/* Checkbox */}
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <CheckCircle2 size={22} className="text-primary-600" />
                  ) : (
                    <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </div>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                      {item.description}
                    </p>
                    {item.is_installment && item.installment_current && item.installment_total && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                        {item.installment_current}/{item.installment_total}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.date && (
                      <span>{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    )}
                    {item.category && (
                      <>
                        <span>•</span>
                        <span className="capitalize">
                          {CATEGORY_MAP[item.category.toLowerCase()] || item.category}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="flex-shrink-0 text-right">
                  <span className={clsx(
                    'font-bold',
                    item.amount < 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'
                  )}>
                    {item.amount < 0 ? '+' : ''} R$ {Math.abs(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Edit button */}
              {isSelected && (
                <div className="px-3 pb-3 pt-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditItem(isEditing ? null : index)
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {isEditing ? 'Fechar edição' : 'Editar detalhes'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Batch add progress */}
      {batchAddPending && (
        <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
            <span className="font-medium text-primary-700 dark:text-primary-300">
              Adicionando transações...
            </span>
          </div>
          <div className="w-full bg-primary-200 dark:bg-primary-800 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${((batchAddSuccess + batchAddSkipped.length) / selectedItems.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
            {batchAddSuccess} adicionadas, {batchAddSkipped.length} puladas de {selectedItems.length}
          </p>
        </div>
      )}

      {/* Success with skipped items */}
      {!batchAddPending && batchAddSkipped.length > 0 && batchAddSuccess > 0 && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="text-green-600" size={20} />
            <span className="font-medium text-green-800 dark:text-green-300">
              {batchAddSuccess} transações adicionadas!
            </span>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-2">
            <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mb-1">
              {batchAddSkipped.length} item(ns) já existiam e foram ignorados:
            </p>
            <ul className="text-xs text-yellow-700 dark:text-yellow-400 list-disc list-inside">
              {batchAddSkipped.slice(0, 5).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {batchAddSkipped.length > 5 && (
                <li>e mais {batchAddSkipped.length - 5}...</li>
              )}
            </ul>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">Redirecionando para transações...</p>
        </div>
      )}

      {/* Batch add error */}
      {batchAddError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="font-medium text-red-800 dark:text-red-300">Erro ao adicionar</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{batchAddError}</p>
          <button
            onClick={onClearError}
            className="text-xs text-red-600 hover:underline mt-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!batchAddPending && (
        <div className="space-y-2">
          {/* Selected total */}
          {selectedItems.length > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 rounded-lg p-2">
              <span>Total selecionado:</span>
              <span className="font-bold text-gray-900 dark:text-white">
                R$ {items
                  .filter((_, i) => selectedItems.includes(i))
                  .reduce((sum, item) => sum + Math.abs(item.amount), 0)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Add buttons */}
          <div className="flex gap-2">
            <button
              onClick={onAddAll}
              disabled={!hasAccount}
              className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckSquare size={18} />
              Adicionar Todos ({items.length})
            </button>
          </div>
          {selectedItems.length > 0 && selectedItems.length < items.length && (
            <button
              onClick={onBatchAdd}
              disabled={!hasAccount}
              className="w-full btn-secondary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={18} />
              Adicionar Selecionados ({selectedItems.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
