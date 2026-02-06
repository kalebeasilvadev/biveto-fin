import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incomeSourcesApi, accountsApi } from '../services/api'
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  X,
  Building,
  CreditCard,
  Calendar,
  DollarSign,
  Gift,
  Users,
  User,
  PlayCircle,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '../components/EmptyState'
import { HelpButton } from '../components/help'

interface IncomeSource {
  id: number
  name: string
  type: string
  source_name: string | null
  expected_amount: number | null
  is_variable: boolean
  frequency: string
  payment_day: number | null
  use_business_day: boolean
  business_day_number: number | null
  benefit_provider: string | null
  account_name: string | null
  is_active: boolean
}

interface Account {
  id: number
  name: string
  type: string
}

const accountTypeLabels: Record<string, string> = {
  wallet: 'Carteira',
  bank: 'Banco',
  credit_card: 'Cartão',
  investment: 'Investimento',
}

const incomeTypes = [
  { value: 'salary', label: 'Salário', icon: Briefcase, color: 'text-green-600' },
  { value: 'freelance', label: 'Freelance', icon: Briefcase, color: 'text-blue-600' },
  { value: 'business', label: 'Empresa/MEI', icon: Building, color: 'text-purple-600' },
  { value: 'rental', label: 'Aluguel', icon: Building, color: 'text-orange-600' },
  { value: 'investment', label: 'Investimentos', icon: DollarSign, color: 'text-emerald-600' },
  { value: 'benefit_va', label: 'Vale Alimentação', icon: CreditCard, color: 'text-yellow-600' },
  { value: 'benefit_vr', label: 'Vale Refeição', icon: CreditCard, color: 'text-red-600' },
  { value: 'benefit_vt', label: 'Vale Transporte', icon: CreditCard, color: 'text-blue-500' },
  { value: 'benefit_health', label: 'Plano de Saúde', icon: CreditCard, color: 'text-pink-600' },
  { value: 'benefit_other', label: 'Outros Benefícios', icon: CreditCard, color: 'text-gray-600' },
  { value: 'bonus', label: 'Bônus/PLR', icon: Gift, color: 'text-indigo-600' },
  { value: 'thirteenth', label: '13º Salário', icon: Gift, color: 'text-green-500' },
  { value: 'vacation', label: 'Férias', icon: Calendar, color: 'text-cyan-600' },
  { value: 'pension', label: 'Aposentadoria', icon: Users, color: 'text-gray-500' },
  { value: 'other', label: 'Outros', icon: DollarSign, color: 'text-gray-600' },
]

const frequencies = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'yearly', label: 'Anual' },
  { value: 'one_time', label: 'Único' },
  { value: 'variable', label: 'Variável' },
]

const benefitProviders = [
  'Alelo',
  'Sodexo',
  'VR',
  'Flash',
  'Ticket',
  'Swile',
  'Caju',
  'iFood Benefícios',
  'Outro',
]

function getIncomeTypeInfo(type: string) {
  return incomeTypes.find(t => t.value === type) || incomeTypes[incomeTypes.length - 1]
}

interface TransactionPreview {
  source_id: number
  source_name: string
  type: string
  amount: number
  date: string
  is_business_day: boolean
  business_day_number: number | null
}

