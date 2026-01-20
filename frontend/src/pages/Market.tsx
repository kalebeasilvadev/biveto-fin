import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groceryApi, familyApi } from '../services/api'
import {
  ShoppingCart,
  Plus,
  TrendingUp,
  TrendingDown,
  Package,
  List,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Edit2,
  Sparkles,
  AlertCircle,
  PieChart,
  Clock,
  DollarSign,
  Filter,
  Search,
  X,
} from 'lucide-react'
import { HelpButton } from '../components/help'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'

// Types
interface CategorySummary {
  category: string
  category_display: string
  total: number
  count: number
  percentage: number
}

interface NecessitySummary {
  necessity_type: string
  necessity_type_display: string
  total: number
  count: number
  percentage: number
}

interface PurchaseSummary {
  month: number
  year: number
  total: number
  essential_total: number
  non_essential_total: number
  item_count: number
  by_category: CategorySummary[]
  by_necessity: NecessitySummary[]
}

interface MonthData {
  total: number
  essential: number
  non_essential: number
  item_count: number
  by_category: Record<string, number>
}

interface Comparison {
  current_month: MonthData
  previous_month: MonthData
  comparison: {
    total_diff: number
    total_diff_percent: number
    essential_diff: number
    non_essential_diff: number
  }
}

interface ShoppingListItem {
  id: number
  product_name: string
  quantity: number
  unit: string
  estimated_price: number | null
  category: string
  category_display: string | null
  necessity_type: string
  necessity_type_display: string | null
  is_checked: boolean
  priority: number
  estimated_total: number | null
}

interface ShoppingList {
  id: number
  name: string
  status: string
  source: string
  items: ShoppingListItem[]
  total_items: number
  checked_items: number
  progress_percent: number
  estimated_total: number
  creator_name: string | null
  created_at: string
  updated_at: string
}

interface Purchase {
  id: number
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  total_price: number
  category: string
  category_display: string | null
  necessity_type: string
  necessity_type_display: string | null
  merchant_name: string | null
  purchase_date: string
}

interface Insight {
  type: string
  title: string
  description: string
  value?: number
  percentage?: number
}

interface Insights {
  insights: Insight[]
  potential_savings: number
  top_expensive_items: Array<{ name: string; total: number; category: string }>
  most_frequent_items: Array<{ name: string; count: number }>
}

interface FamilyContext {
  license_id: number
  member_count: number
  max_members: number
}

// Tab types
type TabType = 'dashboard' | 'lists' | 'history' | 'analytics'

