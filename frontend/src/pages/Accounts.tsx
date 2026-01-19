import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountsApi, familyApi } from '../services/api'
import {
  Wallet,
  Building,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  User,
} from 'lucide-react'
import { HelpButton } from '../components/help'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import BankSelector from '../components/shared/BankSelector'
import BankLogo from '../components/shared/BankLogo'
import { getBankById, getBankColor } from '../data/banks'

interface Account {
  id: number
  name: string
  type: 'wallet' | 'bank' | 'credit_card' | 'investment'
  bank_id: string | null
  balance: number
  currency: string
  color: string | null
  icon: string | null
  is_active: boolean
  ownership_type: 'personal' | 'household'
}

interface FamilyContext {
  license_id: number
  member_count: number
  max_members: number
}

const accountTypes = [
  { value: 'wallet', label: 'Carteira', icon: Wallet },
  { value: 'bank', label: 'Banco', icon: Building },
  { value: 'investment', label: 'Investimento', icon: TrendingUp },
]

const defaultColors = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#eab308', '#14b8a6', '#64748b',
]

function getAccountIcon(type: string) {
  const accountType = accountTypes.find((t) => t.value === type)
  return accountType?.icon || Wallet
}

function getAccountTypeLabel(type: string) {
  const accountType = accountTypes.find((t) => t.value === type)
  return accountType?.label || type
}

export default function Accounts() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank',
    bank_id: null as string | null,
    balance: '',
    color: '#3b82f6',
    ownership_type: 'personal' as 'personal' | 'household',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
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

  // Filtrar cartões de crédito - eles têm tela própria
  const accounts: Account[] = (data?.data || []).filter(
    (acc: Account) => acc.type !== 'credit_card'
  )

  // Função para invalidar caches relacionados a contas
  const invalidateAccountCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: unknown) => accountsApi.create(data),
    onSuccess: () => {
      invalidateAccountCaches()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      accountsApi.update(id, data),
    onSuccess: () => {
      invalidateAccountCaches()
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountsApi.delete(id),
    onSuccess: () => {
      invalidateAccountCaches()
    },
  })

  const openCreateModal = () => {
    setEditingAccount(null)
    setFormData({
      name: '',
      type: 'bank',
      bank_id: null,
      balance: '',
      color: '#3b82f6',
      ownership_type: 'personal',
    })
    setShowModal(true)
  }

  const openEditModal = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      name: account.name,
      type: account.type,
      bank_id: account.bank_id,
      balance: account.balance.toString(),
      color: account.color || '#3b82f6',
      ownership_type: account.ownership_type || 'personal',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingAccount(null)
  }

  const handleBankSelect = (bankId: string | null) => {
    const bank = bankId ? getBankById(bankId) : null
    setFormData({
      ...formData,
      bank_id: bankId,
      // Auto-fill name if it's empty or matches the previous bank name
      name: formData.name === '' || (formData.bank_id && formData.name === getBankById(formData.bank_id)?.name)
        ? bank?.name || ''
        : formData.name,
      // Auto-set color from bank
      color: bank?.color || formData.color,
    })
  }

  const handleSubmit = () => {
    const payload = {
      name: formData.name,
      type: formData.type,
      bank_id: formData.type === 'bank' ? formData.bank_id : null,
      balance: parseFloat(formData.balance) || 0,
      color: formData.color,
      ownership_type: formData.ownership_type,
    }

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (account: Account) => {
    if (confirm(`Deseja excluir a conta "${account.name}"?`)) {
      deleteMutation.mutate(account.id)
    }
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Minhas Contas</h1>
            <HelpButton pageId="accounts" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie suas contas bancárias e carteiras</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <Plus size={18} />
          <span className="hidden sm:inline">Nova Conta</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <p className="text-sm opacity-90">Saldo Total</p>
        <p className="text-3xl font-bold mt-1">
          {totalBalance.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
        </p>
        <p className="text-sm opacity-75 mt-2">{accounts.length} conta(s)</p>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma conta cadastrada"
          description="Cadastre suas contas bancárias e carteiras para acompanhar seus saldos."
          actionLabel="Criar primeira conta"
          actionOnClick={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const Icon = getAccountIcon(account.type)
            const displayColor = account.bank_id ? getBankColor(account.bank_id) : (account.color || '#3b82f6')
            return (
              <div
                key={account.id}
                className="card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {account.bank_id && account.type === 'bank' ? (
                      <BankLogo bankId={account.bank_id} size="lg" />
                    ) : (
                      <div
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: `${displayColor}20` }}
                      >
                        <Icon size={24} style={{ color: displayColor }} />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{account.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {getAccountTypeLabel(account.type)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(account)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p
                    className={clsx(
                      'text-2xl font-bold',
                      account.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'
                    )}
                  >
                    {account.balance.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: account.currency || 'BRL',
                    })}
                  </p>
                  {account.ownership_type === 'household' && (
                    <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                      <Users size={12} />
                      Família
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value, bank_id: e.target.value !== 'bank' ? null : formData.bank_id })}
                  className="input"
                >
                  {accountTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.type === 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Banco
                  </label>
                  <BankSelector
                    value={formData.bank_id}
                    onChange={handleBankSelect}
                    placeholder="Selecione o banco"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Nubank Corrente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Saldo Inicial
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  className="input"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex gap-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={clsx(
                        'w-8 h-8 rounded-full transition-transform',
                        formData.color === color && 'ring-2 ring-offset-2 ring-primary-500 scale-110 dark:ring-offset-gray-800'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {showOwnershipSelector && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Visibilidade
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ownership_type: 'personal' })}
                      className={clsx(
                        'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                        formData.ownership_type === 'personal'
                          ? 'border-biveto bg-biveto-light dark:bg-biveto/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      )}
                    >
                      <User size={20} className={formData.ownership_type === 'personal' ? 'text-biveto' : 'text-gray-400'} />
                      <span className={clsx('text-sm font-medium', formData.ownership_type === 'personal' ? 'text-biveto' : 'text-gray-600 dark:text-gray-400')}>
                        Pessoal
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ownership_type: 'household' })}
                      className={clsx(
                        'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                        formData.ownership_type === 'household'
                          ? 'border-biveto bg-biveto-light dark:bg-biveto/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      )}
                    >
                      <Users size={20} className={formData.ownership_type === 'household' ? 'text-biveto' : 'text-gray-400'} />
                      <span className={clsx('text-sm font-medium', formData.ownership_type === 'household' ? 'text-biveto' : 'text-gray-600 dark:text-gray-400')}>
                        Família
                      </span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button onClick={closeModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
