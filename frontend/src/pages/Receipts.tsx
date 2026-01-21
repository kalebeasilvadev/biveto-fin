import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { receiptsApi, getApiErrorMessage } from '../services/api'
import {
  Receipt,
  Store,
  Calendar,
  CreditCard,
  ChevronRight,
  SplitSquareVertical,
} from 'lucide-react'
import { HelpButton } from '../components/help'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import { Link } from 'react-router-dom'

interface ReceiptItem {
  id: number
  document_id: number | null
  store_name: string
  purchase_date: string
  total_amount: number
  status: string
  status_display: string
  items_count: number
  payments_count: number
  has_split_payment: boolean
  created_at: string
}

// Status color mapping
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

// Format date in Brazilian format
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Format currency
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Format compact currency for mobile
function formatCompactCurrency(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 1_000_000) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 1,
      notation: 'compact',
      compactDisplay: 'short'
    })
  }
  if (absValue >= 10_000) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    })
  }
  return formatCurrency(value)
}

export default function Receipts() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const { data, isLoading, error } = useQuery({
    queryKey: ['receipts', statusFilter],
    queryFn: () => receiptsApi.list({ status: statusFilter, limit: 50 }),
  })

  const receipts: ReceiptItem[] = data?.data || []

  // Calculate totals
  const confirmedReceipts = receipts.filter(r => r.status === 'confirmed')
  const totalAmount = confirmedReceipts.reduce((sum, r) => sum + r.total_amount, 0)
  const totalItems = confirmedReceipts.reduce((sum, r) => sum + r.items_count, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{getApiErrorMessage(error, 'Erro ao carregar compras')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compras</h1>
            <HelpButton pageId="receipts" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cupons fiscais e compras com split de pagamento
          </p>
        </div>
        <Link
          to="/upload"
          className="btn-primary flex items-center gap-2 whitespace-nowrap flex-shrink-0"
        >
          <Receipt size={18} />
          <span className="hidden sm:inline">Importar Cupom</span>
          <span className="sm:hidden">Importar</span>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white p-3 sm:p-4">
          <p className="text-xs sm:text-sm opacity-90">Total Confirmado</p>
          <p className="text-sm sm:text-2xl font-bold mt-1" title={formatCurrency(totalAmount)}>
            <span className="sm:hidden">{formatCompactCurrency(totalAmount)}</span>
            <span className="hidden sm:inline">{formatCurrency(totalAmount)}</span>
          </p>
        </div>
        <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 sm:p-4">
          <p className="text-xs sm:text-sm opacity-90">Total de Compras</p>
          <p className="text-sm sm:text-2xl font-bold mt-1">{confirmedReceipts.length}</p>
        </div>
        <div className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-xs sm:text-sm opacity-90">Total de Itens</p>
          <p className="text-sm sm:text-2xl font-bold mt-1">{totalItems}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter(undefined)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            !statusFilter
              ? 'bg-biveto text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300'
          )}
        >
          Todas
        </button>
        <button
          onClick={() => setStatusFilter('confirmed')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            statusFilter === 'confirmed'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300'
          )}
        >
          Confirmadas
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            statusFilter === 'pending'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300'
          )}
        >
          Pendentes
        </button>
      </div>

      {/* Receipts List */}
      {receipts.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma compra encontrada"
          description="Importe cupons fiscais para acompanhar suas compras com detalhes de itens e formas de pagamento."
          actionLabel="Importar cupom"
          actionOnClick={() => window.location.href = '/upload'}
        />
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="card p-4 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Store Icon */}
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Store size={24} className="text-gray-600 dark:text-gray-300" />
                  </div>

                  {/* Receipt Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {receipt.store_name}
                      </h3>
                      {receipt.has_split_payment && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full flex-shrink-0">
                          <SplitSquareVertical size={12} />
                          Split
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(receipt.purchase_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard size={14} />
                        {receipt.payments_count} pagto{receipt.payments_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {/* Tags */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', statusColors[receipt.status])}>
                        {receipt.status_display}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {receipt.items_count} {receipt.items_count === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount and Chevron */}
                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {formatCurrency(receipt.total_amount)}
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
