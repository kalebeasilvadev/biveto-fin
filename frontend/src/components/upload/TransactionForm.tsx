import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, AlertCircle, User, Users, Repeat, Wallet, Building, CreditCard, ArrowRightLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { TransactionFormData } from '../../types/upload'

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
  type: string
}

interface TransactionFormProps {
  formData: TransactionFormData
  onChange: (data: Partial<TransactionFormData>) => void
  accounts: Account[]
  categories: Category[]
  onSubmit: () => void
  isPending: boolean
  isManual: boolean
  showOwnershipSelector: boolean
  showInstallmentSection?: boolean
  editingItemDescription?: string
  onCloseEdit?: () => void
}

export default function TransactionForm({
  formData,
  onChange,
  accounts,
  categories,
  onSubmit,
  isPending,
  isManual,
  showOwnershipSelector,
  showInstallmentSection = true,
  editingItemDescription,
  onCloseEdit,
}: TransactionFormProps) {
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'wallet' | 'bank' | 'credit_card'>('all')

  const filteredCategories = categories.filter(
    (cat) => isManual ? cat.type === formData.type : cat.type === 'expense'
  )

  // Filtrar contas baseado no tipo selecionado
  const filteredAccounts = accountTypeFilter === 'all'
    ? accounts
    : accounts.filter((acc) => acc.type === accountTypeFilter)

  return (
    <div className="space-y-4">
      {/* Type selector (manual only) */}
      {isManual && (
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ type: 'expense', category_id: '', destination_account_id: '' })}
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
            onClick={() => onChange({ type: 'income', category_id: '', destination_account_id: '' })}
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
            onClick={() => onChange({ type: 'transfer', category_id: '' })}
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
      )}

      {/* Editing item header */}
      {editingItemDescription && onCloseEdit && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Editando item</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">{editingItemDescription}</p>
          </div>
          <button onClick={onCloseEdit} className="text-blue-600 hover:text-blue-800">
            <AlertCircle size={20} />
          </button>
        </div>
      )}

      {/* Account selector - different UI for transfers */}
      {formData.type === 'transfer' ? (
        <>
          {/* Source Account (From) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              De (Conta Origem) *
            </label>
            <select
              value={formData.account_id}
              onChange={(e) => onChange({ account_id: e.target.value })}
              className="input"
            >
              <option value="">Selecione a conta de origem</option>
              {accounts
                .filter(acc => ['wallet', 'bank', 'investment'].includes(acc.type))
                .filter(acc => String(acc.id) !== formData.destination_account_id)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({accountTypeLabels[acc.type]})</option>
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
              onChange={(e) => onChange({ destination_account_id: e.target.value })}
              className="input"
            >
              <option value="">Selecione a conta de destino</option>
              {accounts
                .filter(acc => ['wallet', 'bank', 'investment'].includes(acc.type))
                .filter(acc => String(acc.id) !== formData.account_id)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({accountTypeLabels[acc.type]})</option>
                ))}
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conta *</label>
          {accounts.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="text-yellow-800 dark:text-yellow-300 font-medium">Nenhuma conta cadastrada</p>
                <Link to="/accounts" className="text-yellow-600 dark:text-yellow-400 hover:underline">
                  Clique aqui para criar uma conta
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Account type filter buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccountTypeFilter('all')
                    onChange({ account_id: '' })
                  }}
                  className={clsx(
                    'p-2 rounded-lg border-2 text-xs font-medium transition-all flex flex-col items-center gap-1',
                    accountTypeFilter === 'all'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  <span className="text-lg">💼</span>
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountTypeFilter('wallet')
                    onChange({ account_id: '' })
                  }}
                  className={clsx(
                    'p-2 rounded-lg border-2 text-xs font-medium transition-all flex flex-col items-center gap-1',
                    accountTypeFilter === 'wallet'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  <Wallet size={18} />
                  Carteira
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountTypeFilter('bank')
                    onChange({ account_id: '' })
                  }}
                  className={clsx(
                    'p-2 rounded-lg border-2 text-xs font-medium transition-all flex flex-col items-center gap-1',
                    accountTypeFilter === 'bank'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  <Building size={18} />
                  Banco
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountTypeFilter('credit_card')
                    onChange({ account_id: '' })
                  }}
                  className={clsx(
                    'p-2 rounded-lg border-2 text-xs font-medium transition-all flex flex-col items-center gap-1',
                    accountTypeFilter === 'credit_card'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  <CreditCard size={18} />
                  Cartão
                </button>
              </div>

              {/* Account selector dropdown */}
              <select
                value={formData.account_id}
                onChange={(e) => onChange({ account_id: e.target.value })}
                className="input"
              >
                <option value="">Selecione</option>
                {filteredAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({accountTypeLabels[acc.type]})
                  </option>
                ))}
              </select>

              {/* Show message if no accounts match filter */}
              {filteredAccounts.length === 0 && accountTypeFilter !== 'all' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nenhuma conta do tipo {accountTypeLabels[accountTypeFilter]} cadastrada
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor *</label>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={formData.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          className="input text-2xl font-bold"
          placeholder="0,00"
        />
      </div>

      {/* Category - hidden for transfers */}
      {formData.type !== 'transfer' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
          <select
            value={formData.category_id}
            onChange={(e) => onChange({ category_id: e.target.value })}
            className="input"
          >
            <option value="">Selecione</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="input"
        />
      </div>

      {/* Installment section */}
      {showInstallmentSection && formData.type === 'expense' && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_installment}
                onChange={(e) => onChange({
                  is_installment: e.target.checked,
                  installment_current: e.target.checked ? (formData.installment_current || '1') : '',
                  installment_total: e.target.checked ? formData.installment_total : '',
                })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Compra parcelada</span>
            </label>
            {formData.is_installment && formData.installment_current && formData.installment_total && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full">
                {formData.installment_current}/{formData.installment_total}
              </span>
            )}
          </div>

          {formData.is_installment && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Parcela atual</label>
                <input
                  type="number"
                  min="1"
                  value={formData.installment_current}
                  onChange={(e) => onChange({ installment_current: e.target.value })}
                  className="input text-center"
                  placeholder="1"
                />
              </div>
              <div className="flex items-end pb-2 text-gray-400">de</div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Total de parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={formData.installment_total}
                  onChange={(e) => onChange({ installment_total: e.target.value })}
                  className="input text-center"
                  placeholder="12"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Description / Merchant */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {isManual ? 'Descrição' : 'Estabelecimento'}
        </label>
        <input
          type="text"
          value={isManual ? formData.description : formData.merchant_name}
          onChange={(e) => onChange({
            [isManual ? 'description' : 'merchant_name']: e.target.value,
          })}
          className="input"
          placeholder={isManual ? 'Descrição da transação' : 'Nome do estabelecimento'}
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
              onClick={() => onChange({ ownership_type: 'personal' })}
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
              onClick={() => onChange({ ownership_type: 'household' })}
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

      {/* Recurring section - only for manual mode and NOT installments */}
      {isManual && !formData.is_installment && (
        <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.create_recurring}
              onChange={(e) => onChange({ create_recurring: e.target.checked })}
              className="w-4 h-4 text-purple-600 rounded"
            />
            <Repeat size={18} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Criar como transação recorrente
            </span>
          </label>

          {formData.create_recurring && (
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Frequência</label>
              <select
                value={formData.recurring_frequency}
                onChange={(e) => onChange({ recurring_frequency: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}
                className="input"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                A recorrência será criada automaticamente na tela de Recorrências
              </p>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={
          !formData.amount ||
          !formData.account_id ||
          (formData.type === 'transfer' && !formData.destination_account_id) ||
          isPending
        }
        className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
      >
        {isPending ? 'Salvando...' : (
          <>
            <Check size={20} />
            {isManual ? (formData.type === 'transfer' ? 'Transferir' : 'Salvar') : 'Confirmar Item'}
          </>
        )}
      </button>
    </div>
  )
}
