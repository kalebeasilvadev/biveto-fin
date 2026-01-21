import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { benefitCardsApi, familyApi, getApiErrorMessage } from '../services/api'
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  UtensilsCrossed,
  ShoppingCart,
  Bus,
  Ticket,
  Fuel,
  CircleDollarSign,
} from 'lucide-react'
import { HelpButton } from '../components/help'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import BenefitCardModal from '../components/benefit-cards/BenefitCardModal'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import { useToastStore } from '../stores/toastStore'
import {
  BenefitCard,
  BenefitCardFormData,
  BenefitCardPayload,
  benefitProviders,
} from '../schemas/benefitCard.schema'

// Icones por tipo de cartao
const cardTypeIcons: Record<string, typeof ShoppingCart> = {
  va: ShoppingCart,
  vr: UtensilsCrossed,
  flex: Wallet,
  vt: Bus,
  cultura: Ticket,
  combustivel: Fuel,
}

// Format currency in compact form for mobile
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

export default function BenefitCards() {
  const queryClient = useQueryClient()
  const toast = useToastStore()
  const [showModal, setShowModal] = useState(false)
  const [editingCard, setEditingCard] = useState<BenefitCard | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<BenefitCard | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  const { data, isLoading } = useQuery({
    queryKey: ['benefit-cards'],
    queryFn: benefitCardsApi.list,
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

  const cards: BenefitCard[] = data?.data || []

  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['benefit-cards'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: BenefitCardPayload) => benefitCardsApi.create(data),
    onSuccess: () => {
      invalidateCaches()
      setShowModal(false)
      setEditingCard(null)
      setApiError(null)
      toast.success('Cartao criado com sucesso!')
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Erro ao criar cartao')
      setApiError(message)
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BenefitCardPayload> }) =>
      benefitCardsApi.update(id, data),
    onSuccess: () => {
      invalidateCaches()
      setShowModal(false)
      setEditingCard(null)
      setApiError(null)
      toast.success('Cartao atualizado com sucesso!')
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Erro ao atualizar cartao')
      setApiError(message)
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => benefitCardsApi.delete(id),
    onSuccess: () => {
      invalidateCaches()
      setDeleteConfirm(null)
      toast.success('Cartao excluido com sucesso!')
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Erro ao excluir cartao')
      toast.error(message)
    },
  })

  const openCreateModal = () => {
    setEditingCard(null)
    setApiError(null)
    setShowModal(true)
  }

  const openEditModal = (card: BenefitCard) => {
    setEditingCard(card)
    setApiError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCard(null)
    setApiError(null)
  }

  const handleSubmit = (formData: BenefitCardFormData) => {
    const payload: BenefitCardPayload = {
      name: formData.name,
      card_type: formData.card_type,
      provider: formData.provider || null,
      last_four_digits: formData.last_four_digits || null,
      initial_balance: formData.initial_balance,
      expected_monthly_recharge: formData.expected_monthly_recharge,
      recharge_day: formData.recharge_day,
      linked_income_source_id: formData.linked_income_source_id,
      color: formData.color,
      ownership_type: formData.ownership_type,
    }

    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDeleteClick = (card: BenefitCard) => {
    setDeleteConfirm(card)
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id)
    }
  }

  // Totais
  const totalBalance = cards.reduce((sum, card) => sum + card.current_balance, 0)
  const totalExpectedRecharge = cards.reduce((sum, card) => sum + (card.expected_monthly_recharge || 0), 0)

  // Agrupa por tipo
  const cardsByType = cards.reduce((acc, card) => {
    const type = card.card_type
    if (!acc[type]) acc[type] = []
    acc[type].push(card)
    return acc
  }, {} as Record<string, BenefitCard[]>)

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cartoes de Beneficio</h1>
            <HelpButton pageId="benefit-cards" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie seus vales VA, VR e outros beneficios</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <Plus size={18} />
          <span className="hidden sm:inline">Novo Cartao</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white p-3 sm:p-4">
          <p className="text-xs sm:text-sm opacity-90">Saldo Total</p>
          <p className="text-sm sm:text-2xl font-bold mt-1" title={totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}>
            <span className="sm:hidden">{formatCompactCurrency(totalBalance)}</span>
            <span className="hidden sm:inline">{totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </p>
        </div>
        <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 sm:p-4">
          <p className="text-xs sm:text-sm opacity-90">Recarga Mensal</p>
          <p className="text-sm sm:text-2xl font-bold mt-1" title={totalExpectedRecharge.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}>
            <span className="sm:hidden">{formatCompactCurrency(totalExpectedRecharge)}</span>
            <span className="hidden sm:inline">{totalExpectedRecharge.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum cartao cadastrado"
          description="Cadastre seus cartoes de beneficio (VA, VR, VT) para acompanhar saldos e recargas."
          actionLabel="Adicionar cartao"
          actionOnClick={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cards.map((card) => {
            const CardIcon = cardTypeIcons[card.card_type] || CircleDollarSign
            const providerInfo = benefitProviders.find(p => p.value === card.provider)

            return (
              <div
                key={card.id}
                className="card p-3 hover:shadow-md transition-all"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: card.color || '#00A859' }}
                    >
                      <CardIcon size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[140px]">
                        {card.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span>{card.card_type_display}</span>
                        {card.last_four_digits && <span>**** {card.last_four_digits}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="relative" ref={openMenuId === card.id ? menuRef : null}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === card.id ? null : card.id)}
                      className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openMenuId === card.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
                        <button
                          onClick={() => {
                            openEditModal(card)
                            setOpenMenuId(null)
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                        >
                          <Pencil size={16} />
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteClick(card)
                            setOpenMenuId(null)
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 size={16} />
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Balance */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo disponivel</p>
                  <p className={clsx(
                    'text-xl font-bold',
                    card.current_balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                  )}>
                    {card.current_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>

                {/* Info Tags */}
                <div className="flex flex-wrap gap-1 text-xs">
                  {card.provider_display && (
                    <span
                      className="px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: providerInfo?.color || '#6B7280' }}
                    >
                      {card.provider_display}
                    </span>
                  )}
                  {card.recharge_day && (
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                      Recarga dia {card.recharge_day}
                    </span>
                  )}
                  {card.expected_monthly_recharge && (
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                      +{card.expected_monthly_recharge.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mes
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Criacao/Edicao */}
      <BenefitCardModal
        isOpen={showModal}
        onClose={closeModal}
        onSubmit={handleSubmit}
        editingCard={editingCard}
        isLoading={createMutation.isPending || updateMutation.isPending}
        error={apiError}
        showOwnershipSelector={showOwnershipSelector || false}
      />

      {/* Modal de Confirmacao de Exclusao */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Cartao"
        message={`Deseja excluir o cartao "${deleteConfirm?.name}"? Esta acao nao pode ser desfeita e o saldo sera perdido.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
