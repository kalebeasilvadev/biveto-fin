import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incomeSplitRulesApi, categoriesApi } from '../services/api'
import {
  Percent,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  X,
  PiggyBank,
  Heart,
  TrendingUp,
  Wallet,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'

interface IncomeSplitRule {
  id: number
  user_id: number
  name: string
  split_type: 'percentage' | 'fixed'
  percentage: number | null
  fixed_amount: number | null
  category_id: number | null
  category_name: string | null
  description_template: string | null
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

interface Category {
  id: number
  name: string
  type: string
  icon: string | null
  color: string | null
}

const splitTypeOptions = [
  { value: 'percentage', label: 'Porcentagem', icon: Percent, description: 'Ex: 10% da receita' },
  { value: 'fixed', label: 'Valor Fixo', icon: DollarSign, description: 'Ex: R$ 500,00' },
]

const suggestionTemplates = [
  { name: 'Dizimo', split_type: 'percentage', percentage: 10, icon: Heart, color: 'text-purple-600' },
  { name: 'Poupanca', split_type: 'percentage', percentage: 20, icon: PiggyBank, color: 'text-blue-600' },
  { name: 'Investimento', split_type: 'percentage', percentage: 15, icon: TrendingUp, color: 'text-green-600' },
  { name: 'Reserva de Emergencia', split_type: 'percentage', percentage: 10, icon: Wallet, color: 'text-orange-600' },
]

function getRuleIcon(name: string) {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('dizimo') || nameLower.includes('doacao') || nameLower.includes('oferta')) {
    return Heart
  }
  if (nameLower.includes('poupanca') || nameLower.includes('reserva')) {
    return PiggyBank
  }
  if (nameLower.includes('invest')) {
    return TrendingUp
  }
  return Wallet
}

export default function IncomeSplitRules() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState<IncomeSplitRule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    split_type: 'percentage' as 'percentage' | 'fixed',
    percentage: '',
    fixed_amount: '',
    category_id: '',
    description_template: '',
    priority: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['income-split-rules'],
    queryFn: () => incomeSplitRulesApi.list(false), // Include inactive rules
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const rules: IncomeSplitRule[] = data?.data || []
  const categories: Category[] = categoriesData?.data || []
  const expenseCategories = categories.filter(c => c.type === 'expense')

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof incomeSplitRulesApi.create>[0]) =>
      incomeSplitRulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-split-rules'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof incomeSplitRulesApi.update>[1] }) =>
      incomeSplitRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-split-rules'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => incomeSplitRulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-split-rules'] })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      incomeSplitRulesApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-split-rules'] })
    },
  })

  const openCreateModal = (template?: typeof suggestionTemplates[0]) => {
    setEditingRule(null)
    setFormData({
      name: template?.name || '',
      split_type: (template?.split_type as 'percentage' | 'fixed') || 'percentage',
      percentage: template?.percentage?.toString() || '',
      fixed_amount: '',
      category_id: '',
      description_template: '',
      priority: rules.length,
    })
    setShowModal(true)
  }

  const openEditModal = (rule: IncomeSplitRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      split_type: rule.split_type,
      percentage: rule.percentage?.toString() || '',
      fixed_amount: rule.fixed_amount?.toString() || '',
      category_id: rule.category_id?.toString() || '',
      description_template: rule.description_template || '',
      priority: rule.priority,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingRule(null)
  }

  const handleSubmit = () => {
    const payload = {
      name: formData.name,
      split_type: formData.split_type,
      percentage: formData.split_type === 'percentage' && formData.percentage
        ? parseFloat(formData.percentage)
        : undefined,
      fixed_amount: formData.split_type === 'fixed' && formData.fixed_amount
        ? parseFloat(formData.fixed_amount)
        : undefined,
      category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
      description_template: formData.description_template || undefined,
      priority: formData.priority,
    }

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: payload })
    } else {
      createMutation.mutate(payload as Parameters<typeof incomeSplitRulesApi.create>[0])
    }
  }

  const handleDelete = (rule: IncomeSplitRule) => {
    if (confirm(`Deseja excluir a regra "${rule.name}"?`)) {
      deleteMutation.mutate(rule.id)
    }
  }

  const handleToggleActive = (rule: IncomeSplitRule) => {
    toggleActiveMutation.mutate({ id: rule.id, is_active: !rule.is_active })
  }

  const activeRules = rules.filter(r => r.is_active)
  const inactiveRules = rules.filter(r => !r.is_active)

  // Calculate total percentage for active rules
  const totalPercentage = activeRules
    .filter(r => r.split_type === 'percentage')
    .reduce((sum, r) => sum + (r.percentage || 0), 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Divisao de Receitas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure regras para dividir suas receitas automaticamente (dizimo, poupanca, etc.)
          </p>
        </div>
        <button onClick={() => openCreateModal()} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus size={18} />
          <span className="hidden sm:inline">Nova Regra</span>
        </button>
      </div>

      {/* Summary Card */}
      {activeRules.length > 0 && (
        <div className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total de Deducoes Configuradas</p>
              <p className="text-3xl font-bold mt-1">{totalPercentage.toFixed(1)}%</p>
              <p className="text-sm opacity-75 mt-2">{activeRules.length} regra(s) ativa(s)</p>
            </div>
            <div className="bg-white/20 p-4 rounded-full">
              <Percent size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Quick Suggestions */}
      {rules.length === 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Sugestoes rapidas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {suggestionTemplates.map((template) => {
              const Icon = template.icon
              return (
                <button
                  key={template.name}
                  onClick={() => openCreateModal(template)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                >
                  <Icon size={24} className={template.color} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{template.name}</span>
                  <span className="text-xs text-gray-500">{template.percentage}%</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="Nenhuma regra configurada"
          description="Configure regras para dividir automaticamente suas receitas em categorias como dizimo, poupanca ou investimentos."
          actionLabel="Adicionar regra"
          actionOnClick={() => openCreateModal()}
        />
      ) : (
        <div className="space-y-4">
          {/* Active Rules */}
          {activeRules.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Regras Ativas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeRules.map((rule) => {
                  const Icon = getRuleIcon(rule.name)
                  return (
                    <div key={rule.id} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <Icon size={24} className="text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">{rule.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {rule.split_type === 'percentage'
                                ? `${rule.percentage}% da receita`
                                : `R$ ${rule.fixed_amount?.toFixed(2)} fixo`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleToggleActive(rule)}
                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                            title="Desativar regra"
                          >
                            <ToggleRight size={20} />
                          </button>
                        </div>
                      </div>

                      {rule.category_name && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Categoria: <span className="font-medium">{rule.category_name}</span>
                          </p>
                        </div>
                      )}

                      <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="flex-1 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"
                        >
                          <Pencil size={14} />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="flex-1 p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"
                        >
                          <Trash2 size={14} />
                          Excluir
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Inactive Rules */}
          {inactiveRules.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Regras Inativas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveRules.map((rule) => {
                  const Icon = getRuleIcon(rule.name)
                  return (
                    <div key={rule.id} className="card opacity-60 hover:opacity-100 transition-opacity">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                            <Icon size={24} className="text-gray-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-600 dark:text-gray-400">{rule.name}</h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                              {rule.split_type === 'percentage'
                                ? `${rule.percentage}% da receita`
                                : `R$ ${rule.fixed_amount?.toFixed(2)} fixo`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                          title="Ativar regra"
                        >
                          <ToggleLeft size={20} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRule ? 'Editar Regra de Divisao' : 'Nova Regra de Divisao'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Regra *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Dizimo, Poupanca, Investimento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Divisao *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {splitTypeOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, split_type: option.value as 'percentage' | 'fixed' })}
                        className={clsx(
                          'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                          formData.split_type === option.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        )}
                      >
                        <Icon size={24} className={formData.split_type === option.value ? 'text-purple-600' : 'text-gray-400'} />
                        <span className={clsx('text-sm font-medium', formData.split_type === option.value ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400')}>
                          {option.label}
                        </span>
                        <span className="text-xs text-gray-400">{option.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {formData.split_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Porcentagem *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.percentage}
                      onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                      className="input pr-8"
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
              )}

              {formData.split_type === 'fixed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Fixo *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fixed_amount}
                      onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })}
                      className="input pl-10"
                      placeholder="500.00"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoria da Despesa
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="input"
                >
                  <option value="">Selecione uma categoria</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  A despesa gerada sera registrada nesta categoria
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Modelo de Descricao
                </label>
                <input
                  type="text"
                  value={formData.description_template}
                  onChange={(e) => setFormData({ ...formData, description_template: e.target.value })}
                  className="input"
                  placeholder="{name} - {description}"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Use {'{name}'}, {'{description}'}, {'{percentage}'} ou {'{amount}'} como variaveis
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button onClick={closeModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    !formData.name ||
                    (formData.split_type === 'percentage' && !formData.percentage) ||
                    (formData.split_type === 'fixed' && !formData.fixed_amount) ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
