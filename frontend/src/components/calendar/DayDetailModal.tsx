import { X, TrendingUp, TrendingDown, Clock, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface TransactionSummary {
  id: number
  description: string
  amount: number
  type: string
  category_name: string | null
  category_icon: string | null
  account_name: string | null
  is_paid: boolean
}

interface ProjectionItem {
  projection_type: string
  description: string
  amount: number
  is_income: boolean
  category_name: string | null
  category_icon: string | null
  account_name: string | null
  entity_type: string | null
  entity_id: number | null
  confidence: number
}

interface DailyEntry {
  date: string
  is_past: boolean
  is_today: boolean
  is_weekend: boolean
  confirmed_income: number
  confirmed_expense: number
  confirmed_count: number
  projected_income: number
  projected_expense: number
  projected_count: number
  net_confirmed: number
  net_projected: number
  net_total: number
  transactions: TransactionSummary[]
  projections: ProjectionItem[]
}

interface DayDetailModalProps {
  day: DailyEntry
  onClose: () => void
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const projectionTypeLabels: Record<string, string> = {
  recurring: 'Recorrente',
  invoice: 'Fatura',
  debt: 'Dívida',
  installment: 'Parcela',
}

export default function DayDetailModal({ day, onClose }: DayDetailModalProps) {
  const date = new Date(day.date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const totalIncome = day.confirmed_income + day.projected_income
  const totalExpense = day.confirmed_expense + day.projected_expense
  const net = totalIncome - totalExpense

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {formattedDate}
            </h2>
            {day.is_today && (
              <span className="text-sm text-blue-600 dark:text-blue-400">Hoje</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-center">
            <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Receitas</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="text-center">
            <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Despesas</p>
            <p className="font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="text-center">
            <div
              className={clsx(
                'w-5 h-5 mx-auto mb-1 rounded-full flex items-center justify-center text-xs font-bold',
                net >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              )}
            >
              {net >= 0 ? '+' : '-'}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Saldo</p>
            <p
              className={clsx(
                'font-semibold',
                net >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {formatCurrency(net)}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[400px]">
          {/* Confirmed Transactions */}
          {day.transactions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Transações confirmadas ({day.transactions.length})
              </h3>
              <div className="space-y-2">
                {day.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {transaction.description || 'Sem descrição'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {transaction.category_name || 'Sem categoria'}
                        {transaction.account_name && ` • ${transaction.account_name}`}
                      </p>
                    </div>
                    <p
                      className={clsx(
                        'font-medium',
                        transaction.type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projections */}
          {day.projections.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Projeções ({day.projections.length})
              </h3>
              <div className="space-y-2">
                {day.projections.map((projection, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {projection.description}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {projectionTypeLabels[projection.projection_type] ||
                          projection.projection_type}
                        {projection.category_name && ` • ${projection.category_name}`}
                      </p>
                    </div>
                    <p
                      className={clsx(
                        'font-medium',
                        projection.is_income
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {projection.is_income ? '+' : '-'}
                      {formatCurrency(projection.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {day.transactions.length === 0 && day.projections.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Nenhuma transação neste dia</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
