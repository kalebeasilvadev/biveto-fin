import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { creditCardsApi, familyApi, getApiErrorMessage } from '../services/api'
import {
  CreditCard as CreditCardIcon,
  Plus,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import CreditCardModal from '../components/credit-cards/CreditCardModal'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import { useToastStore } from '../stores/toastStore'
import {
  CreditCard,
  CreditCardFormData,
  CreditCardPayload,
  pointsPrograms,
} from '../schemas/creditCard.schema'
import BankLogo from '../components/shared/BankLogo'
import CardBrandLogo from '../components/shared/CardBrandLogo'

// Format currency in compact form for mobile (e.g., R$ 237,1k)
function formatCompactCurrency(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 1_000_000) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 1,
      notation: 'compact',
      compactDisplay: 'short'
    })
  }
  if (absValue >= 10_000) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    })
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface FamilyContext {
  license_id: number
  member_count: number
  max_members: number
}

export default function CreditCards() {
  const queryClient = useQueryClient()
  const toast = useToastStore()
  const [showModal, setShowModal] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<CreditCard | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: creditCardsApi.list,
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

  const cards: CreditCard[] = data?.data || []

  const invalidateCreditCardCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreditCardPayload) => creditCardsApi.create(data),
    onSuccess: () => {
      invalidateCreditCardCaches()
      setShowModal(false)
      setEditingCard(null)
      setApiError(null)
      toast.success('Cartão criado com sucesso!')
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Erro ao criar cartão')
      setApiError(message)
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreditCardPayload }) =>
      creditCardsApi.update(id, data),
    onSuccess: () => {
      invalidateCreditCardCaches()
      setShowModal(false)
      setEditingCard(null)
      setApiError(null)
      toast.success('Cartão atualizado com sucesso!')
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Erro ao atualizar cartão')
      setApiError(message)
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => creditCardsApi.delete(id),
    onSuccess: () => {
      invalidateCreditCardCaches()
      setDeleteConfirm(null)
      toast.success('Cartão excluído com sucesso!')
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Erro ao excluir cartão')
      toast.error(message)
    },
  })

  const openCreateModal = () => {
    setEditingCard(null)
    setApiError(null)
    setShowModal(true)
  }

  const openEditModal = (card: CreditCard) => {
    setEditingCard(card)
    setApiError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCard(null)
    setApiError(null)
  }

  const handleSubmit = (formData: CreditCardFormData) => {
    const payload: CreditCardPayload = {
      name: formData.name,
      nickname: formData.nickname || null,
      bank_id: formData.bank_id || null,
      credit_limit: formData.credit_limit,
      initial_balance: formData.initial_balance,
      closing_day: formData.closing_day,
      due_day: formData.due_day,
      has_points: formData.has_points,
      points_program: formData.has_points ? formData.points_program : null,
      points_factor: formData.has_points ? formData.points_factor : 1,
      card_brand: formData.card_brand || null,
      card_variant: formData.card_variant || null,
      last_four_digits: formData.last_four_digits || null,
      annual_fee: formData.annual_fee,
      annual_fee_frequency: formData.annual_fee_frequency,
      annual_fee_waived: formData.annual_fee_waived,
      benefits_notes: formData.benefits_notes || null,
      color: formData.color,
      ownership_type: formData.ownership_type,
    }

    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDeleteClick = (card: CreditCard) => {
    setDeleteConfirm(card)
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cartões de Crédito</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie seus cartões e pontos</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <Plus size={18} />
          <span className="hidden sm:inline">Novo Cartão</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="card bg-gradient-to-r from-gray-800 to-gray-900 text-white p-3 sm:p-4">
          <p className="text-xs sm:text-sm opacity-90">Limite</p>
          <p className="text-sm sm:text-2xl font-bold mt-1" title={totalLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}>
            <span className="sm:hidden">{formatCompactCurrency(totalLimit)}</span>
            <span className="hidden sm:inline">{totalLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </p>
        </div>
        <div className="card bg-gradient-to-r from-red-500 to-red-600 text-white p-3 sm:p-4">
          <p className="text-xs sm:text-sm opacity-90">Utilizado</p>
          <p className="text-sm sm:text-2xl font-bold mt-1" title={totalUsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}>
            <span className="sm:hidden">{formatCompactCurrency(totalUsed)}</span>
            <span className="hidden sm:inline">{totalUsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </p>
        </div>
        <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white p-3 sm:p-4">
          <p className="text-xs sm:text-sm opacity-90">Disponível</p>
          <p className="text-sm sm:text-2xl font-bold mt-1" title={(totalLimit - totalUsed).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}>
            <span className="sm:hidden">{formatCompactCurrency(totalLimit - totalUsed)}</span>
            <span className="hidden sm:inline">{(totalLimit - totalUsed).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
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
                {/* Card Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {card.bank_id ? (
                      <BankLogo bankId={card.bank_id} size="md" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: card.color || '#1e1e1e' }}
                      >
                        <CreditCardIcon size={16} className="text-white" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[120px]">
                        {card.nickname || card.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {card.card_brand && <CardBrandLogo brandId={card.card_brand} size="sm" className="h-3 w-auto" />}
                        {card.last_four_digits && <span>•••• {card.last_four_digits}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(card)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(card)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Usage Bar */}
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
                  <div className="flex justify-between text-xs mt-0.5">
                    <p className="text-gray-400">
                      Limite: {card.credit_limit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-green-600 dark:text-green-400 font-medium">
                      Disponível: {card.available_limit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>

                {/* Info Tags */}
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
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded',
                    (!card.annual_fee || card.annual_fee === 0 || card.annual_fee_waived)
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  )}>
                    {(!card.annual_fee || card.annual_fee === 0 || card.annual_fee_waived)
                      ? 'Anuidade isenta'
                      : `${card.annual_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${card.annual_fee_frequency === 'monthly' ? '/mês' : '/ano'}`
                    }
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      <CreditCardModal
        isOpen={showModal}
        onClose={closeModal}
        onSubmit={handleSubmit}
        editingCard={editingCard}
        isLoading={createMutation.isPending || updateMutation.isPending}
        error={apiError}
        showOwnershipSelector={showOwnershipSelector || false}
      />

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Cartão"
        message={`Deseja excluir o cartão "${deleteConfirm?.name}"? Esta ação não pode ser desfeita e todas as transações associadas serão perdidas.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
