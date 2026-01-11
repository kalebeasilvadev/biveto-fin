import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi, creditCardsApi, accountsApi, transactionsApi } from '../services/api'
import {
  CreditCard,
  Calendar,
  ChevronRight,
  Check,
  Clock,
  AlertCircle,
  Receipt,
  DollarSign,
  X,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'

interface Invoice {
  id: number
  credit_card_id: number
  credit_card_name: string | null
  reference_month: number
  reference_year: number
  period_display: string
  closing_date: string
  due_date: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: 'open' | 'closed' | 'paid' | 'partial' | 'overdue'
  transaction_count: number
}

interface InvoiceDetail extends Invoice {
  transactions: {
    id: number
    date: string
    description: string | null
    merchant_name: string | null
    category_name: string | null
    amount: number
    installment_number: number | null
    installment_total: number | null
    is_paid: boolean
  }[]
}

interface CreditCardItem {
  id: number
  name: string
}

interface Account {
  id: number
  name: string
  type: string
}

const statusConfig = {
  open: { label: 'Aberta', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Clock },
  closed: { label: 'Fechada', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Calendar },
  paid: { label: 'Paga', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: Check },
  partial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: DollarSign },
  overdue: { label: 'Vencida', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: AlertCircle },
}

export default function Invoices() {
  const queryClient = useQueryClient()
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(true)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [transactionToMove, setTransactionToMove] = useState<{ id: number; description: string } | null>(null)

  const { data: cardsData } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: creditCardsApi.list,
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', selectedCardId, statusFilter],
    queryFn: () =>
      invoicesApi.list({
        credit_card_id: selectedCardId || undefined,
        status: statusFilter || undefined,
      }),
  })

  const { data: invoiceDetailData } = useQuery({
    queryKey: ['invoice', selectedInvoice],
    queryFn: () => invoicesApi.get(selectedInvoice!),
    enabled: !!selectedInvoice,
  })

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { amount: number; payment_account_id: number } }) =>
      invoicesApi.pay(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setShowPayModal(false)
      setInvoiceToPay(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteTransactions }: { id: number; deleteTransactions: boolean }) =>
      invoicesApi.delete(id, deleteTransactions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      setShowDeleteModal(false)
      setInvoiceToDelete(null)
      setDeleteTransactions(true)
      if (selectedInvoice === invoiceToDelete?.id) {
        setSelectedInvoice(null)
      }
    },
  })

  const moveTransactionMutation = useMutation({
    mutationFn: ({ transactionId, invoiceId }: { transactionId: number; invoiceId: number | null }) =>
      transactionsApi.update(transactionId, { invoice_id: invoiceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setShowMoveModal(false)
      setTransactionToMove(null)
    },
  })

  const cards: CreditCardItem[] = cardsData?.data || []
  const accounts: Account[] = (accountsData?.data || []).filter(
    (a: Account) => a.type !== 'credit_card'
  )
  const invoices: Invoice[] = invoicesData?.data || []
  const invoiceDetail: InvoiceDetail | null = invoiceDetailData?.data || null

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('pt-BR')
  }

  const handlePayClick = (invoice: Invoice) => {
    setInvoiceToPay(invoice)
    setShowPayModal(true)
  }

  const handlePaySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!invoiceToPay) return

    const formData = new FormData(e.currentTarget)
    payMutation.mutate({
      id: invoiceToPay.id,
      data: {
        amount: Number(formData.get('amount')),
        payment_account_id: Number(formData.get('payment_account_id')),
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faturas</h1>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cartão
            </label>
            <select
              value={selectedCardId || ''}
              onChange={(e) => setSelectedCardId(e.target.value ? Number(e.target.value) : null)}
              className="input"
            >
              <option value="">Todos os cartões</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="">Todos</option>
              <option value="open">Abertas</option>
              <option value="closed">Fechadas</option>
              <option value="paid">Pagas</option>
              <option value="partial">Parcialmente pagas</option>
              <option value="overdue">Vencidas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Faturas */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma fatura encontrada"
              description="As faturas aparecerão aqui quando você adicionar transações aos seus cartões de crédito."
            />
          ) : (
            invoices.map((invoice) => {
              const config = statusConfig[invoice.status]
              const StatusIcon = config.icon

              return (
                <div
                  key={invoice.id}
                  className={clsx(
                    'card cursor-pointer transition-all hover:shadow-md',
                    selectedInvoice === invoice.id && 'ring-2 ring-primary-500'
                  )}
                  onClick={() => setSelectedInvoice(invoice.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg">
                        <CreditCard size={24} className="text-gray-600 dark:text-gray-300" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {invoice.credit_card_name || 'Cartão'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {invoice.period_display}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={clsx('px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1', config.color)}>
                        <StatusIcon size={12} />
                        {config.label}
                      </span>
                      <ChevronRight size={20} className="text-gray-400" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pago</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(invoice.paid_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Restante</p>
                      <p className={clsx(
                        'font-semibold',
                        invoice.remaining_amount > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-900 dark:text-white'
                      )}>
                        {formatCurrency(invoice.remaining_amount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Vencimento: {formatDate(invoice.due_date)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {invoice.transaction_count} transações
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {invoice.status !== 'paid' && invoice.remaining_amount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePayClick(invoice)
                        }}
                        className="btn-primary flex-1"
                      >
                        Pagar Fatura
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setInvoiceToDelete(invoice)
                        setShowDeleteModal(true)
                      }}
                      className="btn-secondary px-3"
                      title="Excluir fatura"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Detalhes da Fatura */}
        <div className="lg:col-span-1">
          {invoiceDetail ? (
            <div className="card sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Transações da Fatura
                </h3>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {invoiceDetail.transactions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhuma transação nesta fatura
                </p>
              ) : (
                <>
                  {/* Summary of projected vs confirmed */}
                  {(() => {
                    const projectedCount = invoiceDetail.transactions.filter(t => !t.is_paid).length
                    const confirmedCount = invoiceDetail.transactions.filter(t => t.is_paid).length
                    if (projectedCount > 0) {
                      return (
                        <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                              <Clock size={12} />
                              <span>{projectedCount} projetada(s)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-300">
                              <Check size={12} />
                              <span>{confirmedCount} confirmada(s)</span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {invoiceDetail.transactions.map((t) => (
                      <div
                        key={t.id}
                        className={clsx(
                          "flex items-center justify-between p-2 rounded-lg group",
                          t.is_paid
                            ? "hover:bg-gray-50 dark:hover:bg-slate-700"
                            : "bg-purple-50/50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {t.description || t.merchant_name || 'Transação'}
                            </p>
                            {!t.is_paid && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded flex items-center gap-0.5">
                                <Clock size={10} />
                                Projetado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(t.date)}
                            {t.installment_number && t.installment_total && (
                              <span className="ml-2">
                                ({t.installment_number}/{t.installment_total})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={clsx(
                            "font-semibold text-sm",
                            t.is_paid
                              ? "text-gray-900 dark:text-white"
                              : "text-purple-700 dark:text-purple-300"
                          )}>
                            {formatCurrency(t.amount)}
                          </p>
                          <button
                            onClick={() => {
                              setTransactionToMove({
                                id: t.id,
                                description: t.description || t.merchant_name || 'Transação',
                              })
                              setShowMoveModal(true)
                            }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-opacity"
                            title="Mover para outra fatura"
                          >
                            <ArrowRightLeft size={14} className="text-gray-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatCurrency(invoiceDetail.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <Receipt size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Selecione uma fatura para ver os detalhes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pagamento */}
      {showPayModal && invoiceToPay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Pagar Fatura
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {invoiceToPay.credit_card_name} - {invoiceToPay.period_display}
            </p>
            <form onSubmit={handlePaySubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor a Pagar
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    max={invoiceToPay.remaining_amount}
                    defaultValue={invoiceToPay.remaining_amount}
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor restante: {formatCurrency(invoiceToPay.remaining_amount)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Conta de Pagamento
                  </label>
                  <select name="payment_account_id" className="input" required>
                    <option value="">Selecione</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPayModal(false)
                    setInvoiceToPay(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={payMutation.isPending}
                >
                  {payMutation.isPending ? 'Pagando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      {showDeleteModal && invoiceToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Excluir Fatura
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Tem certeza que deseja excluir a fatura?
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              {invoiceToDelete.credit_card_name} - {invoiceToDelete.period_display}
            </p>

            {/* Opção para deletar transações */}
            <div className="mb-4 space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                <input
                  type="radio"
                  name="deleteOption"
                  checked={deleteTransactions}
                  onChange={() => setDeleteTransactions(true)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Excluir fatura e transações
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Remove a fatura e todas as {invoiceToDelete.transaction_count} transações vinculadas.
                    Use esta opção para relançar a fatura.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                <input
                  type="radio"
                  name="deleteOption"
                  checked={!deleteTransactions}
                  onChange={() => setDeleteTransactions(false)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Apenas desvincular transações
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Remove a fatura mas mantém as transações (elas ficam sem fatura vinculada).
                  </p>
                </div>
              </label>
            </div>

            {deleteTransactions && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Atenção: Esta ação não pode ser desfeita. As transações serão permanentemente excluídas.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setInvoiceToDelete(null)
                  setDeleteTransactions(true)
                }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate({
                  id: invoiceToDelete.id,
                  deleteTransactions,
                })}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mover Transação */}
      {showMoveModal && transactionToMove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Mover Transação
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Mover "{transactionToMove.description}" para:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const invoiceId = formData.get('invoice_id')
                moveTransactionMutation.mutate({
                  transactionId: transactionToMove.id,
                  invoiceId: invoiceId ? Number(invoiceId) : null,
                })
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fatura de Destino
                  </label>
                  <select name="invoice_id" className="input">
                    <option value="">Nenhuma (desvincular)</option>
                    {invoices
                      .filter((inv) => inv.id !== selectedInvoice)
                      .map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.credit_card_name} - {inv.period_display}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoveModal(false)
                    setTransactionToMove(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={moveTransactionMutation.isPending}
                >
                  {moveTransactionMutation.isPending ? 'Movendo...' : 'Mover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
