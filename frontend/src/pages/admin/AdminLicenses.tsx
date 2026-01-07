import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../services/api'
import { Plus, Trash2, Edit2, Copy, X, Check, AlertCircle, Mail, UserMinus } from 'lucide-react'
import { clsx } from 'clsx'

interface ExistingUserInfo {
  email: string
  current_license_id: number
  current_license_code: string
  current_license_owner_email: string
  user_id: number
  user_name: string | null
}

interface HouseholdMember {
  id: number
  user_id: number
  user_name: string | null
  user_email: string | null
  role: string
  joined_at: string
}

interface License {
  id: number
  key: string
  code: string
  type: string
  status: string
  max_users: number
  has_ai_assistant: boolean
  has_insights: boolean
  has_debt_strategies: boolean
  has_goals: boolean
  has_budget: boolean
  start_date: string
  end_date: string | null
  notes: string | null
  is_valid: boolean
  days_remaining: number | null
  user_count: number
  owner_email: string | null
  owner_user_id: number | null
  owner_name: string | null
  member_count: number
  members: HouseholdMember[]
  created_at: string
}

interface LicenseForm {
  type: string
  max_users: number
  owner_email: string
  has_ai_assistant: boolean
  has_insights: boolean
  has_debt_strategies: boolean
  has_goals: boolean
  has_budget: boolean
  end_date: string | null
  notes: string
}

