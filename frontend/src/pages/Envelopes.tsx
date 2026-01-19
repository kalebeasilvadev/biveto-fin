import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { envelopesApi, categoriesApi, familyApi } from '../services/api'
import {
  Plus,
  Wallet,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import { HelpButton } from '../components/help'
import OwnershipSelector from '../components/shared/OwnershipSelector'

interface Envelope {
  id: number
  name: string
  description: string | null
  category_id: number | null
  category_name: string | null
  period_type: string
  limit_amount: number
  current_balance: number
  period_start_date: string
  period_end_date: string
  allow_rollover: boolean
  max_rollover_amount: number | null
  rollover_balance: number
  refill_schedule: string
  custom_refill_day: number | null
  auto_refill: boolean
  status: string
  priority: number
  color: string | null
  icon: string | null
  is_active: boolean
  ownership_type: string
  spent_amount: number
  spent_percentage: number
  remaining_days: number
  daily_allowance: number
}

interface EnvelopeSummary {
  total_envelopes: number
  active_envelopes: number
  total_budgeted: number
  total_spent: number
  total_remaining: number
  overspent_count: number
  depleted_count: number
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

const periodTypeLabels: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  depleted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  overspent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const statusLabels: Record<string, string> = {
  available: 'Disponível',
  depleted: 'Esgotado',
  overspent: 'Estourado',
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default function Envelopes() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [_ownershipType, _setOwnershipType] = useState<'personal' | 'household'>('personal')
  const [showTransferModal, setShowTransferModal] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: null as number | null,
    period_type: 'monthly',
    limit_amount: '',
    allow_rollover: false,
    max_rollover_amount: '',
    auto_refill: true,
    color: '#3b82f6',
    ownership_type: 'personal' as 'personal' | 'household',
  })

  // Transfer form state
  const [transferData, setTransferData] = useState({
    from_envelope_id: 0,
    to_envelope_id: 0,
    amount: '',
    notes: '',
  })

  // Queries
  const { data: envelopes, isLoading } = useQuery<Envelope[]>({
    queryKey: ['envelopes'],
    queryFn: async () => {
      const response = await envelopesApi.list()
      return response.data
    },
  })

  const { data: summary } = useQuery<EnvelopeSummary>({
    queryKey: ['envelopes', 'summary'],
    queryFn: async () => {
      const response = await envelopesApi.getSummary()
      return response.data
    },
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.list()
      return response.data
    },
  })

  const { data: familyContext } = useQuery<FamilyContext | null>({
    queryKey: ['familyContext'],
    queryFn: async () => {
      try {
        const response = await familyApi.getContext()
        return response.data
      } catch {
        return null
      }
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      envelopesApi.create({
        ...data,
        category_id: data.category_id || undefined,
        limit_amount: parseFloat(data.limit_amount),
        max_rollover_amount: data.max_rollover_amount
          ? parseFloat(data.max_rollover_amount)
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof formData> }) =>
      envelopesApi.update(id, {
        ...data,
        limit_amount: data.limit_amount ? parseFloat(data.limit_amount) : undefined,
        max_rollover_amount: data.max_rollover_amount
          ? parseFloat(data.max_rollover_amount)
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => envelopesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] })
    },
  })

  const refillMutation = useMutation({
    mutationFn: (id: number) => envelopesApi.refill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] })
    },
  })

  const transferMutation = useMutation({
    mutationFn: (data: typeof transferData) =>
      envelopesApi.transfer({
        ...data,
        amount: parseFloat(data.amount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envelopes'] })
      setShowTransferModal(false)
      setTransferData({ from_envelope_id: 0, to_envelope_id: 0, amount: '', notes: '' })
    },
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      name: '',
      description: '',
      category_id: null,
      period_type: 'monthly',
      limit_amount: '',
      allow_rollover: false,
      max_rollover_amount: '',
      auto_refill: true,
      color: '#3b82f6',
      ownership_type: 'personal',
    })
  }

  const handleEdit = (envelope: Envelope) => {
    setEditingId(envelope.id)
    setFormData({
      name: envelope.name,
      description: envelope.description || '',
      category_id: envelope.category_id,
      period_type: envelope.period_type,
      limit_amount: envelope.limit_amount.toString(),
      allow_rollover: envelope.allow_rollover,
      max_rollover_amount: envelope.max_rollover_amount?.toString() || '',
      auto_refill: envelope.auto_refill,
      color: envelope.color || '#3b82f6',
      ownership_type: envelope.ownership_type as 'personal' | 'household',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-purple-500" />
            Envelopes
            <HelpButton pageId="envelopes" />
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Orçamento por categorias com limites diários/semanais
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Envelope
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Orçado</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(summary.total_budgeted)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Gasto</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
              {formatCurrency(summary.total_spent)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Disponível</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
              {formatCurrency(summary.total_remaining)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Alertas</p>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {summary.overspent_count + summary.depleted_count}
            </p>
          </div>
        </div>
      )}

      {/* Envelope Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Editar Envelope' : 'Novo Envelope'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoria
                </label>
                <select
                  value={formData.category_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category_id: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Sem categoria</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Limite
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.limit_amount}
                    onChange={(e) => setFormData({ ...formData, limit_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Período
                  </label>
                  <select
                    value={formData.period_type}
                    onChange={(e) => setFormData({ ...formData, period_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allow_rollover}
                    onChange={(e) =>
                      setFormData({ ...formData, allow_rollover: e.target.checked })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Permitir rollover
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.auto_refill}
                    onChange={(e) =>
                      setFormData({ ...formData, auto_refill: e.target.checked })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Recarga automática
                  </span>
                </label>
              </div>

              {familyContext && (
                <OwnershipSelector
                  value={formData.ownership_type}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      ownership_type: value as 'personal' | 'household',
                    })
                  }
                />
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowTransferModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Transferir entre Envelopes
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                transferMutation.mutate(transferData)
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  De
                </label>
                <select
                  value={transferData.from_envelope_id}
                  onChange={(e) =>
                    setTransferData({
                      ...transferData,
                      from_envelope_id: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value={0}>Selecione...</option>
                  {envelopes?.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name} ({formatCurrency(env.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Para
                </label>
                <select
                  value={transferData.to_envelope_id}
                  onChange={(e) =>
                    setTransferData({
                      ...transferData,
                      to_envelope_id: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value={0}>Selecione...</option>
                  {envelopes
                    ?.filter((env) => env.id !== transferData.from_envelope_id)
                    .map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={transferData.amount}
                  onChange={(e) =>
                    setTransferData({ ...transferData, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Transferir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Envelopes Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : envelopes && envelopes.length > 0 ? (
        <>
          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ArrowRight className="w-4 h-4" />
              Transferir
            </button>
          </div>

          {/* Envelopes list */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {envelopes.map((envelope) => (
              <EnvelopeCard
                key={envelope.id}
                envelope={envelope}
                onEdit={() => handleEdit(envelope)}
                onDelete={() => deleteMutation.mutate(envelope.id)}
                onRefill={() => refillMutation.mutate(envelope.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Wallet}
          title="Nenhum envelope criado"
          description="Crie envelopes para controlar seus gastos por categoria com limites diários ou semanais."
          actionLabel="Criar Envelope"
          actionOnClick={() => setShowForm(true)}
        />
      )}
    </div>
  )
}

function EnvelopeCard({
  envelope,
  onEdit,
  onDelete,
  onRefill,
}: {
  envelope: Envelope
  onEdit: () => void
  onDelete: () => void
  onRefill: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  const progressPercent = Math.min(envelope.spent_percentage, 100)
  const progressColor =
    envelope.status === 'overspent'
      ? 'bg-red-500'
      : envelope.status === 'depleted'
        ? 'bg-yellow-500'
        : envelope.spent_percentage > 80
          ? 'bg-orange-500'
          : 'bg-green-500'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: envelope.color || '#8b5cf6' }}
          >
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{envelope.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {envelope.category_name || periodTypeLabels[envelope.period_type]}
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 w-36">
                <button
                  onClick={() => {
                    onEdit()
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={() => {
                    onRefill()
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Recarregar
                </button>
                <button
                  onClick={() => {
                    onDelete()
                    setShowMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-3">
        <span
          className={clsx('text-xs px-2 py-1 rounded-full', statusColors[envelope.status])}
        >
          {statusLabels[envelope.status]}
        </span>
      </div>

      {/* Balance */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(envelope.current_balance)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            / {formatCurrency(envelope.limit_amount)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx('h-full transition-all', progressColor)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {envelope.spent_percentage.toFixed(0)}% utilizado
        </p>
      </div>

      {/* Daily allowance */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Por dia
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(envelope.daily_allowance)}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {envelope.remaining_days} dias restantes
        </p>
      </div>
    </div>
  )
}
