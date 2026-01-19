import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, categoriesApi, accountsApi } from '../services/api'
import {
  Plus,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Trash2,
  Calendar,
  Tag,
  CreditCard,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { HelpButton } from '../components/help'
import EmptyState from '../components/EmptyState'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'

interface Transaction {
  id: number
  type: 'expense' | 'income' | 'transfer'
  amount: number
  date: string
  description: string | null
  notes: string | null
  category_id: number | null
  category_name: string | null
  account_id: number
  account_name: string | null
  merchant_name: string | null
  is_fixed: boolean
  is_recurring: boolean
  is_paid: boolean
  installment_number: number | null
  installment_total: number | null
  tags: string[] | null
  // Transfer fields
  linked_transaction_id: number | null
  is_transfer_out: boolean
  is_transfer_in: boolean
  linked_account_name: string | null
}

interface Category {
  id: number
  name: string
  type: string
}

interface PaginatedResponse {
  items: Transaction[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

const ITEMS_PER_PAGE = 20

const accountTypeLabels: Record<string, string> = {
  wallet: 'Carteira',
  bank: 'Banco',
  credit_card: 'Cartão',
  investment: 'Investimento',
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// TransactionCard component for mobile view
function TransactionCard({
  transaction,
  onClick,
  formatCurrency,
  formatDateBR
}: {
  transaction: Transaction
  onClick: () => void
  formatCurrency: (value: number) => string
  formatDateBR: (dateStr: string) => string
}) {
  const typeConfig = {
    income: {
      icon: ArrowUpRight,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30'
    },
    expense: {
      icon: ArrowDownRight,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30'
    },
    transfer: {
      icon: ArrowRightLeft,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    },
  }

  const config = typeConfig[transaction.type]
  const Icon = config.icon

  const displayName = transaction.type === 'transfer'
    ? (transaction.description || 'Transferência')
    : (transaction.merchant_name || transaction.description || 'Transação')

  return (
    <div
      onClick={onClick}
      className={clsx(
        'px-3 py-2.5 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700',
        'active:scale-[0.99] transition-transform cursor-pointer',
        !transaction.is_paid && 'border-l-2 border-l-purple-400 dark:border-l-purple-500'
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Ícone */}
        <div className={clsx('p-1.5 rounded-md flex-shrink-0', config.bgColor)}>
          <Icon size={14} className={config.color} />
        </div>

        {/* Conteúdo central */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            <span className={clsx('font-semibold text-sm flex-shrink-0', config.color)}>
              {transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? (transaction.is_transfer_out ? '-' : '+') : '-'}
              {formatCurrency(transaction.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {transaction.type === 'transfer'
                ? `${transaction.linked_account_name ? `${transaction.is_transfer_out ? '→' : '←'} ${transaction.linked_account_name}` : 'Transferência'}`
                : (transaction.category_name || 'Sem categoria')
              } • {transaction.account_name || 'N/A'}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatDateBR(transaction.date)}
              </span>
              {!transaction.is_paid && (
                <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                  Proj.
                </span>
              )}
              {transaction.installment_number && transaction.installment_total && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {transaction.installment_number}/{transaction.installment_total}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper to get current month/year
const getCurrentPeriod = () => {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

// Format date string (YYYY-MM-DD) to DD/MM/YYYY without timezone issues
const formatDateBR = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default function Transactions() {
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedTab, setSelectedTab] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    amount: '',
    date: '',
    account_id: '',
    category_id: '',
    description: '',
    notes: '',
  })

  const queryClient = useQueryClient()

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.length >= 2 || searchInput.length === 0) {
        setSearchQuery(searchInput)
        setPage(0)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['transactions', categoryFilter, searchQuery, selectedYear, selectedMonth],
    queryFn: () => {
      const params: Record<string, unknown> = {
        category_id: categoryFilter || undefined,
        search: searchQuery || undefined,
        limit: 100, // Backend limit
        offset: 0,
      }

      // Add date range filter if month/year are selected
      if (selectedMonth && selectedYear) {
        const paddedMonth = String(selectedMonth).padStart(2, '0')
        const startDate = `${selectedYear}-${paddedMonth}-01`

        // Calculate last day of month
        const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
        const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
        const paddedNextMonth = String(nextMonth).padStart(2, '0')
        const endDate = `${nextYear}-${paddedNextMonth}-01`

        params.start_date = startDate
        params.end_date = endDate
      }

      return transactionsApi.list(params)
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  // Pre-fetch accounts for query invalidation when transactions change
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const accounts = accountsData?.data || []

  // Função para invalidar todos os caches relacionados a transações
  const invalidateTransactionCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
    queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
    queryClient.invalidateQueries({ queryKey: ['budget'] })
    queryClient.invalidateQueries({ queryKey: ['recurring'] })
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      transactionsApi.update(id, data),
    onSuccess: () => {
      invalidateTransactionCaches()
      closeEditModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transactionsApi.delete(id),
    onSuccess: () => {
      invalidateTransactionCaches()
      closeEditModal()
    },
  })

  const paginatedData: PaginatedResponse = transactionsData?.data || {
    items: [],
    total: 0,
    limit: ITEMS_PER_PAGE,
    offset: 0,
    has_more: false,
  }
  const allTransactions: Transaction[] = paginatedData.items || []
  const categories: Category[] = categoriesData?.data || []

  // Debug: log transaction count (uncomment for debugging)
  // console.log('[Transactions] Total loaded:', allTransactions.length, 'Total in DB:', paginatedData.total)

  // Generate available years from transactions or default range
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    allTransactions.forEach(t => {
      // Parse date as YYYY-MM-DD string to avoid timezone issues
      const yearStr = t.date.split('-')[0]
      years.add(parseInt(yearStr))
    })

    const currentYear = new Date().getFullYear()
    // Add current year and next year if not present
    years.add(currentYear)
    years.add(currentYear + 1)
    years.add(currentYear - 1)

    return Array.from(years).sort((a, b) => b - a)
  }, [allTransactions])

  // Generate month tabs for selected year (all 12 months)
  const monthTabs = useMemo(() => {
    const { month: currentMonth, year: currentYear } = getCurrentPeriod()
    const tabs: { key: string; label: string; month: number; year: number; isCurrent: boolean }[] = []

    for (let month = 1; month <= 12; month++) {
      const key = `${selectedYear}-${month}`
      const isCurrent = month === currentMonth && selectedYear === currentYear

      tabs.push({
        key,
        label: MONTH_NAMES[month - 1],
        month,
        year: selectedYear,
        isCurrent,
      })
    }

    return tabs
  }, [selectedYear])

  // Set initial selected tab to current month
  useEffect(() => {
    if (monthTabs.length > 0 && !selectedTab) {
      const currentTab = monthTabs.find(t => t.isCurrent)
      const newTab = currentTab?.key || monthTabs[0].key

      setSelectedTab(newTab)
      const [, monthStr] = newTab.split('-')
      setSelectedMonth(Number(monthStr))
    }
  }, [monthTabs, selectedTab])

  // Update selectedMonth when tab changes
  useEffect(() => {
    if (selectedTab) {
      const [yearStr, monthStr] = selectedTab.split('-')
      const tabYear = Number(yearStr)
      const tabMonth = Number(monthStr)

      // Only update if the tab's year matches selected year
      if (tabYear === selectedYear) {
        setSelectedMonth(tabMonth)
      }
    }
  }, [selectedTab, selectedYear])

  // Generate day tabs based on transactions in the selected month
  const dayTabs = useMemo(() => {
    if (!selectedMonth || !selectedYear) return []

    // Get unique days with transactions
    const daysMap = new Map<number, number>()

    allTransactions.forEach(t => {
      // Parse date: YYYY-MM-DD format from backend
      const [year, month, day] = t.date.split('-')
      const transYear = parseInt(year, 10)
      const transMonth = parseInt(month, 10)
      const dayNum = parseInt(day, 10)

      // Only count transactions from the selected month/year
      if (transYear === selectedYear && transMonth === selectedMonth) {
        daysMap.set(dayNum, (daysMap.get(dayNum) || 0) + 1)
      }
    })

    return Array.from(daysMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, count]) => ({
        day,
        label: String(day),
        count,
      }))
  }, [allTransactions, selectedMonth, selectedYear])

  // Reset selected day when month changes
  useEffect(() => {
    setSelectedDay(null)
  }, [selectedMonth, selectedYear])

  // Filter transactions by selected day
  const filteredTransactions = useMemo(() => {
    if (!selectedDay || !selectedMonth || !selectedYear) return allTransactions

    return allTransactions.filter(t => {
      const [year, month, day] = t.date.split('-')
      const transYear = parseInt(year, 10)
      const transMonth = parseInt(month, 10)
      const transDay = parseInt(day, 10)

      return transDay === selectedDay && transMonth === selectedMonth && transYear === selectedYear
    })
  }, [allTransactions, selectedDay, selectedMonth, selectedYear])

  // Calculate summary for selected period (exclude transfers from income/expense totals)
  const periodSummary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    const transfers = filteredTransactions
      .filter(t => t.type === 'transfer')
      .length
    const balance = income - expenses
    const projected = filteredTransactions.filter(t => !t.is_paid).length

    return { income, expenses, balance, projected, count: filteredTransactions.length, transfers }
  }, [filteredTransactions])

  // Pagination for table view
  const paginatedTransactions = useMemo(() => {
    const start = page * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return filteredTransactions.slice(start, end)
  }, [filteredTransactions, page])

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
  const transactions = paginatedTransactions

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await transactionsApi.exportCSV({
        category_id: categoryFilter || undefined,
      })
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFilterChange = (value: string) => {
    setCategoryFilter(value)
    setPage(0)
  }

  const openEditModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setEditForm({
      amount: transaction.amount.toString(),
      date: transaction.date,
      account_id: transaction.account_id.toString(),
      category_id: transaction.category_id?.toString() || '',
      description: transaction.description || '',
      notes: transaction.notes || '',
    })
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setSelectedTransaction(null)
    setEditForm({
      amount: '',
      date: '',
      account_id: '',
      category_id: '',
      description: '',
      notes: '',
    })
  }

  const handleSaveEdit = () => {
    if (!selectedTransaction) return

    const data: Record<string, unknown> = {}
    if (editForm.amount) data.amount = parseFloat(editForm.amount)
    if (editForm.date) data.date = editForm.date
    if (editForm.account_id) data.account_id = parseInt(editForm.account_id)
    if (editForm.category_id) data.category_id = parseInt(editForm.category_id)
    if (editForm.description !== selectedTransaction.description) {
      data.description = editForm.description || null
    }
    if (editForm.notes !== selectedTransaction.notes) {
      data.notes = editForm.notes || null
    }

    updateMutation.mutate({ id: selectedTransaction.id, data })
  }

  const handleDelete = () => {
    if (!selectedTransaction) return
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      deleteMutation.mutate(selectedTransaction.id)
    }
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
  }

  // Filter categories by transaction type when editing
  const filteredCategories = selectedTransaction
    ? categories.filter(
        (cat) =>
          cat.type === selectedTransaction.type || cat.type === 'both'
      )
    : categories

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header with Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transações</h1>
            <HelpButton pageId="transactions" />
          </div>
          {!isLoading && filteredTransactions.length > 0 && selectedMonth && (
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {selectedDay ? `${selectedDay} de ` : ''}{MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                {selectedDay && ` - ${filteredTransactions.length} transação${filteredTransactions.length > 1 ? 'ões' : ''}`}
              </span>
              {selectedDay && (
                <>
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                    <TrendingUp size={14} />
                    {formatCurrency(periodSummary.income)}
                  </span>
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                    <TrendingDown size={14} />
                    {formatCurrency(periodSummary.expenses)}
                  </span>
                  <span className={clsx(
                    'font-medium whitespace-nowrap',
                    periodSummary.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    Balanço: {formatCurrency(periodSummary.balance)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => {
              const newYear = Number(e.target.value)
              setSelectedYear(newYear)
              setSelectedTab(null)
              setSelectedMonth(null)
              setPage(0)
            }}
            className="input w-auto"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            disabled={isExporting || transactions.length === 0}
            className="btn-secondary flex items-center gap-2"
            title="Exportar CSV"
          >
            <Download size={18} className={isExporting ? 'animate-pulse' : ''} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'btn-secondary flex items-center gap-2',
                categoryFilter && 'ring-2 ring-primary-500 ring-offset-1'
              )}
            >
              <Filter size={18} />
              {categoryFilter && (
                <span className="w-2 h-2 bg-primary-500 rounded-full" />
              )}
            </button>
            {showFilters && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowFilters(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium dark:text-white">Filtros</h3>
                    {categoryFilter && (
                      <button
                        onClick={() => {
                          setCategoryFilter('')
                          setShowFilters(false)
                        }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Categoria
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        handleFilterChange(e.target.value)
                        setShowFilters(false)
                      }}
                      className="input"
                    >
                      <option value="">Todas as categorias</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <Link to="/upload?mode=manual" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            <span className="hidden sm:inline">Nova Transação</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* Month Tabs */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden relative">
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-800 to-transparent pointer-events-none z-10 sm:hidden" />
            <div className="flex overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {monthTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setSelectedTab(tab.key)
                    setPage(0)
                  }}
                  className={clsx(
                    'flex-1 min-w-[48px] px-2 sm:px-3 py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                    selectedTab === tab.key
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  )}
                >
                  <span className="flex items-center justify-center gap-1">
                    {tab.label}
                    {tab.isCurrent && selectedTab === tab.key && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Day Tabs */}
          {dayTabs.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-2 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                <button
                  onClick={() => {
                    setSelectedDay(null)
                    setPage(0)
                  }}
                  className={clsx(
                    'flex-shrink-0 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors',
                    selectedDay === null
                      ? 'bg-primary-600 text-white dark:bg-primary-500'
                      : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  )}
                >
                  Todos
                </button>
                {dayTabs.map((tab) => (
                  <button
                    key={tab.day}
                    onClick={() => {
                      setSelectedDay(tab.day)
                      setPage(0)
                    }}
                    className={clsx(
                      'flex-shrink-0 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors',
                      selectedDay === tab.day
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    )}
                  >
                    <span className="whitespace-nowrap">Dia {tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Period Summary */}
          {selectedTab && filteredTransactions.length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5">
              {/* Linha 1: Data e info de projetadas */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedDay ? `${selectedDay} de ` : ''}{MONTH_NAMES[selectedMonth! - 1]} de {selectedYear}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{periodSummary.count} transações</span>
                  {periodSummary.projected > 0 && (
                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <Clock size={12} />
                      {periodSummary.projected} projetada{periodSummary.projected > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Linha 2: KPIs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Receitas</span>
                    <p className="font-semibold text-green-600 dark:text-green-400 text-sm">{formatCurrency(periodSummary.income)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Despesas</span>
                    <p className="font-semibold text-red-600 dark:text-red-400 text-sm">{formatCurrency(periodSummary.expenses)}</p>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Balanço</span>
                  <p className={clsx(
                    'font-semibold text-sm',
                    periodSummary.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {formatCurrency(periodSummary.balance)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
              size={20}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar transação..."
              className="input pl-10 pr-10"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {filteredTransactions.length === 0 ? (
            searchQuery || categoryFilter ? (
              <EmptyState
                icon={Search}
                title="Nenhum resultado encontrado"
                description={`Não encontramos transações${searchQuery ? ` para "${searchQuery}"` : ''}${categoryFilter ? ' na categoria selecionada' : ''}. Tente ajustar os filtros.`}
                actionLabel="Limpar filtros"
                actionOnClick={() => {
                  clearSearch()
                  setCategoryFilter('')
                }}
              />
            ) : (
              <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                Nenhuma transação neste período
              </div>
            )
          ) : (
            <>
              {/* Mobile: Cards View */}
              <div className="lg:hidden space-y-2">
                {transactions.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    onClick={() => openEditModal(transaction)}
                    formatCurrency={formatCurrency}
                    formatDateBR={formatDateBR}
                  />
                ))}
              </div>

              {/* Desktop: Table View */}
              <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-x-auto max-w-full">
                <table className="w-full min-w-[700px] table-auto">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Categoria
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Conta
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        onClick={() => openEditModal(transaction)}
                        className={clsx(
                          'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer',
                          !transaction.is_paid && 'bg-purple-50/50 dark:bg-purple-900/10'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {formatDateBR(transaction.date)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={clsx(
                                'p-1.5 rounded-full',
                                transaction.type === 'income'
                                  ? 'bg-green-100 dark:bg-green-900/30'
                                  : transaction.type === 'transfer'
                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                    : 'bg-red-100 dark:bg-red-900/30'
                              )}
                            >
                              {transaction.type === 'income' ? (
                                <ArrowUpRight className="text-income" size={14} />
                              ) : transaction.type === 'transfer' ? (
                                <ArrowRightLeft className="text-blue-600 dark:text-blue-400" size={14} />
                              ) : (
                                <ArrowDownRight className="text-expense" size={14} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[200px] md:max-w-[300px]">
                                {transaction.type === 'transfer'
                                  ? (transaction.description || 'Transferência')
                                  : (transaction.merchant_name || transaction.description || 'Transação')}
                              </p>
                              {transaction.type === 'transfer' && transaction.linked_account_name && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  {transaction.is_transfer_out ? '→' : '←'} {transaction.linked_account_name}
                                </p>
                              )}
                              {(transaction.installment_number || transaction.is_recurring) && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  {transaction.installment_number && transaction.installment_total && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-600 rounded">
                                      {transaction.installment_number}/{transaction.installment_total}
                                    </span>
                                  )}
                                  {transaction.is_recurring && (
                                    <span>• Recorrente</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'text-sm',
                            transaction.type === 'transfer'
                              ? 'text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-gray-600 dark:text-gray-300'
                          )}>
                            {transaction.type === 'transfer' ? 'Transferência' : (transaction.category_name || 'Sem categoria')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <CreditCard size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {transaction.account_name || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={clsx(
                              'font-semibold text-sm',
                              transaction.type === 'income'
                                ? 'text-green-600 dark:text-green-400'
                                : transaction.type === 'transfer'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-red-600 dark:text-red-400'
                            )}
                          >
                            {transaction.type === 'income' ? '+' : transaction.type === 'transfer' ? (transaction.is_transfer_out ? '-' : '+') : '-'}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!transaction.is_paid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
                              <Clock size={10} />
                              Projetado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Página {page + 1} de {totalPages} ({filteredTransactions.length} transações)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="btn-secondary p-2 disabled:opacity-50"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="btn-secondary p-2 disabled:opacity-50"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Edit/Detail Modal */}
      {showEditModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'p-2 rounded-full',
                    selectedTransaction.type === 'income'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : selectedTransaction.type === 'transfer'
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                  )}
                >
                  {selectedTransaction.type === 'income' ? (
                    <ArrowUpRight className="text-income" size={20} />
                  ) : selectedTransaction.type === 'transfer' ? (
                    <ArrowRightLeft className="text-blue-600 dark:text-blue-400" size={20} />
                  ) : (
                    <ArrowDownRight className="text-expense" size={20} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedTransaction.type === 'income' ? 'Receita' : selectedTransaction.type === 'transfer' ? 'Transferência' : 'Despesa'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedTransaction.type === 'transfer'
                      ? (selectedTransaction.description || 'Transferência entre contas')
                      : (selectedTransaction.merchant_name || selectedTransaction.description || 'Editar transação')}
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-slate-700/30">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Valor</p>
                <p className={clsx(
                  'text-lg font-bold',
                  selectedTransaction.type === 'income'
                    ? 'text-green-600 dark:text-green-400'
                    : selectedTransaction.type === 'transfer'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400'
                )}>
                  {formatCurrency(selectedTransaction.amount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Data</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatDateBR(selectedTransaction.date)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <p className={clsx(
                  'text-lg font-bold',
                  selectedTransaction.is_paid
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-purple-600 dark:text-purple-400'
                )}>
                  {selectedTransaction.is_paid ? 'Pago' : 'Projetado'}
                </p>
              </div>
            </div>

            {/* Info Row */}
            <div className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-4">
                <span className="text-gray-500 dark:text-gray-400">
                  Categoria: <span className="text-gray-900 dark:text-white font-medium">{selectedTransaction.category_name || 'Sem categoria'}</span>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Conta: <span className="text-gray-900 dark:text-white font-medium">{selectedTransaction.account_name || 'N/A'}</span>
                </span>
              </div>
              {(selectedTransaction.installment_number || selectedTransaction.is_recurring) && (
                <div className="flex items-center gap-2">
                  {selectedTransaction.installment_number && (
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded">
                      Parcela {selectedTransaction.installment_number}/{selectedTransaction.installment_total}
                    </span>
                  )}
                  {selectedTransaction.is_recurring && (
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                      Recorrente
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) =>
                      setEditForm({ ...editForm, amount: e.target.value })
                    }
                    className="input pl-10"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar size={16} className="inline mr-1" />
                  Data
                </label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, date: e.target.value })
                  }
                  className="input"
                />
              </div>

              {/* Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Conta
                </label>
                <select
                  value={editForm.account_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, account_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">Selecione</option>
                  {accounts.map((acc: { id: number; name: string; type: string }) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({accountTypeLabels[acc.type]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Tag size={16} className="inline mr-1" />
                  Categoria
                </label>
                <select
                  value={editForm.category_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">Sem categoria</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FileText size={16} className="inline mr-1" />
                  Descrição
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="input"
                  placeholder="Descrição da transação"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Observações
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  className="input"
                  rows={3}
                  placeholder="Notas adicionais..."
                />
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-2 font-medium"
              >
                <Trash2 size={18} />
                Excluir
              </button>
              <div className="flex gap-2">
                <button onClick={closeEditModal} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending}
                  className="btn-primary"
                >
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
