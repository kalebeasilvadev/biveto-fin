import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recurringApi, accountsApi, categoriesApi, familyApi } from '../services/api'
import { Plus, Repeat, Pause, Play, Trash2, Edit2, Calendar, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { HelpButton } from '../components/help'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import OwnershipSelector from '../components/shared/OwnershipSelector'

interface RecurringTransaction {
  id: number
  name: string
  description: string | null
  amount: number
  type: string
  account_id: number
  account_name: string | null
  category_id: number | null
  category_name: string | null
  frequency: string
  day_of_month: number | null
  day_of_week: number | null
  start_date: string
  end_date: string | null
  status: string
  last_generated_date: string | null
  next_due_date: string | null
}

interface RecurringSummary {
  total_monthly_expenses: number
  total_monthly_income: number
  active_count: number
  paused_count: number
}

interface Account {
  id: number
  name: string
  type: 'wallet' | 'bank' | 'credit_card' | 'investment'
}

const accountTypeLabels: Record<string, string> = {
  wallet: 'Carteira',
  bank: 'Banco',
  credit_card: 'Cartão',
  investment: 'Investimento',
}

interface Category {
  id: number
  name: string
}

interface FamilyContext {
  license_id: number
  member_count: number
  max_members: number
}

const frequencyLabels: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
}

const dayOfWeekLabels: Record<number, string> = {
  0: 'Segunda',
  1: 'Terça',
  2: 'Quarta',
  3: 'Quinta',
  4: 'Sexta',
  5: 'Sábado',
  6: 'Domingo',
}

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  cancelled: 'Cancelado',
}

const ITEMS_PER_PAGE = 20

