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
  X,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { HelpButton } from '../components/help'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import { Link } from 'react-router-dom'

interface ReceiptPayment {
  id: number
  payment_method: string
  amount: number
  account_id: number
  account_name: string | null
  benefit_card_id: number | null
  benefit_card_name: string | null
  sequence: number
  original_label: string | null
}

interface ReceiptDetail {
  id: number
  document_id: number | null
  store_name: string
  store_cnpj: string | null
  purchase_date: string
  total_amount: number
  subtotal: number | null
  discount: number | null
  status: string
  status_display: string
  items_count: number
  payments_count: number
  has_split_payment: boolean
  payments: ReceiptPayment[]
  created_at: string
  confirmed_at: string | null
}

interface ReceiptItemTransaction {
  id: number
  description: string
  amount: number
  category_id: number | null
  date: string
}

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
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['receipts', statusFilter],
    queryFn: () => receiptsApi.list({ status: statusFilter, limit: 50 }),
  })

  // Query para detalhes do receipt selecionado
  const { data: receiptDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['receipt', selectedReceiptId],
    queryFn: () => receiptsApi.get(selectedReceiptId!),
    enabled: !!selectedReceiptId,
  })

  // Query para itens do receipt selecionado
  const { data: receiptItems } = useQuery({
    queryKey: ['receipt-items', selectedReceiptId],
    queryFn: () => receiptsApi.getItems(selectedReceiptId!),
    enabled: !!selectedReceiptId,
  })

  const detail: ReceiptDetail | null = receiptDetail?.data || null
  const items: ReceiptItemTransaction[] = receiptItems?.data || []

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
              onClick={() => setSelectedReceiptId(receipt.id)}
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

      {/* Modal de Detalhes */}
      {selectedReceiptId && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setSelectedReceiptId(null)}>
          <div
            className="bg-white dark:bg-slate-800 w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detalhes da Compra
              </h2>
              <button
                onClick={() => setSelectedReceiptId(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-60px)] space-y-4">
              {isLoadingDetail ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : detail ? (
                <>
                  {/* Store Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                      <Store size={28} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {detail.store_name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(detail.purchase_date)}
                        {detail.store_cnpj && ` • CNPJ: ${detail.store_cnpj}`}
                      </p>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2">
                    {detail.subtotal && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(detail.subtotal)}</span>
                      </div>
                    )}
                    {detail.discount && detail.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Desconto</span>
                        <span className="text-green-600">-{formatCurrency(detail.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2 border-t border-gray-200 dark:border-slate-600">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-gray-900 dark:text-white">{formatCurrency(detail.total_amount)}</span>
                    </div>
                  </div>

                  {/* Payments */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Wallet size={16} />
                      <span>Formas de Pagamento</span>
                    </div>
                    <div className="space-y-2">
                      {detail.payments.map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {payment.benefit_card_name || payment.account_name || 'Conta'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {payment.original_label || payment.payment_method}
                            </p>
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <ShoppingBag size={16} />
                      <span>Itens ({items.length})</span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">
                            {item.description}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">Erro ao carregar detalhes</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
