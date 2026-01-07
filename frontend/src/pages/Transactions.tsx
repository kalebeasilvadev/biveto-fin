import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, categoriesApi, accountsApi } from '../services/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Edit2,
  Trash2,
  Calendar,
  Tag,
  CreditCard,
  FileText,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import { clsx } from 'clsx'

interface Transaction {
  id: number
  type: 'expense' | 'income'
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
  installment_number: number | null
  installment_total: number | null
  tags: string[] | null
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

export default function Transactions() {
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    amount: '',
    date: '',
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

  // Pre-fetch accounts for query invalidation when transactions change
  useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      transactionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      closeEditModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
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
  const transactions: Transaction[] = paginatedData.items || []
  const totalPages = Math.ceil(paginatedData.total / ITEMS_PER_PAGE)
  const categories: Category[] = categoriesData?.data || []
  // accountsData is used for query invalidation but not displayed directly

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

  // Filter categories by transaction type when editing
  const filteredCategories = selectedTransaction
    ? categories.filter(
        (cat) =>
          cat.type === selectedTransaction.type || cat.type === 'both'
      )
    : categories

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Transações
          </h1>
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
            <span className="hidden sm:inline">
              {isExporting ? 'Exportando...' : 'Exportar'}
            </span>
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
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
          size={20}
        />
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
                {categories.map((cat) => (
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
                      onClick={() => openEditModal(transaction)}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-4 px-4 transition-colors"
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
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{transaction.category_name || 'Sem categoria'}</span>
                            {transaction.installment_number && transaction.installment_total && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-600 rounded">
                                {transaction.installment_number}/{transaction.installment_total}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
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
                        <Edit2
                          size={16}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        />
                      </div>
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
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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

      {/* Edit/Detail Modal */}
      {showEditModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'p-2 rounded-full',
                    selectedTransaction.type === 'income'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  )}
                >
                  {selectedTransaction.type === 'income' ? (
                    <ArrowUpRight className="text-income" size={20} />
                  ) : (
                    <ArrowDownRight className="text-expense" size={20} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold dark:text-white">
                    {selectedTransaction.type === 'income' ? 'Receita' : 'Despesa'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedTransaction.merchant_name || 'Editar transação'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
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

              {/* Info section */}
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    <CreditCard size={14} className="inline mr-1" />
                    Conta
                  </span>
                  <span className="dark:text-white">
                    {selectedTransaction.account_name || 'N/A'}
                  </span>
                </div>
                {selectedTransaction.installment_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Parcela
                    </span>
                    <span className="dark:text-white">
                      {selectedTransaction.installment_number} de{' '}
                      {selectedTransaction.installment_total}
                    </span>
                  </div>
                )}
                {selectedTransaction.is_recurring && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Recorrente
                    </span>
                    <span className="text-green-600 dark:text-green-400">Sim</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t dark:border-slate-700">
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-red-600 hover:text-red-700 flex items-center gap-1"
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