export default function AdminLicenses() {
  const [showModal, setShowModal] = useState(false)
  const [editingLicense, setEditingLicense] = useState<License | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [existingUserInfo, setExistingUserInfo] = useState<ExistingUserInfo | null>(null)
  const [showExistingUserModal, setShowExistingUserModal] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<LicenseForm | null>(null)
  const [form, setForm] = useState<LicenseForm>({
    type: 'basic',
    max_users: 1,
    owner_email: '',
    has_ai_assistant: true,
    has_insights: true,
    has_debt_strategies: true,
    has_goals: true,
    has_budget: true,
    end_date: '',
    notes: '',
  })

  const queryClient = useQueryClient()

  const { data: licenses, isLoading } = useQuery({
    queryKey: ['admin-licenses'],
    queryFn: () => adminApi.listLicenses(),
  })

  const createMutation = useMutation({
    mutationFn: (data: LicenseForm & { force_transfer?: boolean }) => adminApi.createLicense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] })
      closeModal()
      setShowExistingUserModal(false)
      setExistingUserInfo(null)
      setPendingFormData(null)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: { message?: string; existing_user?: ExistingUserInfo } | string } } }
      // Check if it's an existing user error with transfer option
      // Backend returns: { detail: { message: "...", existing_user: {...} } }
      console.log('Create license error:', error.response?.data)
      const detail = error.response?.data?.detail
      console.log('Detail:', detail, 'Type:', typeof detail)
      if (typeof detail === 'object' && detail !== null && 'existing_user' in detail) {
        console.log('Showing existing user modal')
        setExistingUserInfo((detail as { existing_user: ExistingUserInfo }).existing_user)
        setPendingFormData(form)
        setShowExistingUserModal(true)
        setShowModal(false)
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LicenseForm> & { status?: string } }) =>
      adminApi.updateLicense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteLicense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-licenses'] })
    },
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingLicense(null)
    setForm({
      type: 'basic',
      max_users: 1,
      owner_email: '',
      has_ai_assistant: true,
      has_insights: true,
      has_debt_strategies: true,
      has_goals: true,
      has_budget: true,
      end_date: '',
      notes: '',
    })
  }

  const openEditModal = (license: License) => {
    setEditingLicense(license)
    setForm({
      type: license.type,
      max_users: license.max_users,
      owner_email: license.owner_email || '',
      has_ai_assistant: license.has_ai_assistant,
      has_insights: license.has_insights,
      has_debt_strategies: license.has_debt_strategies,
      has_goals: license.has_goals,
      has_budget: license.has_budget,
      end_date: license.end_date || '',
      notes: license.notes || '',
    })
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...form,
      end_date: form.end_date || null,
    }
    if (editingLicense) {
      updateMutation.mutate({ id: editingLicense.id, data })
    } else {
      createMutation.mutate(data as LicenseForm)
    }
  }

  const handleDelete = (license: License) => {
    if (license.user_count > 0) {
      alert(`Não é possível excluir. ${license.user_count} usuário(s) vinculado(s).`)
      return
    }
    if (confirm('Tem certeza que deseja excluir esta licença?')) {
      deleteMutation.mutate(license.id)
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const toggleStatus = (license: License) => {
    const newStatus = license.status === 'active' ? 'suspended' : 'active'
    updateMutation.mutate({ id: license.id, data: { status: newStatus } })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licenças</h1>
          <p className="text-gray-500">Gerencie as licenças do sistema</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Nova Licença
        </button>
      </div>

      <div className="grid gap-4">
        {licenses?.data?.map((license: License) => (
          <div key={license.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-full uppercase',
                      license.type === 'premium'
                        ? 'bg-purple-100 text-purple-800'
                        : license.type === 'lifetime'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {license.type}
                  </span>
                  <span
                    className={clsx(
                      'px-2 py-1 text-xs rounded-full',
                      license.is_valid
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    )}
                  >
                    {license.status}
                  </span>
                  {license.days_remaining !== null && license.days_remaining <= 30 && (
                    <span className="flex items-center gap-1 text-xs text-orange-600">
                      <AlertCircle size={14} />
                      {license.days_remaining} dias restantes
                    </span>
                  )}
                </div>

                {/* Owner email as primary identifier */}
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={16} className="text-gray-400" />
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {license.owner_email || 'Sem proprietário'}
                  </span>
                  {license.owner_name && (
                    <span className="text-sm text-gray-500">({license.owner_name})</span>
                  )}
                  {!license.owner_name && license.owner_email && (
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                      pendente
                    </span>
                  )}
                </div>

                {/* License code - secondary info */}
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded font-mono text-gray-600 dark:text-gray-300">
                    {license.code}
                  </code>
                  <button
                    onClick={() => copyKey(license.code)}
                    className="p-1 text-gray-400 hover:text-primary-600"
                    title="Copiar código"
                  >
                    {copiedKey === license.code ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                  {license.member_count > 0 && (
                    <span className="text-xs text-gray-500">
                      • {license.member_count} membro{license.member_count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Usuários:</span>{' '}
                    <span className="font-medium">
                      {license.user_count}/{license.max_users}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Início:</span>{' '}
                    <span className="font-medium">
                      {new Date(license.start_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Término:</span>{' '}
                    <span className="font-medium">
                      {license.end_date
                        ? new Date(license.end_date).toLocaleDateString('pt-BR')
                        : 'Sem limite'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Criada em:</span>{' '}
                    <span className="font-medium">
                      {new Date(license.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {license.has_ai_assistant && (
                    <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                      IA
                    </span>
                  )}
                  {license.has_insights && (
                    <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                      Insights
                    </span>
                  )}
                  {license.has_debt_strategies && (
                    <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                      Dívidas
                    </span>
                  )}
                  {license.has_goals && (
                    <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                      Metas
                    </span>
                  )}
                  {license.has_budget && (
                    <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                      Orçamento
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(license)}
                  className={clsx(
                    'px-3 py-1 text-sm rounded-lg transition-colors',
                    license.status === 'active'
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  )}
                >
                  {license.status === 'active' ? 'Suspender' : 'Ativar'}
                </button>
                <button
                  onClick={() => openEditModal(license)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(license)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg"
                  disabled={license.user_count > 0}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {licenses?.data?.length === 0 && (
          <div className="card text-center py-12 text-gray-500">
            Nenhuma licença cadastrada
          </div>
        )}
      </div>

      {/* Existing User Transfer Modal */}
      {showExistingUserModal && existingUserInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                <AlertCircle size={24} className="text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Usuário já cadastrado
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  O email informado já está vinculado a uma licença
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Email:</span>
                <span className="font-medium text-gray-900 dark:text-white">{existingUserInfo.email}</span>
              </div>
              {existingUserInfo.user_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Nome:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{existingUserInfo.user_name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Licença atual:</span>
                <span className="font-mono text-gray-900 dark:text-white">{existingUserInfo.current_license_code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Proprietário atual:</span>
                <span className="text-gray-900 dark:text-white">{existingUserInfo.current_license_owner_email}</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Deseja remover este usuário da licença atual e criar uma nova licença onde ele será o proprietário?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowExistingUserModal(false)
                  setExistingUserInfo(null)
                  setPendingFormData(null)
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (pendingFormData) {
                    createMutation.mutate({ ...pendingFormData, force_transfer: true })
                  }
                }}
                className="btn-primary flex items-center gap-2"
                disabled={createMutation.isPending}
              >
                <UserMinus size={18} />
                {createMutation.isPending ? 'Transferindo...' : 'Confirmar Transferência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingLicense ? 'Editar Licença' : 'Nova Licença'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo owner_email - apenas na criacao */}
              {!editingLicense && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email do Proprietario *
                  </label>
                  <input
                    type="email"
                    value={form.owner_email}
                    onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                    className="input"
                    required
                    placeholder="email@exemplo.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Um convite sera enviado automaticamente para este email
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="input"
                  >
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max. Usuarios
                  </label>
                  <input
                    type="number"
                    value={form.max_users}
                    onChange={(e) => setForm({ ...form, max_users: Number(e.target.value) })}
                    className="input"
                    min={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Termino (opcional)
                </label>
                <input
                  type="date"
                  value={form.end_date || ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value || null })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recursos
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'has_ai_assistant', label: 'Assistente IA' },
                    { key: 'has_insights', label: 'Insights' },
                    { key: 'has_debt_strategies', label: 'Estratégias de Dívidas' },
                    { key: 'has_goals', label: 'Metas' },
                    { key: 'has_budget', label: 'Orçamento' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form[item.key as keyof LicenseForm] as boolean}
                        onChange={(e) =>
                          setForm({ ...form, [item.key]: e.target.checked })
                        }
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
