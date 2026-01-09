import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { creditCardsApi } from '../services/api'
import {
  CreditCard as CreditCardIcon,
  Plus,
  Pencil,
  Trash2,
  X,
  Star,
  Calendar,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'

interface CreditCard {
  id: number
  account_id: number
  name: string
  credit_limit: number
  current_balance: number
  available_limit: number
  closing_day: number
  due_day: number
  has_points: boolean
  points_program: string | null
  points_factor?: number
  card_brand: string | null
  card_variant: string | null
  last_four_digits: string | null
  color: string | null
  icon: string | null
  is_active: boolean
  annual_fee: number | null
  annual_fee_waived: boolean
}

const pointsPrograms = [
  { value: 'livelo', label: 'Livelo' },
  { value: 'esfera', label: 'Esfera' },
  { value: 'smiles', label: 'Smiles' },
  { value: 'tudoazul', label: 'TudoAzul' },
  { value: 'latam_pass', label: 'LATAM Pass' },
  { value: 'multiplus', label: 'Multiplus' },
  { value: 'dotz', label: 'Dotz' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'other', label: 'Outro' },
]

const cardBrands = [
  'Visa',
  'Mastercard',
  'Elo',
  'American Express',
  'Hipercard',
  'Diners Club',
]

const defaultColors = [
  '#1e1e1e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#eab308', '#14b8a6', '#22c55e',
]

export default function CreditCards() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    credit_limit: '',
    initial_balance: '0',
    closing_day: '1',
    due_day: '10',
    has_points: false,
    points_program: '',
    points_factor: '1',
    card_brand: '',
    card_variant: '',
    last_four_digits: '',
    annual_fee: '',
    annual_fee_waived: false,
    benefits_notes: '',
    color: '#1e1e1e',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: creditCardsApi.list,
  })

  const cards: CreditCard[] = data?.data || []

  const createMutation = useMutation({
    mutationFn: (data: unknown) => creditCardsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      creditCardsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => creditCardsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const openCreateModal = () => {
    setEditingCard(null)
    setFormData({
      name: '',
      credit_limit: '',
      initial_balance: '0',
      closing_day: '1',
      due_day: '10',
      has_points: false,
      points_program: '',
      points_factor: '1',
      card_brand: '',
      card_variant: '',
      last_four_digits: '',
      annual_fee: '',
      annual_fee_waived: false,
      benefits_notes: '',
      color: '#1e1e1e',
    })
    setShowModal(true)
  }

  const openEditModal = (card: CreditCard) => {
    setEditingCard(card)
    setFormData({
      name: card.name,
      credit_limit: card.credit_limit.toString(),
      initial_balance: '0',
      closing_day: card.closing_day.toString(),
      due_day: card.due_day.toString(),
      has_points: card.has_points,
      points_program: card.points_program || '',
      points_factor: card.points_factor?.toString() || '1',
      card_brand: card.card_brand || '',
      card_variant: card.card_variant || '',
      last_four_digits: card.last_four_digits || '',
      annual_fee: '',
      annual_fee_waived: false,
      benefits_notes: '',
      color: card.color || '#1e1e1e',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCard(null)
  }

  const handleSubmit = () => {
    const payload = {
      name: formData.name,
      credit_limit: parseFloat(formData.credit_limit) || 0,
      initial_balance: parseFloat(formData.initial_balance) || 0,
      closing_day: parseInt(formData.closing_day) || 1,
      due_day: parseInt(formData.due_day) || 10,
      has_points: formData.has_points,
      points_program: formData.has_points ? formData.points_program : null,
      points_factor: formData.has_points ? parseFloat(formData.points_factor) || 1 : 1,
      card_brand: formData.card_brand || null,
      card_variant: formData.card_variant || null,
      last_four_digits: formData.last_four_digits || null,
      annual_fee: formData.annual_fee ? parseFloat(formData.annual_fee) : null,
      annual_fee_waived: formData.annual_fee_waived,
      benefits_notes: formData.benefits_notes || null,
      color: formData.color,
    }

    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (card: CreditCard) => {
    if (confirm(`Deseja excluir o cartão "${card.name}"?`)) {
      deleteMutation.mutate(card.id)
    }
  }

  const totalLimit = cards.reduce((sum, card) => sum + card.credit_limit, 0)
  const totalUsed = cards.reduce((sum, card) => sum + card.current_balance, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cartões de Crédito</h1>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus cartões e programas de pontos</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Novo Cartão
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-r from-gray-800 to-gray-900 text-white">
          <p className="text-sm opacity-90">Limite Total</p>
          <p className="text-2xl font-bold mt-1">
            {totalLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="card bg-gradient-to-r from-red-500 to-red-600 text-white">
          <p className="text-sm opacity-90">Total Utilizado</p>
          <p className="text-2xl font-bold mt-1">
            {totalUsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white">
          <p className="text-sm opacity-90">Limite Disponível</p>
          <p className="text-2xl font-bold mt-1">
            {(totalLimit - totalUsed).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="Nenhum cartão cadastrado"
          description="Cadastre seus cartões de crédito para acompanhar limites, faturas e pontos."
          actionLabel="Adicionar cartão"
          actionOnClick={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cards.map((card) => {
            const usagePercent = card.credit_limit > 0 ? (card.current_balance / card.credit_limit) * 100 : 0
            return (
              <div
                key={card.id}
                className="card p-3 hover:shadow-md transition-all"
              >
                {/* Card Header - mais compacto */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: card.color || '#1e1e1e' }}
                    >
                      <CreditCardIcon size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-white">{card.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {card.card_brand} {card.last_four_digits && `•••• ${card.last_four_digits}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => openEditModal(card)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(card)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Usage Bar - compacto */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">
                      {card.current_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <span className={clsx(
                      'font-medium',
                      usagePercent > 80 ? 'text-red-500' : usagePercent > 50 ? 'text-yellow-600' : 'text-green-600'
                    )}>
                      {usagePercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={clsx(
                        'h-1.5 rounded-full transition-all',
                        usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                      )}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Limite: {card.credit_limit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>

                {/* Info Tags - compacto */}
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                    Fecha: {card.closing_day}
                  </span>
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                    Vence: {card.due_day}
                  </span>
                  {card.has_points && (
                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Star size={10} />
                      {pointsPrograms.find(p => p.value === card.points_program)?.label || 'Pontos'}
                      {card.points_factor && card.points_factor > 1 && ` ${card.points_factor}x`}
                    </span>
                  )}
                  {card.annual_fee !== null && card.annual_fee > 0 && (
                    <span className={clsx(
                      'px-1.5 py-0.5 rounded',
                      card.annual_fee_waived
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    )}>
                      {card.annual_fee_waived
                        ? 'Anuidade isenta'
                        : `Anuidade: ${card.annual_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      }
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCard ? 'Editar Cartão' : 'Novo Cartão'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome do Cartão *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Nubank Ultravioleta"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bandeira
                  </label>
                  <select
                    value={formData.card_brand}
                    onChange={(e) => setFormData({ ...formData, card_brand: e.target.value })}
                    className="input"
                  >
                    <option value="">Selecione</option>
                    {cardBrands.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Variante
                  </label>
                  <input
                    type="text"
                    value={formData.card_variant}
                    onChange={(e) => setFormData({ ...formData, card_variant: e.target.value })}
                    className="input"
                    placeholder="Platinum, Black..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Limite *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    className="input"
                    placeholder="10000.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Final (4 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.last_four_digits}
                    onChange={(e) => setFormData({ ...formData, last_four_digits: e.target.value.replace(/\D/g, '') })}
                    className="input"
                    placeholder="1234"
                  />
                </div>
              </div>

              {/* Billing Cycle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Dia de Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.closing_day}
                    onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Dia de Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.due_day}
                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Points Program */}
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.has_points}
                    onChange={(e) => setFormData({ ...formData, has_points: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Acumula pontos
                  </span>
                </label>

                {formData.has_points && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Programa
                      </label>
                      <select
                        value={formData.points_program}
                        onChange={(e) => setFormData({ ...formData, points_program: e.target.value })}
                        className="input"
                      >
                        <option value="">Selecione</option>
                        {pointsPrograms.map((program) => (
                          <option key={program.value} value={program.value}>{program.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Fator (pts/R$)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.points_factor}
                        onChange={(e) => setFormData({ ...formData, points_factor: e.target.value })}
                        className="input"
                        placeholder="1.0"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor do Cartão
                </label>
                <div className="flex gap-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={clsx(
                        'w-8 h-8 rounded-full transition-transform',
                        formData.color === color && 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Annual Fee */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Anuidade
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.annual_fee}
                    onChange={(e) => setFormData({ ...formData, annual_fee: e.target.value })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.annual_fee_waived}
                      onChange={(e) => setFormData({ ...formData, annual_fee_waived: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Isento</span>
                  </label>
                </div>
              </div>

              {/* Benefits Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Benefícios/Observações
                </label>
                <textarea
                  value={formData.benefits_notes}
                  onChange={(e) => setFormData({ ...formData, benefits_notes: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Sala VIP, seguro viagem..."
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button onClick={closeModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name || !formData.credit_limit || createMutation.isPending || updateMutation.isPending}
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