export default function Market() {
  const queryClient = useQueryClient()
  const now = new Date()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showNewListModal, setShowNewListModal] = useState(false)
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // Queries
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['grocery-summary', year, month],
    queryFn: () => groceryApi.getPurchaseSummary(month, year),
    enabled: activeTab === 'dashboard',
  })

  const { data: comparisonData } = useQuery({
    queryKey: ['grocery-comparison', year, month],
    queryFn: () => groceryApi.getPurchaseComparison(month, year),
    enabled: activeTab === 'dashboard',
  })

  const { data: listsData, isLoading: listsLoading } = useQuery({
    queryKey: ['shopping-lists'],
    queryFn: () => groceryApi.listShoppingLists(),
    enabled: activeTab === 'lists' || activeTab === 'dashboard',
  })

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['grocery-purchases', searchTerm, categoryFilter],
    queryFn: () => groceryApi.listPurchases({
      search: searchTerm || undefined,
      category: categoryFilter || undefined,
      limit: 50,
    }),
    enabled: activeTab === 'history',
  })

  const { data: insightsData } = useQuery({
    queryKey: ['grocery-insights'],
    queryFn: () => groceryApi.getInsights(),
    enabled: activeTab === 'analytics',
  })

  const { data: categoryAnalytics } = useQuery({
    queryKey: ['grocery-category-analytics'],
    queryFn: () => groceryApi.getCategoryAnalytics(),
    enabled: activeTab === 'analytics',
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

  // Mutations
  const createListMutation = useMutation({
    mutationFn: (data: { name: string; notes?: string }) =>
      groceryApi.createShoppingList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      setShowNewListModal(false)
    },
  })

  const generateListMutation = useMutation({
    mutationFn: (data: { period_days?: number; min_frequency?: number; include_non_essential?: boolean }) =>
      groceryApi.generateShoppingList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
    },
  })

  const toggleItemMutation = useMutation({
    mutationFn: ({ listId, itemId, isChecked }: { listId: number; itemId: number; isChecked: boolean }) =>
      groceryApi.updateListItem(listId, itemId, { is_checked: isChecked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      if (selectedList) {
        groceryApi.getShoppingList(selectedList.id).then((res) => {
          setSelectedList(res.data)
        })
      }
    },
  })

  const deleteListMutation = useMutation({
    mutationFn: (id: number) => groceryApi.deleteShoppingList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      setSelectedList(null)
    },
  })

  const summary: PurchaseSummary | null = summaryData?.data || null
  const comparison: Comparison | null = comparisonData?.data || null
  const lists: ShoppingList[] = listsData?.data || []
  const purchases: Purchase[] = purchasesData?.data || []
  const insights: Insights | null = insightsData?.data || null

  const activeLists = lists.filter(l => l.status === 'active' || l.status === 'draft')

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

  // Category colors for charts
  const categoryColors: Record<string, string> = {
    fruits_vegetables: '#22C55E',
    meat_fish: '#EF4444',
    dairy: '#3B82F6',
    bakery: '#F59E0B',
    beverages: '#8B5CF6',
    snacks: '#EC4899',
    frozen: '#06B6D4',
    canned: '#6366F1',
    grains_pasta: '#D97706',
    condiments: '#84CC16',
    cleaning: '#14B8A6',
    hygiene: '#F97316',
    baby: '#A855F7',
    pet: '#10B981',
    household: '#64748B',
    other: '#9CA3AF',
  }

  const tabs: Array<{ id: TabType; label: string; icon: typeof ShoppingCart }> = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'lists', label: 'Listas', icon: List },
    { id: 'history', label: 'Histórico', icon: Clock },
    { id: 'analytics', label: 'Análise', icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-biveto" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mercado</h1>
          <HelpButton pageId="market" />
        </div>

        {/* Month selector for dashboard */}
        {activeTab === 'dashboard' && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
              {monthNames[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronRight size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-biveto text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total do Mês</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatCurrency(summary?.total || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-biveto-light dark:bg-biveto/20 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-biveto" />
                </div>
              </div>
              {comparison && (
                <div className={clsx(
                  'flex items-center gap-1 mt-3 text-sm',
                  comparison.comparison.total_diff > 0 ? 'text-red-500' : 'text-green-500'
                )}>
                  {comparison.comparison.total_diff > 0 ? (
                    <TrendingUp size={16} />
                  ) : (
                    <TrendingDown size={16} />
                  )}
                  <span>
                    {comparison.comparison.total_diff > 0 ? '+' : ''}
                    {comparison.comparison.total_diff_percent.toFixed(1)}% vs mês anterior
                  </span>
                </div>
              )}
            </div>

            {/* Essential */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Essencial</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {formatCurrency(summary?.essential_total || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${summary?.total ? (summary.essential_total / summary.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {summary?.total ? ((summary.essential_total / summary.total) * 100).toFixed(0) : 0}% do total
                </p>
              </div>
            </div>

            {/* Non-Essential */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Supérfluo</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {formatCurrency(summary?.non_essential_total || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Package className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${summary?.total ? (summary.non_essential_total / summary.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {summary?.total ? ((summary.non_essential_total / summary.total) * 100).toFixed(0) : 0}% do total
                </p>
              </div>
            </div>
          </div>

          {/* Categories Breakdown */}
          {summary && summary.by_category.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Gastos por Categoria
              </h3>
              <div className="space-y-3">
                {summary.by_category.slice(0, 5).map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: categoryColors[cat.category] || '#9CA3AF' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {cat.category_display}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2">
                          {formatCurrency(cat.total)}
                        </span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: categoryColors[cat.category] || '#9CA3AF',
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Shopping Lists */}
          {activeLists.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Listas Ativas
                </h3>
                <button
                  onClick={() => setActiveTab('lists')}
                  className="text-sm text-biveto hover:text-biveto-dark font-medium"
                >
                  Ver todas
                </button>
              </div>
              <div className="space-y-3">
                {activeLists.slice(0, 3).map((list) => (
                  <div
                    key={list.id}
                    onClick={() => {
                      setSelectedList(list)
                      setActiveTab('lists')
                    }}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{list.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {list.checked_items}/{list.total_items} itens
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                        <div
                          className="bg-biveto h-2 rounded-full transition-all"
                          style={{ width: `${list.progress_percent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {list.progress_percent.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {summaryLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
            </div>
          )}

          {!summaryLoading && (!summary || summary.item_count === 0) && (
            <EmptyState
              icon={ShoppingCart}
              title="Nenhuma compra registrada"
              description="Comece adicionando suas compras de mercado para acompanhar seus gastos."
            />
          )}
        </div>
      )}

      {/* Lists Tab */}
      {activeTab === 'lists' && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowNewListModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-biveto text-white rounded-xl font-medium hover:bg-biveto-dark transition-colors"
            >
              <Plus size={18} />
              Nova Lista
            </button>
            <button
              onClick={() => generateListMutation.mutate({})}
              disabled={generateListMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Sparkles size={18} className="text-amber-500" />
              {generateListMutation.isPending ? 'Gerando...' : 'Gerar do Histórico'}
            </button>
          </div>

          {/* List View / Detail View */}
          {selectedList ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedList(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedList.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedList.checked_items}/{selectedList.total_items} itens • {formatCurrency(selectedList.estimated_total)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir esta lista?')) {
                        deleteListMutation.mutate(selectedList.id)
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-biveto h-2 rounded-full transition-all"
                      style={{ width: `${selectedList.progress_percent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {selectedList.items.map((item) => (
                  <div
                    key={item.id}
                    className={clsx(
                      'flex items-center gap-4 p-4 transition-colors',
                      item.is_checked ? 'bg-gray-50 dark:bg-slate-700/30' : ''
                    )}
                  >
                    <button
                      onClick={() =>
                        toggleItemMutation.mutate({
                          listId: selectedList.id,
                          itemId: item.id,
                          isChecked: !item.is_checked,
                        })
                      }
                      className={clsx(
                        'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors',
                        item.is_checked
                          ? 'bg-biveto border-biveto text-white'
                          : 'border-gray-300 dark:border-slate-600 hover:border-biveto'
                      )}
                    >
                      {item.is_checked && <Check size={14} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          'font-medium truncate',
                          item.is_checked
                            ? 'text-gray-400 dark:text-gray-500 line-through'
                            : 'text-gray-900 dark:text-white'
                        )}
                      >
                        {item.product_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.quantity} {item.unit} • {item.category_display}
                      </p>
                    </div>
                    {item.estimated_price && (
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {formatCurrency(item.estimated_total || 0)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {selectedList.items.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum item na lista ainda.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Lists Grid */}
              {listsLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
                </div>
              )}

              {!listsLoading && lists.length === 0 && (
                <EmptyState
                  icon={List}
                  title="Nenhuma lista de compras"
                  description="Crie uma lista manual ou gere automaticamente do seu histórico de compras."
                />
              )}

              {!listsLoading && lists.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {lists.map((list) => (
                    <div
                      key={list.id}
                      onClick={() => setSelectedList(list)}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {list.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {list.total_items} itens
                          </p>
                        </div>
                        <span
                          className={clsx(
                            'px-2 py-1 rounded-lg text-xs font-medium',
                            list.status === 'active'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : list.status === 'completed'
                              ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          )}
                        >
                          {list.status === 'active'
                            ? 'Ativa'
                            : list.status === 'completed'
                            ? 'Completa'
                            : 'Rascunho'}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-500 dark:text-gray-400">Progresso</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {list.progress_percent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-biveto h-2 rounded-full transition-all"
                            style={{ width: `${list.progress_percent}%` }}
                          />
                        </div>
                      </div>

                      {list.estimated_total > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Estimativa
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(list.estimated_total)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-biveto focus:border-transparent"
              />
            </div>
            <select
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-biveto"
            >
              <option value="">Todas categorias</option>
              <option value="fruits_vegetables">Frutas e Verduras</option>
              <option value="meat_fish">Carnes e Peixes</option>
              <option value="dairy">Laticínios</option>
              <option value="bakery">Padaria</option>
              <option value="beverages">Bebidas</option>
              <option value="snacks">Lanches</option>
              <option value="cleaning">Limpeza</option>
              <option value="hygiene">Higiene</option>
            </select>
          </div>

          {/* Purchases List */}
          {purchasesLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
            </div>
          )}

          {!purchasesLoading && purchases.length === 0 && (
            <EmptyState
              icon={Clock}
              title="Nenhuma compra encontrada"
              description="Suas compras de mercado aparecerão aqui."
            />
          )}

          {!purchasesLoading && purchases.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {purchases.map((purchase) => (
                  <div key={purchase.id} className="p-4 flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${categoryColors[purchase.category] || '#9CA3AF'}20`,
                      }}
                    >
                      <Package
                        size={20}
                        style={{ color: categoryColors[purchase.category] || '#9CA3AF' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {purchase.product_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {purchase.quantity} {purchase.unit} • {purchase.category_display}
                        {purchase.merchant_name && ` • ${purchase.merchant_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(purchase.total_price)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(purchase.purchase_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Insights */}
          {insights && insights.insights.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {insights.insights.map((insight, index) => (
                <div
                  key={index}
                  className={clsx(
                    'rounded-2xl p-5 border',
                    insight.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : insight.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      size={20}
                      className={clsx(
                        insight.type === 'warning'
                          ? 'text-amber-600'
                          : insight.type === 'success'
                          ? 'text-green-600'
                          : 'text-blue-600'
                      )}
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {insight.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Potential Savings */}
          {insights && insights.potential_savings > 0 && (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <DollarSign size={28} />
                </div>
                <div>
                  <p className="text-green-100">Economia Potencial</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(insights.potential_savings)}
                  </p>
                  <p className="text-sm text-green-100 mt-1">
                    Se reduzir 10% dos gastos supérfluos
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Items */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Most Expensive */}
            {insights && insights.top_expensive_items.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Itens Mais Caros
                </h3>
                <div className="space-y-3">
                  {insights.top_expensive_items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Most Frequent */}
            {insights && insights.most_frequent_items.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Mais Comprados
                </h3>
                <div className="space-y-3">
                  {insights.most_frequent_items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {item.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {!insights && (
            <EmptyState
              icon={TrendingUp}
              title="Sem dados para análise"
              description="Registre suas compras de mercado para ver insights e análises."
            />
          )}
        </div>
      )}

      {/* New List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowNewListModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Nova Lista de Compras
                </h3>
                <button
                  onClick={() => setShowNewListModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  createListMutation.mutate({
                    name: formData.get('name') as string,
                    notes: formData.get('notes') as string || undefined,
                  })
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome da Lista
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Ex: Compras da semana"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-biveto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Observações sobre a lista..."
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-biveto resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewListModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createListMutation.isPending}
                    className="flex-1 px-4 py-2 bg-biveto text-white rounded-xl font-medium hover:bg-biveto-dark disabled:opacity-50"
                  >
                    {createListMutation.isPending ? 'Criando...' : 'Criar Lista'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