// Helper to get local date in YYYY-MM-DD format (avoid timezone issues)
const getLocalDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Recurring() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [ownershipType, setOwnershipType] = useState<'personal' | 'household'>('personal')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    type: 'expense',
    is_debit: true, // true = débito em conta (banco/carteira), false = cartão de crédito
    account_id: '',
    category_id: '',
    frequency: 'monthly',
    day_of_month: '1',
    day_of_week: '',
    start_date: getLocalDateString(),
    end_date: '',
  })

  const { data: recurring = [], isLoading } = useQuery<RecurringTransaction[]>({
    queryKey: ['recurring'],
    queryFn: async () => {
      const response = await recurringApi.list()
      return response.data
    },
  })

  const { data: summary } = useQuery<RecurringSummary>({
    queryKey: ['recurring-summary'],
    queryFn: async () => {
      const response = await recurringApi.summary()
      return response.data
    },
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })
  const accounts: Account[] = accountsData?.data || []

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })
  const categories: Category[] = categoriesData?.data || []

  const { data: familyData } = useQuery({
    queryKey: ['family-context'],
    queryFn: async () => {
      try {
        const response = await familyApi.getContext()
        return response.data as FamilyContext
      } catch {
        return null
      }
    },
  })

  const showOwnershipSelector = familyData && familyData.member_count >= 2

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

  // Filter and paginate recurring transactions
  const filteredRecurring = useMemo(() => {
    if (!searchQuery) return recurring
    const query = searchQuery.toLowerCase()
    return recurring.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.account_name && item.account_name.toLowerCase().includes(query)) ||
        (item.category_name && item.category_name.toLowerCase().includes(query))
    )
  }, [recurring, searchQuery])

  const paginatedRecurring = useMemo(() => {
    const start = page * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return filteredRecurring.slice(start, end)
  }, [filteredRecurring, page])

  const totalPages = Math.ceil(filteredRecurring.length / ITEMS_PER_PAGE)

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    setPage(0)
  }

  // Função para invalidar caches relacionados a recorrências
  const invalidateRecurringCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring'] })
    queryClient.invalidateQueries({ queryKey: ['recurring-summary'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: unknown) => recurringApi.create(data),
    onSuccess: () => {
      invalidateRecurringCaches()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      recurringApi.update(id, data),
    onSuccess: () => {
      invalidateRecurringCaches()
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => recurringApi.delete(id),
    onSuccess: () => {
      invalidateRecurringCaches()
    },
  })

  const pauseMutation = useMutation({
    mutationFn: (id: number) => recurringApi.pause(id),
    onSuccess: () => {
      invalidateRecurringCaches()
    },
  })

  const resumeMutation = useMutation({
    mutationFn: (id: number) => recurringApi.resume(id),
    onSuccess: () => {
      invalidateRecurringCaches()
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => recurringApi.generate(),
    onSuccess: (response) => {
      invalidateRecurringCaches()
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      alert(`${response.data.generated_count} transações geradas!`)
    },
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      name: '',
      description: '',
      amount: '',
      type: 'expense',
      is_debit: true,
      account_id: '',
      category_id: '',
      frequency: 'monthly',
      day_of_month: '1',
      day_of_week: '',
      start_date: getLocalDateString(),
      end_date: '',
    })
  }

  // Filtrar contas baseado no tipo de transação
  const filteredAccounts = accounts.filter((account) => {
    if (formData.type === 'income') {
      // Receitas: banco e carteira
      return account.type === 'bank' || account.type === 'wallet'
    } else {
      // Despesas
      if (formData.is_debit) {
        // Débito em conta: banco e carteira
        return account.type === 'bank' || account.type === 'wallet'
      } else {
        // Cartão de crédito
        return account.type === 'credit_card'
      }
    }
  })

  const handleEdit = (item: RecurringTransaction) => {
    setEditingId(item.id)
    // Determinar is_debit baseado no tipo de conta
    const account = accounts.find(a => a.id === item.account_id)
    const isDebit = account ? account.type !== 'credit_card' : true
    setFormData({
      name: item.name,
      description: item.description || '',
      amount: item.amount.toString(),
      type: item.type,
      is_debit: isDebit,
      account_id: item.account_id.toString(),
      category_id: item.category_id?.toString() || '',
      frequency: item.frequency,
      day_of_month: item.day_of_month?.toString() || '1',
      day_of_week: item.day_of_week?.toString() || '',
      start_date: item.start_date,
      end_date: item.end_date || '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name: formData.name,
      description: formData.description || null,
      amount: parseFloat(formData.amount),
      type: formData.type,
      account_id: parseInt(formData.account_id),
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      frequency: formData.frequency,
      day_of_month: formData.frequency === 'monthly' ? parseInt(formData.day_of_month) : null,
      day_of_week: formData.frequency === 'weekly' ? parseInt(formData.day_of_week) : null,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      ownership_type: ownershipType,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Despesas Recorrentes</h1>
            <HelpButton pageId="recurring" />
          </div>
          {!isLoading && filteredRecurring.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filteredRecurring.length} recorrência{filteredRecurring.length > 1 ? 's' : ''} cadastrada{filteredRecurring.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-secondary flex items-center gap-2"
            title="Gerar Pendentes"
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Gerar Pendentes</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Recorrência</span>
          </button>
        </div>
      </div>

      {/* Summary Cards - Inline Style */}
      {summary && (
        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-6">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Despesas Mensais</span>
              <p className="font-semibold text-red-600 dark:text-red-400 text-sm sm:text-base">
                {formatCurrency(summary.total_monthly_expenses)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Receitas Mensais</span>
              <p className="font-semibold text-green-600 dark:text-green-400 text-sm sm:text-base">
                {formatCurrency(summary.total_monthly_income)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Balanço</span>
              <p className={clsx(
                'font-semibold text-sm sm:text-base',
                (summary.total_monthly_income - summary.total_monthly_expenses) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              )}>
                {formatCurrency(summary.total_monthly_income - summary.total_monthly_expenses)}
              </p>
            </div>
            <div className="hidden sm:block h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Ativos</span>
              <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{summary.active_count}</p>
            </div>
            {summary.paused_count > 0 && (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <Pause size={16} />
                <span className="text-sm font-medium">
                  {summary.paused_count} pausado{summary.paused_count > 1 ? 's' : ''}
                </span>
              </div>
            )}
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
          placeholder="Buscar recorrência..."
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">
              {editingId ? 'Editar Recorrência' : 'Nova Recorrência'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="Ex: Aluguel, Netflix, Energia"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor *
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="input w-full"
                    placeholder="0,00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value, account_id: '' })}
                    className="input w-full"
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
              </div>

              {/* Forma de pagamento - só para despesas */}
              {formData.type === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_debit: true, account_id: '' })}
                      className={clsx(
                        'p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.is_debit
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      Débito em Conta
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_debit: false, account_id: '' })}
                      className={clsx(
                        'p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        !formData.is_debit
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      Cartão de Crédito
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.type === 'expense' && !formData.is_debit ? 'Cartão *' : 'Conta *'}
                  </label>
                  <select
                    value={formData.account_id}
                    onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    className="input w-full"
                    required
                  >
                    <option value="">Selecione...</option>
                    {filteredAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({accountTypeLabels[account.type]})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Selecione...</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequência *
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="input w-full"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
                {formData.frequency === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Dia do Mês
                    </label>
                    <input
                      type="number"
                      value={formData.day_of_month}
                      onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                      className="input w-full"
                      min="1"
                      max="31"
                    />
                  </div>
                )}
                {formData.frequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Dia da Semana
                    </label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                      className="input w-full"
                    >
                      {Object.entries(dayOfWeekLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Início *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data Fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="Observações..."
                />
              </div>

              {showOwnershipSelector && (
                <OwnershipSelector
                  value={ownershipType}
                  onChange={setOwnershipType}
                  description="Recorrências familiares são compartilhadas com todos os membros"
                />
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {filteredRecurring.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon={Search}
            title="Nenhum resultado encontrado"
            description={`Não encontramos recorrências para "${searchQuery}". Tente ajustar a busca.`}
            actionLabel="Limpar busca"
            actionOnClick={clearSearch}
          />
        ) : (
          <EmptyState
            icon={Repeat}
            title="Nenhuma recorrência cadastrada"
            description="Adicione suas despesas fixas como aluguel, assinaturas e contas para ter controle automático."
            actionLabel="Nova Recorrência"
            actionOnClick={() => setShowForm(true)}
          />
        )
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-x-auto max-w-full">
            <table className="w-full min-w-[700px] table-auto">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Frequência
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {paginatedRecurring.map((item) => (
                  <tr
                    key={item.id}
                    className={clsx(
                      'hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors',
                      item.status === 'paused' && 'bg-yellow-50/50 dark:bg-yellow-900/10'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={clsx(
                            'p-1.5 rounded-full',
                            item.type === 'income'
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-red-100 dark:bg-red-900/30'
                          )}
                        >
                          <Repeat
                            className={clsx(
                              'w-4 h-4',
                              item.type === 'income' ? 'text-green-600' : 'text-red-600'
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[200px]">
                            {item.name}
                          </p>
                          {item.next_due_date && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Próximo: {formatDate(item.next_due_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {frequencyLabels[item.frequency]}
                        {item.frequency === 'monthly' && item.day_of_month && (
                          <span className="text-gray-400 dark:text-gray-500"> · Dia {item.day_of_month}</span>
                        )}
                        {item.frequency === 'weekly' && item.day_of_week !== null && (
                          <span className="text-gray-400 dark:text-gray-500"> · {dayOfWeekLabels[item.day_of_week]}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {item.category_name || 'Sem categoria'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {item.account_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={clsx(
                          'font-semibold text-sm',
                          item.type === 'income'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {item.type === 'income' ? '+' : '-'}
                        {formatCurrency(item.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                          item.status === 'active' && 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400',
                          item.status === 'paused' && 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400',
                          item.status === 'cancelled' && 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
                        )}
                      >
                        {item.status === 'paused' && <Pause size={10} />}
                        {statusLabels[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {item.status === 'active' ? (
                          <button
                            onClick={() => pauseMutation.mutate(item.id)}
                            className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                            title="Pausar"
                          >
                            <Pause size={16} />
                          </button>
                        ) : item.status === 'paused' ? (
                          <button
                            onClick={() => resumeMutation.mutate(item.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                            title="Retomar"
                          >
                            <Play size={16} />
                          </button>
                        ) : null}
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir esta recorrência?')) {
                              deleteMutation.mutate(item.id)
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
                Página {page + 1} de {totalPages} ({filteredRecurring.length} recorrências)
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
    </div>
  )
}
