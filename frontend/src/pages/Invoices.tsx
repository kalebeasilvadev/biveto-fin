import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { invoicesApi, creditCardsApi, accountsApi, transactionsApi } from '../services/api'
import {
  CreditCard,
  Calendar,
  Check,
  Clock,
  AlertCircle,
  Receipt,
  DollarSign,
  X,
  Trash2,
  ArrowRightLeft,
  AlertTriangle,
  Eye,
  MoreVertical,
  RefreshCw,
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

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Helper to get current month/year
const getCurrentPeriod = () => {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export default function Invoices() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read card filter from URL query parameter
  const cardFromUrl = searchParams.get('card')

  // State
  const [selectedCardId, setSelectedCardId] = useState<number | null>(
    cardFromUrl ? Number(cardFromUrl) : null
  )
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedTab, setSelectedTab] = useState<string | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(true)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [transactionToMove, setTransactionToMove] = useState<{ id: number; description: string } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  const { data: cardsData } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: creditCardsApi.list,
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', selectedCardId, selectedYear],
    queryFn: () => {
      console.log('[Invoices] Fetching with params:', { credit_card_id: selectedCardId, year: selectedYear, limit: 200 })
      return invoicesApi.list({
        credit_card_id: selectedCardId || undefined,
        year: selectedYear,
        limit: 200, // Ensure all invoices for the year are fetched
      })
    },
    staleTime: 0, // Always refetch to ensure fresh data
  })

  const { data: invoiceDetailData } = useQuery({
    queryKey: ['invoice', selectedInvoiceId],
    queryFn: () => invoicesApi.get(selectedInvoiceId!),
    enabled: !!selectedInvoiceId && showDetailModal,
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
      setShowDetailModal(false)
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

  const reprocessMutation = useMutation({
    mutationFn: (creditCardId?: number) => invoicesApi.reprocessOrphanTransactions(creditCardId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      const data = response.data
      if (data.processed > 0) {
        alert(`Reprocessamento concluído!\n\n${data.processed} transações vinculadas às faturas.`)
      } else if (data.found === 0) {
        alert('Nenhuma transação órfã encontrada.')
      }
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      alert(`Erro ao reprocessar: ${error.response?.data?.detail || error.message}`)
    },
  })

  const cards: CreditCardItem[] = cardsData?.data || []
  const accounts: Account[] = (accountsData?.data || []).filter(
    (a: Account) => a.type !== 'credit_card'
  )
  const invoices: Invoice[] = invoicesData?.data || []
  const invoiceDetail: InvoiceDetail | null = invoiceDetailData?.data || null

  // Get available years from invoices
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    invoices.forEach(inv => years.add(inv.reference_year))
    return Array.from(years).sort((a, b) => b - a) // Descending order
  }, [invoices])

  // Generate month tabs for selected year
  // Past months only show if they have unpaid invoices
  const monthTabs = useMemo(() => {
    const { month: currentMonth, year: currentYear } = getCurrentPeriod()
    const tabs: { key: string; label: string; month: number; year: number; isOverdue: boolean; isCurrent: boolean; hasInvoices: boolean }[] = []

    // Generate 12 months for the selected year
    for (let month = 1; month <= 12; month++) {
      const key = `${selectedYear}-${month}`
      const isCurrent = month === currentMonth && selectedYear === currentYear

      // Get invoices for this month
      const monthInvoices = invoices.filter(inv =>
        inv.reference_month === month && inv.reference_year === selectedYear
      )

      const hasInvoices = monthInvoices.length > 0
      const isOverdue = monthInvoices.some(inv => inv.status === 'overdue')

      // Show all months (removed skip logic)

      tabs.push({
        key,
        label: MONTH_NAMES[month - 1],
        month,
        year: selectedYear,
        isOverdue,
        isCurrent,
        hasInvoices,
      })
    }

    return tabs
  }, [invoices, selectedYear])

  // Sync URL with selected card
  useEffect(() => {
    const currentCardInUrl = searchParams.get('card')
    const currentCardValue = selectedCardId ? String(selectedCardId) : null

    if (currentCardInUrl !== currentCardValue) {
      if (selectedCardId) {
        searchParams.set('card', String(selectedCardId))
      } else {
        searchParams.delete('card')
      }
      setSearchParams(searchParams, { replace: true })
    }
  }, [selectedCardId, searchParams, setSearchParams])

  // Set initial selected tab to current month (prioritize overdue, then current, then first with invoices)
  useEffect(() => {
    if (monthTabs.length > 0) {
      const overdueTab = monthTabs.find(t => t.isOverdue)
      const currentTab = monthTabs.find(t => t.isCurrent)
      const firstWithInvoices = monthTabs.find(t => t.hasInvoices)
      const newTab = overdueTab?.key || currentTab?.key || firstWithInvoices?.key || monthTabs[0].key

      // Only update if current tab doesn't match selected year
      const currentSelected = selectedTab?.split('-')[0]
      if (!selectedTab || currentSelected !== String(selectedYear)) {
        setSelectedTab(newTab)
      }
    }
  }, [monthTabs, selectedYear])

  // Filter invoices by selected tab
  const filteredInvoices = useMemo(() => {
    if (!selectedTab) return []
    const [year, month] = selectedTab.split('-').map(Number)
    return invoices.filter(inv => inv.reference_month === month && inv.reference_year === year)
  }, [invoices, selectedTab])

  // Calculate summary for selected tab
  const tabSummary = useMemo(() => {
    const total = filteredInvoices.reduce((sum, inv) => sum + inv.total_amount, 0)
    const remaining = filteredInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0)
    const overdueCount = filteredInvoices.filter(inv => inv.status === 'overdue').length
    return { total, remaining, overdueCount, count: filteredInvoices.length }
  }, [filteredInvoices])

  // Overall summary
  const overallSummary = useMemo(() => {
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue')
    const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0)
    const totalPending = invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + inv.remaining_amount, 0)
    return {
      overdueTotal,
      overdueCount: overdueInvoices.length,
      totalPending,
      pendingCount: invoices.filter(inv => inv.status !== 'paid').length,
    }
  }, [invoices])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const handleViewDetails = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id)
    setShowDetailModal(true)
    setOpenMenuId(null)
    setMenuPosition(null)
  }

  const handlePayClick = (invoice: Invoice) => {
    setInvoiceToPay(invoice)
    setShowPayModal(true)
    setOpenMenuId(null)
    setMenuPosition(null)
  }

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice)
    setShowDeleteModal(true)
    setOpenMenuId(null)
    setMenuPosition(null)
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

  const pluralize = (count: number, singular: string, plural: string) =>
    count === 1 ? singular : plural

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null)
      setMenuPosition(null)
    }
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header with Summary */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faturas</h1>
            {!isLoading && invoices.length > 0 && overallSummary.overdueCount > 0 && (
              <div className="flex items-center gap-1 mt-1 text-sm text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle size={14} />
                <span>{overallSummary.overdueCount} {pluralize(overallSummary.overdueCount, 'vencida', 'vencidas')}</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value))
                setSelectedTab(null)
              }}
              className="input w-auto text-sm"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            {/* Card Filter */}
            <select
              value={selectedCardId || ''}
              onChange={(e) => {
                setSelectedCardId(e.target.value ? Number(e.target.value) : null)
                setSelectedTab(null)
              }}
              className="input w-auto min-w-[100px] sm:min-w-[140px] text-sm"
            >
              <option value="">Todos</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>

            {/* Reprocess Orphan Transactions Button */}
            <button
              onClick={() => reprocessMutation.mutate(selectedCardId || undefined)}
              disabled={reprocessMutation.isPending}
              className="btn btn-secondary text-sm flex items-center gap-1.5"
              title="Reprocessar transações órfãs - vincula transações de cartão que ficaram sem fatura"
            >
              <RefreshCw size={16} className={reprocessMutation.isPending ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Reprocessar</span>
            </button>
          </div>
        </div>

        {/* Pending summary - separate line on mobile */}
        {!isLoading && invoices.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Pendente: <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(overallSummary.totalPending)}</span>
          </div>
        )}
      </div>

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
        <>
          {/* Month Tabs */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-800 to-transparent pointer-events-none z-10 sm:hidden" />
            <div className="flex overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {monthTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key)}
                  className={clsx(
                    'flex-1 min-w-[48px] px-2 sm:px-3 py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                    selectedTab === tab.key
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : tab.hasInvoices
                        ? 'border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                        : 'border-transparent text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-gray-300',
                    tab.isOverdue && selectedTab !== tab.key && 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10'
                  )}
                >
                  <span className="flex items-center justify-center gap-1">
                    {tab.label}
                    {tab.isOverdue && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                    {tab.isCurrent && !tab.isOverdue && tab.hasInvoices && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Summary */}
          {selectedTab && (
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-3 sm:px-4 py-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">{formatCurrency(tabSummary.total)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">A pagar</span>
                <p className={clsx(
                  'font-semibold text-sm sm:text-base',
                  tabSummary.remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                )}>
                  {formatCurrency(tabSummary.remaining)}
                </p>
              </div>
              <div className="hidden sm:block">
                <span className="text-xs text-gray-500 dark:text-gray-400">Cartões</span>
                <p className="font-semibold text-gray-900 dark:text-white">{tabSummary.count}</p>
              </div>
              {tabSummary.overdueCount > 0 && (
                <div className="ml-auto flex items-center gap-1 sm:gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle size={14} className="sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-medium">
                    {tabSummary.overdueCount} {pluralize(tabSummary.overdueCount, 'vencida', 'vencidas')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Invoice Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-x-auto max-w-full">
            <table className="w-full min-w-[700px] table-auto">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cartão
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pago
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Restante
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trans.
                  </th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredInvoices.map((invoice) => {
                  const config = statusConfig[invoice.status]
                  const StatusIcon = config.icon
                  const isOverdue = invoice.status === 'overdue'

                  return (
                    <tr
                      key={invoice.id}
                      className={clsx(
                        'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer',
                        isOverdue && 'bg-red-50/50 dark:bg-red-900/10'
                      )}
                      onClick={() => handleViewDetails(invoice)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className={clsx(
                            isOverdue ? 'text-red-500' : 'text-gray-400'
                          )} />
                          <span className={clsx(
                            'font-medium text-sm',
                            isOverdue ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-white'
                          )}>
                            {invoice.credit_card_name || 'Cartão'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          config.color
                        )}>
                          <StatusIcon size={12} />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {formatCurrency(invoice.paid_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx(
                          'text-sm font-medium',
                          invoice.remaining_amount > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                        )}>
                          {formatCurrency(invoice.remaining_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx(
                          'text-sm',
                          isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                        )}>
                          {formatShortDate(invoice.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {invoice.transaction_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (openMenuId === invoice.id) {
                              setOpenMenuId(null)
                              setMenuPosition(null)
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setMenuPosition({
                                top: rect.bottom + 4,
                                left: rect.right - 140, // 140px = min-width do menu
                              })
                              setOpenMenuId(invoice.id)
                            }
                          }}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          <MoreVertical size={18} className="text-gray-400" />
                        </button>

                        {openMenuId === invoice.id && menuPosition && createPortal(
                          <div
                            className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 min-w-[140px]"
                            style={{ top: menuPosition.top, left: menuPosition.left }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewDetails(invoice)
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Eye size={14} />
                              Ver detalhes
                            </button>
                            {invoice.remaining_amount > 0 && invoice.status !== 'paid' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handlePayClick(invoice)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <DollarSign size={14} />
                                Pagar fatura
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClick(invoice)
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              Excluir
                            </button>
                          </div>,
                          document.body
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filteredInvoices.length === 0 && (
              <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                Nenhuma fatura neste período
              </div>
            )}
          </div>
        </>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {invoiceDetail?.period_display || 'Carregando...'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {invoiceDetail?.credit_card_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedInvoiceId(null)
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {invoiceDetail ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-slate-700/30">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(invoiceDetail.total_amount)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pago</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(invoiceDetail.paid_amount)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Restante</p>
                    <p className={clsx(
                      'text-lg font-bold',
                      invoiceDetail.remaining_amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600'
                    )}>
                      {formatCurrency(invoiceDetail.remaining_amount)}
                    </p>
                  </div>
                </div>

                {/* Info Row */}
                <div className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 dark:text-gray-400">
                      Vencimento: <span className="text-gray-900 dark:text-white font-medium">{formatShortDate(invoiceDetail.due_date)}</span>
                    </span>
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      statusConfig[invoiceDetail.status].color
                    )}>
                      {statusConfig[invoiceDetail.status].label}
                    </span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {invoiceDetail.transactions.length} {pluralize(invoiceDetail.transactions.length, 'transação', 'transações')}
                  </span>
                </div>

                {/* Transactions List */}
                <div className="flex-1 overflow-y-auto p-4">
                  {invoiceDetail.transactions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      Nenhuma transação nesta fatura
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {invoiceDetail.transactions.map((t) => (
                        <div
                          key={t.id}
                          className={clsx(
                            'flex items-center justify-between p-3 rounded-lg group',
                            t.is_paid
                              ? 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                              : 'bg-purple-50/50 dark:bg-purple-900/20'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                {t.description || t.merchant_name || 'Transação'}
                              </span>
                              {!t.is_paid && (
                                <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                                  Projetada
                                </span>
                              )}
                              {t.installment_number && t.installment_total && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({t.installment_number}/{t.installment_total})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{formatShortDate(t.date)}</span>
                              {t.category_name && (
                                <>
                                  <span>•</span>
                                  <span>{t.category_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={clsx(
                              'font-semibold',
                              t.is_paid ? 'text-gray-900 dark:text-white' : 'text-purple-700 dark:text-purple-300'
                            )}>
                              {formatCurrency(t.amount)}
                            </span>
                            <button
                              onClick={() => {
                                setTransactionToMove({
                                  id: t.id,
                                  description: t.description || t.merchant_name || 'Transação',
                                })
                                setShowMoveModal(true)
                              }}
                              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-opacity"
                              title="Mover para outra fatura"
                            >
                              <ArrowRightLeft size={14} className="text-gray-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                {invoiceDetail.remaining_amount > 0 && invoiceDetail.status !== 'paid' && (
                  <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleDeleteClick(invoiceDetail)}
                      className="btn-secondary flex-1"
                    >
                      <Trash2 size={16} className="mr-2" />
                      Excluir
                    </button>
                    <button
                      onClick={() => handlePayClick(invoiceDetail)}
                      className={clsx(
                        'flex-1',
                        invoiceDetail.status === 'overdue'
                          ? 'btn-primary bg-red-600 hover:bg-red-700'
                          : 'btn-primary'
                      )}
                    >
                      <DollarSign size={16} className="mr-2" />
                      {invoiceDetail.status === 'overdue' ? 'Pagar Agora' : 'Pagar Fatura'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
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

      {/* Delete Modal */}
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
                    Remove a fatura e {invoiceToDelete.transaction_count === 1 ? 'a transação vinculada' : `todas as ${invoiceToDelete.transaction_count} transações vinculadas`}.
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
                    Remove a fatura mas mantém as transações.
                  </p>
                </div>
              </label>
            </div>

            {deleteTransactions && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Atenção: Esta ação não pode ser desfeita.
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

      {/* Move Transaction Modal */}
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
                      .filter((inv) => inv.id !== selectedInvoiceId)
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