export default function IncomeSources() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear())
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1)
  const [previewData, setPreviewData] = useState<TransactionPreview[]>([])
  const [editedAmounts, setEditedAmounts] = useState<Record<number, number>>({})
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set())
  const [generateResult, setGenerateResult] = useState<{ count: number; message: string } | null>(null)
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'salary',
    source_name: '',
    expected_amount: '',
    is_variable: false,
    frequency: 'monthly',
    payment_day: '',
    use_business_day: false,
    business_day_number: '',
    account_id: '',
    benefit_provider: '',
    ownership_type: 'personal' as 'personal' | 'household',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['income-sources'],
    queryFn: incomeSourcesApi.list,
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const sources: IncomeSource[] = data?.data || []
  const accounts: Account[] = accountsData?.data || []
  // Filtrar para mostrar apenas banco e carteira como conta de destino
  const destinationAccounts = accounts.filter(
    (acc) => acc.type === 'bank' || acc.type === 'wallet'
  )

  // Função para invalidar caches relacionados a fontes de renda
  const invalidateIncomeSourceCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['income-sources'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: unknown) => incomeSourcesApi.create(data),
    onSuccess: () => {
      invalidateIncomeSourceCaches()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      incomeSourcesApi.update(id, data),
    onSuccess: () => {
      invalidateIncomeSourceCaches()
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => incomeSourcesApi.delete(id),
    onSuccess: () => {
      invalidateIncomeSourceCaches()
    },
  })

  const previewMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      incomeSourcesApi.previewTransactions(year, month),
    onSuccess: (response) => {
      const data = response.data || []
      setPreviewData(data)
      // Initialize edited amounts with original values
      const initialAmounts: Record<number, number> = {}
      const initialSelected = new Set<number>()
      data.forEach((item: TransactionPreview) => {
        initialAmounts[item.source_id] = item.amount
        initialSelected.add(item.source_id) // Selecionar todas por padrão
      })
      setEditedAmounts(initialAmounts)
      setSelectedSources(initialSelected)
      setGenerateResult(null)
    },
  })

  const generateMutation = useMutation({
    mutationFn: (data: {
      year: number
      month: number
      overwrite?: boolean
      source_ids?: number[]
      amount_overrides?: Array<{ source_id: number; amount: number }>
    }) => incomeSourcesApi.generateTransactions(data),
    onSuccess: (response) => {
      setGenerateResult(response.data)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  const openCreateModal = () => {
    setEditingSource(null)
    setFormData({
      name: '',
      type: 'salary',
      source_name: '',
      expected_amount: '',
      is_variable: false,
      frequency: 'monthly',
      payment_day: '',
      use_business_day: false,
      business_day_number: '',
      account_id: '',
      benefit_provider: '',
      ownership_type: 'personal',
    })
    setShowModal(true)
  }

  const openEditModal = (source: IncomeSource) => {
    setEditingSource(source)
    setFormData({
      name: source.name,
      type: source.type,
      source_name: source.source_name || '',
      expected_amount: source.expected_amount?.toString() || '',
      is_variable: source.is_variable,
      frequency: source.frequency,
      payment_day: source.payment_day?.toString() || '',
      use_business_day: source.use_business_day || false,
      business_day_number: source.business_day_number?.toString() || '',
      account_id: '',
      benefit_provider: source.benefit_provider || '',
      ownership_type: 'personal',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSource(null)
  }

  const handleSubmit = () => {
    const payload = {
      name: formData.name,
      type: formData.type,
      source_name: formData.source_name || null,
      expected_amount: formData.expected_amount ? parseFloat(formData.expected_amount) : null,
      is_variable: formData.is_variable,
      frequency: formData.frequency,
      payment_day: formData.use_business_day ? null : (formData.payment_day ? parseInt(formData.payment_day) : null),
      use_business_day: formData.use_business_day,
      business_day_number: formData.use_business_day && formData.business_day_number
        ? parseInt(formData.business_day_number)
        : null,
      account_id: formData.account_id ? parseInt(formData.account_id) : null,
      benefit_provider: formData.benefit_provider || null,
      ownership_type: formData.ownership_type,
    }

    if (editingSource) {
      updateMutation.mutate({ id: editingSource.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (source: IncomeSource) => {
    if (confirm(`Deseja excluir a fonte "${source.name}"?`)) {
      deleteMutation.mutate(source.id)
    }
  }

  const openGenerateModal = () => {
    setGenerateYear(new Date().getFullYear())
    setGenerateMonth(new Date().getMonth() + 1)
    setPreviewData([])
    setEditedAmounts({})
    setGenerateResult(null)
    setShowGenerateModal(true)
    // Auto-load preview
    previewMutation.mutate({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
  }

  const closeGenerateModal = () => {
    setShowGenerateModal(false)
    setPreviewData([])
    setEditedAmounts({})
    setSelectedSources(new Set())
    setGenerateResult(null)
  }

  const handlePreview = () => {
    previewMutation.mutate({ year: generateYear, month: generateMonth })
  }

  const handleGenerate = () => {
    // Filtrar apenas as fontes selecionadas
    const amount_overrides: Array<{ source_id: number; amount: number }> = []
    const source_ids_to_generate: number[] = []

    previewData.forEach((item) => {
      // Só processar se a fonte estiver selecionada
      if (!selectedSources.has(item.source_id)) return

      source_ids_to_generate.push(item.source_id)
      const editedAmount = editedAmounts[item.source_id]
      // Include amount override if edited
      if (editedAmount !== undefined && editedAmount !== item.amount) {
        amount_overrides.push({
          source_id: item.source_id,
          amount: editedAmount,
        })
      }
    })

    if (source_ids_to_generate.length === 0) {
      alert('Selecione pelo menos uma fonte de renda para gerar')
      return
    }

    generateMutation.mutate({
      year: generateYear,
      month: generateMonth,
      source_ids: source_ids_to_generate,
      amount_overrides: amount_overrides.length > 0 ? amount_overrides : undefined,
    })
  }

  const toggleSourceSelection = (sourceId: number) => {
    setSelectedSources((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId)
      } else {
        newSet.add(sourceId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedSources.size === previewData.length) {
      setSelectedSources(new Set())
    } else {
      setSelectedSources(new Set(previewData.map(item => item.source_id)))
    }
  }

  const handleAmountChange = (sourceId: number, value: string) => {
    const numValue = parseFloat(value) || 0
    setEditedAmounts((prev) => ({
      ...prev,
      [sourceId]: numValue,
    }))
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const totalMonthlyExpected = sources
    .filter(s => s.frequency === 'monthly' && s.expected_amount && !s.is_variable)
    .reduce((sum, s) => sum + (s.expected_amount || 0), 0)

  const isBenefitType = (type: string) => type.startsWith('benefit_')

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Receitas</h1>
            <HelpButton pageId="income-sources" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie suas fontes de renda</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {sources.length > 0 && (
            <button onClick={openGenerateModal} className="btn-secondary flex items-center gap-2 whitespace-nowrap">
              <PlayCircle size={18} />
              <span className="hidden sm:inline">Registrar</span>
            </button>
          )}
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={18} />
            <span className="hidden sm:inline">Nova Fonte</span>
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white">
        <p className="text-sm opacity-90">Receita Mensal Esperada</p>
        <p className="text-3xl font-bold mt-1">
          {totalMonthlyExpected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p className="text-sm opacity-75 mt-2">{sources.length} fonte(s) cadastradas</p>
      </div>

      {/* Sources Grid */}
      {sources.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhuma fonte cadastrada"
          description="Cadastre suas fontes de receita como salário, benefícios e freelances."
          actionLabel="Adicionar fonte"
          actionOnClick={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => {
            const typeInfo = getIncomeTypeInfo(source.type)
            const Icon = typeInfo.icon
            return (
              <div
                key={source.id}
                className="card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <Icon size={24} className={typeInfo.color} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{source.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {typeInfo.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(source)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(source)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {source.expected_amount && !source.is_variable && (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {source.expected_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  )}
                  {source.is_variable && (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Valor variável</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs">
                    {source.source_name && (
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                        {source.source_name}
                      </span>
                    )}
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                      {frequencies.find(f => f.value === source.frequency)?.label}
                    </span>
                    {source.use_business_day && source.business_day_number ? (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                        {source.business_day_number}º dia útil
                      </span>
                    ) : source.payment_day ? (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                        Dia {source.payment_day}
                      </span>
                    ) : null}
                    {source.benefit_provider && (
                      <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded">
                        {source.benefit_provider}
                      </span>
                    )}
                  </div>

                  {source.account_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Conta: {source.account_name}
                    </p>
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
                {editingSource ? 'Editar Fonte de Receita' : 'Nova Fonte de Receita'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Salário Empresa X"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input"
                >
                  {incomeTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fonte/Empresa
                </label>
                <input
                  type="text"
                  value={formData.source_name}
                  onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
                  className="input"
                  placeholder="Ex: Empresa ABC"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Esperado
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.expected_amount}
                    onChange={(e) => setFormData({ ...formData, expected_amount: e.target.value })}
                    className="input"
                    placeholder="5000.00"
                    disabled={formData.is_variable}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_variable}
                      onChange={(e) => setFormData({ ...formData, is_variable: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Valor variável</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Frequência
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="input"
                >
                  {frequencies.map((freq) => (
                    <option key={freq.value} value={freq.value}>{freq.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data do Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, use_business_day: false, business_day_number: '' })}
                    className={clsx(
                      'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all text-sm',
                      !formData.use_business_day
                        ? 'border-biveto bg-biveto-light dark:bg-biveto/20 text-biveto font-medium'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <Calendar size={18} />
                    Dia fixo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, use_business_day: true, payment_day: '' })}
                    className={clsx(
                      'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all text-sm',
                      formData.use_business_day
                        ? 'border-biveto bg-biveto-light dark:bg-biveto/20 text-biveto font-medium'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <Briefcase size={18} />
                    Dia útil
                  </button>
                </div>

                {!formData.use_business_day ? (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Dia do mês (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.payment_day}
                      onChange={(e) => setFormData({ ...formData, payment_day: e.target.value })}
                      className="input"
                      placeholder="5"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Qual dia útil do mês?
                    </label>
                    <select
                      value={formData.business_day_number}
                      onChange={(e) => setFormData({ ...formData, business_day_number: e.target.value })}
                      className="input"
                    >
                      <option value="">Selecione</option>
                      <option value="1">1º dia útil</option>
                      <option value="2">2º dia útil</option>
                      <option value="3">3º dia útil</option>
                      <option value="4">4º dia útil</option>
                      <option value="5">5º dia útil</option>
                      <option value="6">6º dia útil</option>
                      <option value="7">7º dia útil</option>
                      <option value="10">10º dia útil</option>
                      <option value="15">15º dia útil</option>
                      <option value="20">20º dia útil</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Considera feriados nacionais brasileiros
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Conta de Destino
                </label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="input"
                >
                  <option value="">Selecione uma conta</option>
                  {destinationAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({accountTypeLabels[account.type] || account.type})
                    </option>
                  ))}
                </select>
              </div>

              {isBenefitType(formData.type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Operadora do Benefício
                  </label>
                  <select
                    value={formData.benefit_provider}
                    onChange={(e) => setFormData({ ...formData, benefit_provider: e.target.value })}
                    className="input"
                  >
                    <option value="">Selecione</option>
                    {benefitProviders.map((provider) => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ownership selector */}
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
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
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
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    )}
                  >
                    <Users size={20} className={formData.ownership_type === 'household' ? 'text-biveto' : 'text-gray-400'} />
                    <span className={clsx('text-sm font-medium', formData.ownership_type === 'household' ? 'text-biveto' : 'text-gray-600 dark:text-gray-400')}>
                      Família
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button onClick={closeModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Income Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Registrar Receitas do Mês
              </h2>
              <button onClick={closeGenerateModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Month/Year Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mês
                  </label>
                  <select
                    value={generateMonth}
                    onChange={(e) => {
                      setGenerateMonth(parseInt(e.target.value))
                      setPreviewData([])
                      setGenerateResult(null)
                    }}
                    className="input"
                  >
                    {monthNames.map((name, index) => (
                      <option key={index} value={index + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ano
                  </label>
                  <select
                    value={generateYear}
                    onChange={(e) => {
                      setGenerateYear(parseInt(e.target.value))
                      setPreviewData([])
                      setGenerateResult(null)
                    }}
                    className="input"
                  >
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handlePreview}
                disabled={previewMutation.isPending}
                className="btn-secondary w-full"
              >
                {previewMutation.isPending ? 'Carregando...' : 'Ver Prévia'}
              </button>

              {/* Preview List */}
              {previewData.length > 0 && !generateResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Transações a serem criadas:
                    </h3>
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-biveto hover:text-biveto-dark dark:hover:text-biveto-light font-medium"
                    >
                      {selectedSources.size === previewData.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {previewData.map((item, index) => {
                      const typeInfo = getIncomeTypeInfo(item.type)
                      const currentAmount = editedAmounts[item.source_id] ?? item.amount
                      const isEdited = editedAmounts[item.source_id] !== undefined && editedAmounts[item.source_id] !== item.amount
                      const isSelected = selectedSources.has(item.source_id)
                      return (
                        <div
                          key={index}
                          className={clsx(
                            'flex items-center gap-3 p-3 rounded-lg transition-all',
                            !isSelected && 'opacity-50',
                            isEdited && isSelected
                              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                              : 'bg-gray-50 dark:bg-gray-700'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSourceSelection(item.source_id)}
                            className="w-5 h-5 rounded border-gray-300 text-biveto focus:ring-biveto"
                          />
                          <div className="flex items-center gap-3 flex-1">
                            <div className={clsx('p-2 rounded-full bg-white dark:bg-gray-600', typeInfo.color)}>
                              <DollarSign size={16} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {item.source_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {item.is_business_day && item.business_day_number && (
                                  <span className="ml-1 text-green-600">({item.business_day_number}º DU)</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={currentAmount}
                              onChange={(e) => handleAmountChange(item.source_id, e.target.value)}
                              disabled={!isSelected}
                              className={clsx(
                                'w-28 text-right font-bold px-2 py-1 rounded border text-sm',
                                !isSelected && 'opacity-50 cursor-not-allowed',
                                isEdited && isSelected
                                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600 text-green-600 dark:text-green-400'
                              )}
                            />
                            {isEdited && isSelected && (
                              <button
                                onClick={() => handleAmountChange(item.source_id, String(item.amount))}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                title="Restaurar valor original"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                    <span className="font-medium text-green-700 dark:text-green-400">
                      Total ({selectedSources.size} de {previewData.length})
                    </span>
                    <span className="font-bold text-green-700 dark:text-green-400">
                      {previewData
                        .filter(item => selectedSources.has(item.source_id))
                        .reduce((sum, item) => sum + (editedAmounts[item.source_id] ?? item.amount), 0)
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  {previewData.some((item) => editedAmounts[item.source_id] !== undefined && editedAmounts[item.source_id] !== item.amount) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Pencil size={12} />
                      Valores alterados serão usados no registro
                    </p>
                  )}
                </div>
              )}

              {previewData.length === 0 && !previewMutation.isPending && !generateResult && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <AlertCircle size={40} className="mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma fonte de receita mensal encontrada</p>
                  <p className="text-xs">ou transações já foram registradas para este mês</p>
                </div>
              )}

              {/* Success Message */}
              {generateResult && (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle size={48} className="text-green-500 mb-3" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {generateResult.count} transação(ões) criada(s)!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {monthNames[generateMonth - 1]} de {generateYear}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button onClick={closeGenerateModal} className="btn-secondary flex-1">
                  {generateResult ? 'Fechar' : 'Cancelar'}
                </button>
                {!generateResult && previewData.length > 0 && (
                  <button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {generateMutation.isPending ? (
                      'Registrando...'
                    ) : (
                      <>
                        <CheckCircle size={18} />
                        Confirmar Registro
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
