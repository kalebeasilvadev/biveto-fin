import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { transactionsApi, categoriesApi } from '../services/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Filter, ArrowUpRight, ArrowDownRight, Receipt, Download, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

interface Transaction {
  id: number
  type: 'expense' | 'income'
  amount: number
  date: string
  description: string | null
  category_name: string | null
  merchant_name: string | null
}

interface PaginatedResponse {
  items: Transaction[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

const ITEMS_PER_PAGE = 20

export default function Transactions() {
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.length >= 2 || searchInput.length === 0) {
        setSearchQuery(searchInput)
        setPage(0) // Reset to first page when search changes
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['transactions', categoryFilter, searchQuery, page],
    queryFn: () =>
      transactionsApi.list({
        category_id: categoryFilter || undefined,
        search: searchQuery || undefined,
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
      }),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const paginatedData: PaginatedResponse = transactionsData?.data || { items: [], total: 0, limit: ITEMS_PER_PAGE, offset: 0, has_more: false }
  const transactions: Transaction[] = paginatedData.items || []
  const totalPages = Math.ceil(paginatedData.total / ITEMS_PER_PAGE)
  const categories = categoriesData?.data || []

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
    setPage(0) // Reset to first page when filter changes
  }

  // Group by date
  const groupedTransactions = transactions.reduce(
    (groups: Record<string, Transaction[]>, transaction) => {
      const date = transaction.date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(transaction)
      return groups
    },
    {}
  )

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transações</h1>
          {paginatedData.total > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {paginatedData.total} transação(ões)
              {searchQuery && ` para "${searchQuery}"`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting || transactions.length === 0}
            className="btn-secondary flex items-center gap-2"
            title="Exportar CSV"
          >
            <Download size={18} className={isExporting ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">{isExporting ? 'Exportando...' : 'Exportar'}</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filtros</span>
          </button>
          <Link to="/upload" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            <span className="hidden sm:inline">Adicionar</span>
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por descrição, estabelecimento ou categoria..."
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

      {showFilters && (
        <div className="card">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoria
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="input"
              >
                <option value="">Todas</option>
                {categories.map((cat: { id: number; name: string }) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : transactions.length === 0 ? (
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
          <EmptyState
            icon={Receipt}
            title="Nenhuma transação encontrada"
            description="Comece a registrar suas receitas e despesas para ter controle total das suas finanças."
            actionLabel="Adicionar transação"
            actionTo="/upload"
          />
        )
      ) : (
        <>
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                <div className="card divide-y dark:divide-slate-700">
                  {dayTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            transaction.type === 'income'
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-red-100 dark:bg-red-900/30'
                          }`}
                        >
                          {transaction.type === 'income' ? (
                            <ArrowUpRight className="text-income" size={18} />
                          ) : (
                            <ArrowDownRight className="text-expense" size={18} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium dark:text-white">
                            {transaction.merchant_name ||
                              transaction.description ||
                              'Transação'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {transaction.category_name || 'Sem categoria'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${
                          transaction.type === 'income'
                            ? 'text-income'
                            : 'text-expense'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={!paginatedData.has_more}
                  className="btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
