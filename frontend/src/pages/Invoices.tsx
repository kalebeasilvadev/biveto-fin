import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { invoicesApi, creditCardsApi, accountsApi, transactionsApi, categoriesApi } from '../services/api'
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  FileText,
  FileWarning,
  FilePlus,
  Upload,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import { HelpButton } from '../components/help'
import DuplicateAlert from '../components/invoices/DuplicateAlert'

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
  document_id: number | null
}

// Item "fantasma" - fatura esperada mas nunca criada (sem registro no banco).
// Vindo do endpoint /invoices/overview quando state === 'not_created'.
interface PhantomInvoice {
  isPhantom: true
  credit_card_id: number
  credit_card_name: string
  reference_month: number
  reference_year: number
  closing_date: string
  due_date: string
}

type InvoiceOverviewItem = {
  credit_card_id: number
  credit_card_name: string
  reference_month: number
  reference_year: number
  closing_date: string
  due_date: string
  state: 'not_created' | 'created_no_document' | 'created_with_document' | 'paid' | 'future'
  is_pending: boolean
  is_phantom: boolean
  invoice_id: number | null
  document_id: number | null
  total_amount: number | null
  paid_amount: number | null
  status: string | null
}

type InvoiceOverviewResponse = {
  reference_month: number
  reference_year: number
  items: InvoiceOverviewItem[]
  total_cards: number
  pending_count: number
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

type SortField = 'credit_card_name' | 'status' | 'total_amount' | 'paid_amount' | 'remaining_amount' | 'due_date' | 'transaction_count'
type SortDirection = 'asc' | 'desc'

// Helper to get current month/year
const getCurrentPeriod = () => {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export default function Invoices() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filters from URL query parameters (deep-link de notificacao)
  const cardFromUrl = searchParams.get('card')
  const yearFromUrl = searchParams.get('year')
  const monthFromUrl = searchParams.get('month')

  // State
  const [selectedCardId, setSelectedCardId] = useState<number | null>(
    cardFromUrl ? Number(cardFromUrl) : null
  )
  const [selectedYear, setSelectedYear] = useState<number>(
    yearFromUrl ? Number(yearFromUrl) : new Date().getFullYear()
  )
  const [selectedTab, setSelectedTab] = useState<string | null>(
    yearFromUrl && monthFromUrl ? `${yearFromUrl}-${Number(monthFromUrl)}` : null
  )
  // ID do cartao a ser destacado na tabela (vindo do deep-link)
  const [highlightedCardId, setHighlightedCardId] = useState<number | null>(
    cardFromUrl ? Number(cardFromUrl) : null
  )

  // Remove o destaque apos 3 segundos
  useEffect(() => {
    if (highlightedCardId) {
      const timer = setTimeout(() => setHighlightedCardId(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [highlightedCardId])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(true)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [transactionToMove, setTransactionToMove] = useState<{ id: number; description: string } | null>(null)
  const [showEditTransactionModal, setShowEditTransactionModal] = useState(false)
  const [transactionToEdit, setTransactionToEdit] = useState<any | null>(null)
  const [showDeleteTransactionModal, setShowDeleteTransactionModal] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<{ id: number; description: string } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [sortField, setSortField] = useState<SortField>('total_amount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data: cardsData } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: creditCardsApi.list,
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', selectedCardId, selectedYear],
    queryFn: () => invoicesApi.list({
      credit_card_id: selectedCardId || undefined,
      year: selectedYear,
      limit: 200, // Ensure all invoices for the year are fetched
    }),
    staleTime: 0, // Always refetch to ensure fresh data
  })

  // Overview do mes atualmente selecionado: inclui fantasmas (faturas esperadas
  // mas ainda nao criadas) e estado derivado de cada item.
  const selectedTabParts = selectedTab?.split('-').map(Number)
  const overviewYear = selectedTabParts?.[0]
  const overviewMonth = selectedTabParts?.[1]

  const { data: overviewData } = useQuery({
    queryKey: ['invoice-overview', overviewYear, overviewMonth],
    queryFn: () => invoicesApi.overview(overviewYear!, overviewMonth!),
    enabled: !!overviewYear && !!overviewMonth,
    staleTime: 0,
  })

  const overview: InvoiceOverviewResponse | null = overviewData?.data || null

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

  const editTransactionMutation = useMutation({
    mutationFn: ({ transactionId, data }: { transactionId: number; data: any }) =>
      transactionsApi.update(transactionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      setShowEditTransactionModal(false)
      setTransactionToEdit(null)
    },
  })

  const deleteTransactionMutation = useMutation({
    mutationFn: (transactionId: number) => transactionsApi.delete(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      setShowDeleteTransactionModal(false)
      setTransactionToDelete(null)
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
  const categories: any[] = categoriesData?.data || []
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
    const tabs: {
      key: string
      label: string
      month: number
      year: number
      isOverdue: boolean
      isCurrent: boolean
      hasInvoices: boolean
      hasMissingDocument: boolean  // existe fatura sem PDF carregado (laranja)
    }[] = []

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
      // Laranja: existe fatura criada mas sem PDF anexado
      const hasMissingDocument = monthInvoices.some(inv => inv.document_id == null)

      // Show all months (removed skip logic)

      tabs.push({
        key,
        label: MONTH_NAMES[month - 1],
        month,
        year: selectedYear,
        isOverdue,
        isCurrent,
        hasInvoices,
        hasMissingDocument,
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

  // Filter and sort invoices by selected tab
  const filteredInvoices = useMemo(() => {
    if (!selectedTab) return []
    const [year, month] = selectedTab.split('-').map(Number)
    const filtered = invoices.filter(inv => inv.reference_month === month && inv.reference_year === year)

    // Sort invoices
    const statusOrder = { overdue: 0, closed: 1, open: 2, partial: 3, paid: 4 }

    return [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'credit_card_name':
          comparison = (a.credit_card_name || '').localeCompare(b.credit_card_name || '')
          break
        case 'status':
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case 'total_amount':
          comparison = a.total_amount - b.total_amount
          break
        case 'paid_amount':
          comparison = a.paid_amount - b.paid_amount
          break
        case 'remaining_amount':
          comparison = a.remaining_amount - b.remaining_amount
          break
        case 'due_date':
          comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          break
        case 'transaction_count':
          comparison = a.transaction_count - b.transaction_count
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [invoices, selectedTab, sortField, sortDirection])

  // Fantasmas: faturas esperadas para o mes selecionado que nao tem registro
  // materializado em credit_card_invoices. Vem do endpoint /overview.
  const phantomInvoices = useMemo<PhantomInvoice[]>(() => {
    if (!overview) return []
    return overview.items
      .filter(item => item.is_phantom && item.state === 'not_created')
      .map(item => ({
        isPhantom: true as const,
        credit_card_id: item.credit_card_id,
        credit_card_name: item.credit_card_name,
        reference_month: item.reference_month,
        reference_year: item.reference_year,
        closing_date: item.closing_date,
        due_date: item.due_date,
      }))
  }, [overview])

  // Contagem de pendencias para o mes selecionado: inclui nao-criadas
  // (fantasmas) + faturas materializadas sem document_id (oca).
  const pendingCount = useMemo(() => {
    if (overview) return overview.pending_count
    // Fallback: conta faturas sem documento na lista geral
    return filteredInvoices.filter(inv => inv.document_id == null).length
  }, [overview, filteredInvoices])

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-400" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={14} className="text-primary-600 dark:text-primary-400" />
      : <ArrowDown size={14} className="text-primary-600 dark:text-primary-400" />
  }

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faturas</h1>
              <HelpButton pageId="invoices" />
            </div>
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
                    {/* Vermelho: tem fatura vencida neste mes */}
                    {tab.isOverdue && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-red-500"
                        title="Mes com fatura vencida"
                      />
                    )}
                    {/* Laranja: tem fatura criada sem PDF carregado */}
                    {!tab.isOverdue && tab.hasMissingDocument && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-orange-500"
                        title="Fatura sem PDF carregado"
                      />
                    )}
                    {/* Verde: tudo carregado (mostra apenas quando ha faturas e nada pendente) */}
                    {!tab.isOverdue && !tab.hasMissingDocument && tab.hasInvoices && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-500"
                        title="Mes com tudo carregado"
                      />
                    )}
                    {tab.isCurrent && !tab.isOverdue && !tab.hasMissingDocument && !tab.hasInvoices && (
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
              {pendingCount > 0 && (
                <div
                  className="flex items-center gap-1 sm:gap-2 text-orange-600 dark:text-orange-400"
                  title="Faturas esperadas que ainda nao tem PDF carregado"
                >
                  <FileWarning size={14} className="sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-medium">
                    Faltam fatura: {pendingCount}
                  </span>
                </div>
              )}
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
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
                    onClick={() => handleSort('credit_card_name')}
                  >
                    <div className="flex items-center gap-1">
                      Cartão
                      {renderSortIcon('credit_card_name')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {renderSortIcon('status')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none"
                    title="Indica se a fatura tem o PDF/documento carregado"
                  >
                    Documento
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
                    onClick={() => handleSort('total_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      {renderSortIcon('total_amount')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
                    onClick={() => handleSort('paid_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Pago
                      {renderSortIcon('paid_amount')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
                    onClick={() => handleSort('remaining_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Restante
                      {renderSortIcon('remaining_amount')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
                    onClick={() => handleSort('due_date')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Vencimento
                      {renderSortIcon('due_date')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
                    onClick={() => handleSort('transaction_count')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Trans.
                      {renderSortIcon('transaction_count')}
                    </div>
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
                        isOverdue && 'bg-red-50/50 dark:bg-red-900/10',
                        highlightedCardId === invoice.credit_card_id && 'ring-2 ring-primary-400 dark:ring-primary-500 animate-pulse'
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
                      <td className="px-4 py-3">
                        {invoice.document_id != null ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            title="PDF carregado"
                          >
                            <FileText size={12} />
                            PDF
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                            title="Fatura sem PDF anexado"
                          >
                            <FileWarning size={12} />
                            Sem PDF
                          </span>
                        )}
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

                {/* Linhas-fantasma: cartoes cuja fatura deveria existir para este mes mas ainda nao foi criada. */}
                {phantomInvoices.map((phantom) => (
                  <tr
                    key={`phantom-${phantom.credit_card_id}-${phantom.reference_year}-${phantom.reference_month}`}
                    className={clsx(
                      'opacity-60 hover:opacity-100 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all',
                      highlightedCardId === phantom.credit_card_id && 'opacity-100 ring-2 ring-primary-400 dark:ring-primary-500 animate-pulse'
                    )}
                    title="Fatura esperada ainda nao carregada - clique para carregar"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-orange-500" />
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                          {phantom.credit_card_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                        <Clock size={12} />
                        Aguardando fatura
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                        title="Nenhum registro de fatura existe para este periodo"
                      >
                        <FilePlus size={12} />
                        Carregar
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                      {formatShortDate(phantom.due_date)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-400 dark:text-gray-500">—</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Deep-link para upload pre-selecionando o cartao
                          window.location.href = `/documents?upload=1&card=${phantom.credit_card_id}`
                        }}
                        className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                        title="Carregar fatura"
                      >
                        <Upload size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredInvoices.length === 0 && phantomInvoices.length === 0 && (
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

                {/* Duplicate Alert */}
                <div className="px-4 pt-4">
                  <DuplicateAlert invoiceId={invoiceDetail.id} />
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
                          <div className="flex items-center gap-2">
                            <span className={clsx(
                              'font-semibold',
                              t.is_paid ? 'text-gray-900 dark:text-white' : 'text-purple-700 dark:text-purple-300'
                            )}>
                              {formatCurrency(t.amount)}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setTransactionToEdit(t)
                                  setShowEditTransactionModal(true)
                                }}
                                className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                title="Editar transação"
                              >
                                <Pencil size={14} className="text-blue-600 dark:text-blue-400" />
                              </button>
                              <button
                                onClick={() => {
                                  setTransactionToMove({
                                    id: t.id,
                                    description: t.description || t.merchant_name || 'Transação',
                                  })
                                  setShowMoveModal(true)
                                }}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-colors"
                                title="Mover para outra fatura"
                              >
                                <ArrowRightLeft size={14} className="text-gray-500" />
                              </button>
                              <button
                                onClick={() => {
                                  setTransactionToDelete({
                                    id: t.id,
                                    description: t.description || t.merchant_name || 'Transação',
                                  })
                                  setShowDeleteTransactionModal(true)
                                }}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Excluir transação"
                              >
                                <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                              </button>
                            </div>
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

      {/* Edit Transaction Modal */}
      {showEditTransactionModal && transactionToEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Editar Transação
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const updateData: any = {}

                const amount = formData.get('amount')
                const description = formData.get('description')
                const date = formData.get('date')
                const categoryId = formData.get('category_id')

                if (amount) updateData.amount = Number(amount)
                if (description !== transactionToEdit.description) updateData.description = String(description)
                if (date) updateData.date = String(date)
                if (categoryId) updateData.category_id = Number(categoryId)

                editTransactionMutation.mutate({
                  transactionId: transactionToEdit.id,
                  data: updateData,
                })
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    name="description"
                    defaultValue={transactionToEdit.description || transactionToEdit.merchant_name || ''}
                    className="input"
                    placeholder="Ex: Compra no supermercado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    defaultValue={Math.abs(transactionToEdit.amount)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={transactionToEdit.date}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria
                  </label>
                  <select
                    name="category_id"
                    defaultValue={transactionToEdit.category_id || ''}
                    className="input"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditTransactionModal(false)
                    setTransactionToEdit(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={editTransactionMutation.isPending}
                >
                  {editTransactionMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Transaction Modal */}
      {showDeleteTransactionModal && transactionToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Excluir Transação
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Tem certeza que deseja excluir esta transação?
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              {transactionToDelete.description}
            </p>

            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Dica:</strong> Use esta opção para remover transações duplicadas ou projetadas incorretamente.
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                Atenção: Esta ação não pode ser desfeita. A transação será removida permanentemente.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteTransactionModal(false)
                  setTransactionToDelete(null)
                }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTransactionMutation.mutate(transactionToDelete.id)}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleteTransactionMutation.isPending}
              >
                {deleteTransactionMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
