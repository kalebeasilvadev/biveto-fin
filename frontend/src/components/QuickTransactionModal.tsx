import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Check, User, Users, ArrowRightLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { transactionsApi, accountsApi, categoriesApi, familyApi } from '../services/api'

interface Account {
  id: number
  name: string
  type: string
}

interface Category {
  id: number
  name: string
  type: string
}

interface QuickTransactionModalProps {
  isOpen: boolean
  onClose: () => void
}

// Helper to get local date in YYYY-MM-DD format (avoid timezone issues)
const getLocalDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function QuickTransactionModal({ isOpen, onClose }: QuickTransactionModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'income' | 'transfer',
    amount: '',
    date: getLocalDateString(),
    account_id: '',
    destination_account_id: '',  // For transfers
    category_id: '',
    description: '',
    ownership_type: 'personal' as 'personal' | 'household',
  })

  // Lock body scroll and notify FAB when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.dispatchEvent(new CustomEvent('modalStateChange', { detail: { isOpen: true } }))
    } else {
      document.body.style.overflow = ''
      window.dispatchEvent(new CustomEvent('modalStateChange', { detail: { isOpen: false } }))
    }
    return () => {
      document.body.style.overflow = ''
      window.dispatchEvent(new CustomEvent('modalStateChange', { detail: { isOpen: false } }))
    }
  }, [isOpen])

  // Queries
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
    enabled: isOpen,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
    enabled: isOpen,
  })

  const { data: familyData } = useQuery({
    queryKey: ['family-context'],
    queryFn: async () => {
      try {
        const response = await familyApi.getContext()
        return response.data as { member_count: number }
      } catch {
        return null
      }
    },
    enabled: isOpen,
  })

  const accounts = (accountsData?.data || []) as Account[]
  const categories = (categoriesData?.data || []) as Category[]
  const showOwnershipSelector = familyData && familyData.member_count >= 2

  const filteredCategories = categories.filter(
    (cat) => cat.type === formData.type
  )

  // Set default account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !formData.account_id) {
      setFormData(prev => ({ ...prev, account_id: String(accounts[0].id) }))
    }
  }, [accounts, formData.account_id])

  // Mutation
  const createMutation = useMutation({
    mutationFn: (data: unknown) => transactionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      resetAndClose()
    },
  })

  const resetAndClose = () => {
    setFormData({
      type: 'expense',
      amount: '',
      date: getLocalDateString(),
      account_id: accounts.length > 0 ? String(accounts[0].id) : '',
      destination_account_id: '',
      category_id: '',
      description: '',
      ownership_type: 'personal',
    })
    onClose()
  }

  const handleSubmit = () => {
    const baseData = {
      type: formData.type,
      amount: parseFloat(formData.amount),
      date: formData.date,
      account_id: parseInt(formData.account_id),
      description: formData.description || null,
      ownership_type: formData.ownership_type,
    }

    // For transfers, add destination_account_id and skip category
    if (formData.type === 'transfer') {
      createMutation.mutate({
        ...baseData,
        destination_account_id: parseInt(formData.destination_account_id),
      })
    } else {
      createMutation.mutate({
        ...baseData,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4" onClick={resetAndClose}>
      <div
        className="bg-white dark:bg-slate-800 w-full sm:max-w-md sm:rounded-xl rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up z-[70]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-white">Nova Transação</h2>
          <button
            onClick={resetAndClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setFormData(prev => ({ ...prev, type: 'expense', category_id: '', destination_account_id: '' }))}
              className={clsx(
                'flex-1 py-2 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:text-base',
                formData.type === 'expense'
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-2 border-red-500'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
              )}
            >
              Despesa
            </button>
            <button
              onClick={() => setFormData(prev => ({ ...prev, type: 'income', category_id: '', destination_account_id: '' }))}
              className={clsx(
                'flex-1 py-2 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:text-base',
                formData.type === 'income'
                  ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-2 border-green-500'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
              )}
            >
              Receita
            </button>
            <button
              onClick={() => setFormData(prev => ({ ...prev, type: 'transfer', category_id: '' }))}
              className={clsx(
                'flex-1 py-2 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:text-base flex items-center justify-center gap-1',
                formData.type === 'transfer'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-2 border-blue-500'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
              )}
            >
              <ArrowRightLeft size={16} className="hidden sm:block" />
              Transf.
            </button>
          </div>

          {/* Amount - large input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor *
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              className="input text-2xl font-bold text-center"
              placeholder="0,00"
              autoFocus
            />
          </div>

          {/* Account selector - different for transfer */}
          {formData.type === 'transfer' ? (
            <>
              {/* Source Account (From) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  De (Conta Origem) *
                </label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Selecione a conta de origem</option>
                  {accounts
                    .filter(acc => ['wallet', 'bank'].includes(acc.type))
                    .filter(acc => String(acc.id) !== formData.destination_account_id)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                </select>
              </div>

              {/* Transfer Arrow Indicator */}
              <div className="flex justify-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <ArrowRightLeft size={20} className="text-blue-600 dark:text-blue-400 rotate-90" />
                </div>
              </div>

              {/* Destination Account (To) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Para (Conta Destino) *
                </label>
                <select
                  value={formData.destination_account_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, destination_account_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Selecione a conta de destino</option>
                  {accounts
                    .filter(acc => ['wallet', 'bank'].includes(acc.type))
                    .filter(acc => String(acc.id) !== formData.account_id)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Regular Account selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Conta *
                </label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Selecione</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              {/* Category - only for expense/income */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoria
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Selecione</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="input"
              placeholder="Ex: Almoço, Salário..."
            />
          </div>

          {/* Ownership Type */}
          {showOwnershipSelector && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Visibilidade
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, ownership_type: 'personal' }))}
                  className={clsx(
                    'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                    formData.ownership_type === 'personal'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300'
                  )}
                >
                  <User size={20} className={formData.ownership_type === 'personal' ? 'text-primary-600' : 'text-gray-400'} />
                  <span className={clsx('text-sm font-medium', formData.ownership_type === 'personal' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300')}>
                    Pessoal
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, ownership_type: 'household' }))}
                  className={clsx(
                    'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                    formData.ownership_type === 'household'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300'
                  )}
                >
                  <Users size={20} className={formData.ownership_type === 'household' ? 'text-primary-600' : 'text-gray-400'} />
                  <span className={clsx('text-sm font-medium', formData.ownership_type === 'household' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300')}>
                    Família
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {createMutation.isError && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm">
              Erro ao criar transação. Tente novamente.
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={
              !formData.amount ||
              !formData.account_id ||
              (formData.type === 'transfer' && !formData.destination_account_id) ||
              createMutation.isPending
            }
            className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? 'Salvando...' : (
              <>
                <Check size={20} />
                {formData.type === 'transfer' ? 'Transferir' : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
