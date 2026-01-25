import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsApi, categoriesApi, familyApi } from '../services/api'
import { ChevronLeft, ChevronRight, Plus, Trash2, Copy, Wallet, ArrowRightLeft, Clock, AlertTriangle, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { HelpButton } from '../components/help'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import OwnershipSelector from '../components/shared/OwnershipSelector'

type BudgetItemStatus = 'on_track' | 'warning' | 'depleted' | 'overspent'

interface BudgetItem {
  id: number
  category_id: number
  category_name: string
  category_icon: string | null
  planned_amount: number
  spent_amount: number
  available_amount: number
  percentage_used: number
  is_fixed: boolean
  priority: number
  status: BudgetItemStatus
  daily_allowance: number
  days_remaining: number
}

interface Budget {
  id: number
  year: number
  month: number
  total_income_planned: number
  total_expense_planned: number
  allow_rollover: boolean
  items: BudgetItem[]
}

interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string | null
}

interface FamilyContext {
  license_id: number
  member_count: number
  max_members: number
}

// Helper function to get status badge
const getStatusBadge = (status: BudgetItemStatus) => {
  switch (status) {
    case 'on_track':
      return { icon: CheckCircle, label: 'No limite', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' }
    case 'warning':
      return { icon: AlertTriangle, label: 'Atenção', color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' }
    case 'depleted':
      return { icon: MinusCircle, label: 'Esgotado', color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' }
    case 'overspent':
      return { icon: XCircle, label: 'Excedido', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' }
    default:
      return { icon: CheckCircle, label: 'Ok', color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20' }
  }
}

export default function Budget() {
  const queryClient = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [ownershipType, setOwnershipType] = useState<'personal' | 'household'>('personal')

  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['budget', year, month],
    queryFn: () => budgetsApi.get(year, month),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

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

  const budget: Budget | null = budgetData?.data || null
  const categories: Category[] = categoriesData?.data || []
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  // Função para invalidar caches relacionados a orçamento
  const invalidateBudgetCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['budget'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }

  const addItemMutation = useMutation({
    mutationFn: (data: unknown) => budgetsApi.addItem(year, month, data),
    onSuccess: () => {
      invalidateBudgetCaches()
      setShowAddModal(false)
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => budgetsApi.deleteItem(year, month, itemId),
    onSuccess: () => {
      invalidateBudgetCaches()
    },
  })

  const copyBudgetMutation = useMutation({
    mutationFn: (data: unknown) => budgetsApi.copy(data),
    onSuccess: () => {
      invalidateBudgetCaches()
      setShowCopyModal(false)
    },
  })

  const transferMutation = useMutation({
    mutationFn: (data: { from_category_id: number; to_category_id: number; amount: number; notes?: string }) =>
      budgetsApi.transfer(year, month, data),
    onSuccess: () => {
      invalidateBudgetCaches()
      setShowTransferModal(false)
    },
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const totalPlanned = budget?.items.reduce((sum, item) => sum + item.planned_amount, 0) || 0
  const totalSpent = budget?.items.reduce((sum, item) => sum + item.spent_amount, 0) || 0
  const totalRemaining = totalPlanned - totalSpent

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orçamento</h1>
          <HelpButton pageId="budget" />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {budget?.items && budget.items.length >= 2 && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="btn-secondary flex items-center gap-2 whitespace-nowrap"
              title="Transferir entre categorias"
            >
              <ArrowRightLeft size={18} />
              <span className="hidden sm:inline">Transferir</span>
            </button>
          )}
          <button
            onClick={() => setShowCopyModal(true)}
            className="btn-secondary flex items-center gap-2 whitespace-nowrap"
          >
            <Copy size={18} />
            <span className="hidden sm:inline">Copiar</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="card">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <ChevronLeft size={24} className="dark:text-white" />
          </button>
          <h2 className="text-xl font-semibold dark:text-white">
            {monthNames[month - 1]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <ChevronRight size={24} className="dark:text-white" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Planejado</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalPlanned)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Gasto</p>
          <p className="text-2xl font-bold text-expense">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Restante</p>
          <p className={clsx('text-2xl font-bold', totalRemaining >= 0 ? 'text-income' : 'text-expense')}>
            {formatCurrency(totalRemaining)}
          </p>
        </div>
      </div>

      {/* Budget Items */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : !budget?.items.length ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum limite definido"
          description="Defina limites de gastos por categoria para controlar melhor seu orçamento mensal."
          actionLabel="Definir primeiro limite"
          actionOnClick={() => setShowAddModal(true)}
        />
      ) : (
        <div className="space-y-4">
          {budget.items.map((item) => {
            const statusBadge = getStatusBadge(item.status)
            const StatusIcon = statusBadge.icon
            return (
              <div key={item.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">{item.category_icon || '📁'}</span>
                    <span className="font-medium dark:text-white">{item.category_name}</span>
                    {item.is_fixed && (
                      <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                        Fixo
                      </span>
                    )}
                    <span className={clsx('text-xs px-2 py-1 rounded flex items-center gap-1', statusBadge.color)}>
                      <StatusIcon size={12} />
                      {statusBadge.label}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteItemMutation.mutate(item.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span>
                    {formatCurrency(item.spent_amount)} de {formatCurrency(item.planned_amount)}
                  </span>
                  <span className={clsx(item.percentage_used > 100 ? 'text-expense' : 'text-gray-600 dark:text-gray-400')}>
                    {item.percentage_used.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      item.status === 'overspent'
                        ? 'bg-red-500'
                        : item.status === 'depleted'
                        ? 'bg-orange-500'
                        : item.status === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-primary-500'
                    )}
                    style={{ width: `${Math.min(item.percentage_used, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  {item.available_amount < 0 ? (
                    <p className="text-sm text-expense">
                      Excedido em {formatCurrency(Math.abs(item.available_amount))}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Disponível: {formatCurrency(item.available_amount)}
                    </p>
                  )}
                  {item.days_remaining > 0 && item.available_amount > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {formatCurrency(item.daily_allowance)}/dia ({item.days_remaining} dias)
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Adicionar Limite</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                addItemMutation.mutate({
                  category_id: Number(formData.get('category_id')),
                  planned_amount: Number(formData.get('planned_amount')),
                  is_fixed: formData.get('is_fixed') === 'on',
                  ownership_type: ownershipType,
                })
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria
                  </label>
                  <select name="category_id" className="input" required>
                    <option value="">Selecione</option>
                    {expenseCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Planejado
                  </label>
                  <input
                    type="number"
                    name="planned_amount"
                    step="0.01"
                    min="0"
                    className="input"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="is_fixed" id="is_fixed" className="rounded border-gray-300 dark:border-gray-600" />
                  <label htmlFor="is_fixed" className="text-sm text-gray-700 dark:text-gray-300">
                    Gasto fixo (não varia mensalmente)
                  </label>
                </div>
                {showOwnershipSelector && (
                  <OwnershipSelector
                    value={ownershipType}
                    onChange={setOwnershipType}
                    description="Limites familiares são compartilhados com todos os membros"
                  />
                )}
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={addItemMutation.isPending}
                >
                  {addItemMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Budget Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Copiar Orçamento</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                copyBudgetMutation.mutate({
                  from_year: Number(formData.get('from_year')),
                  from_month: Number(formData.get('from_month')),
                  to_year: year,
                  to_month: month,
                })
              }}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Copiar limites de outro mês para {monthNames[month - 1]} {year}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mês origem
                  </label>
                  <select name="from_month" className="input" defaultValue={month === 1 ? 12 : month - 1}>
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ano origem
                  </label>
                  <input
                    type="number"
                    name="from_year"
                    className="input"
                    defaultValue={month === 1 ? year - 1 : year}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={copyBudgetMutation.isPending}
                >
                  {copyBudgetMutation.isPending ? 'Copiando...' : 'Copiar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Budget Modal */}
      {showTransferModal && budget?.items && budget.items.length >= 2 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft size={20} />
              Transferir entre Categorias
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                transferMutation.mutate({
                  from_category_id: Number(formData.get('from_category_id')),
                  to_category_id: Number(formData.get('to_category_id')),
                  amount: Number(formData.get('amount')),
                  notes: formData.get('notes')?.toString() || undefined,
                })
              }}
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Mova orçamento de uma categoria para outra quando precisar de mais verba.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    De (origem)
                  </label>
                  <select name="from_category_id" className="input" required>
                    <option value="">Selecione a categoria de origem</option>
                    {budget.items
                      .filter((item) => item.available_amount > 0)
                      .map((item) => (
                        <option key={item.category_id} value={item.category_id}>
                          {item.category_name} (Disponível: {formatCurrency(item.available_amount)})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Para (destino)
                  </label>
                  <select name="to_category_id" className="input" required>
                    <option value="">Selecione a categoria de destino</option>
                    {budget.items.map((item) => (
                      <option key={item.category_id} value={item.category_id}>
                        {item.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor a transferir
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    className="input"
                    required
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observação (opcional)
                  </label>
                  <input
                    type="text"
                    name="notes"
                    className="input"
                    placeholder="Ex: Sobrando em alimentação, precisando em lazer"
                    maxLength={200}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={transferMutation.isPending}
                >
                  {transferMutation.isPending ? 'Transferindo...' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
