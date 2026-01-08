import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../services/api'
import {
  Plus,
  Trash2,
  Edit2,
  Shield,
  ShieldOff,
  X,
  Mail,
  Send,
  Clock,
  Check,
  XCircle,
  KeyRound,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import api, { getApiErrorMessage } from '../../services/api'

interface User {
  id: number
  email: string
  name: string
  is_active: boolean
  is_admin: boolean
  license_id: number | null
  created_at: string
}

interface Invitation {
  id: number
  email: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  license_id: number | null
  license_code: string | null
  invited_by_name: string
  expires_at: string
  created_at: string
}

interface UserForm {
  email: string
  password: string
  name: string
  is_admin: boolean
  license_id: number | null
}

interface License {
  id: number
  code: string
  type: string
}

interface ConfirmAction {
  type: 'delete' | 'resetPassword' | 'cancelInvite'
  title: string
  message: string
  confirmText: string
  onConfirm: () => void
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

export default function AdminUsers() {
  const [showModal, setShowModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [form, setForm] = useState<UserForm>({
    email: '',
    password: '',
    name: '',
    is_admin: false,
    license_id: null,
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLicenseId, setInviteLicenseId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users')

  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
  })

  const { data: licenses } = useQuery({
    queryKey: ['admin-licenses'],
    queryFn: () => adminApi.listLicenses(),
  })

  const { data: invitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      const response = await api.get('/admin/invitations')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: UserForm) => adminApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserForm> }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; license_id: number | null }) => {
      const response = await api.post('/admin/invitations', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] })
      closeInviteModal()
    },
  })

  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/admin/invitations/${id}/resend`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] })
    },
  })

  const cancelInviteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/invitations/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.post(`/admin/users/${userId}/reset-password`)
      return response.data
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Email de redefinição de senha enviado!' })
      setTimeout(() => setFeedback(null), 4000)
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'error', message: getApiErrorMessage(error, 'Erro ao enviar email de redefinição') })
      setTimeout(() => setFeedback(null), 4000)
    },
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setForm({ email: '', password: '', name: '', is_admin: false, license_id: null })
  }

  const closeInviteModal = () => {
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteLicenseId(null)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setForm({
      email: user.email,
      password: '',
      name: user.name,
      is_admin: user.is_admin,
      license_id: user.license_id,
    })
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingUser) {
      const data: Partial<UserForm> = { ...form }
      if (!data.password) delete data.password
      updateMutation.mutate({ id: editingUser.id, data })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    inviteMutation.mutate({ email: inviteEmail, license_id: inviteLicenseId })
  }

  const handleDelete = (user: User) => {
    setConfirmAction({
      type: 'delete',
      title: 'Excluir usuário',
      message: `Tem certeza que deseja excluir ${user.name}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      onConfirm: () => {
        deleteMutation.mutate(user.id)
        setConfirmAction(null)
      },
    })
  }

  const handleResetPassword = (user: User) => {
    setConfirmAction({
      type: 'resetPassword',
      title: 'Resetar senha',
      message: `Enviar email de redefinição de senha para ${user.email}?`,
      confirmText: 'Enviar',
      onConfirm: () => {
        resetPasswordMutation.mutate(user.id)
        setConfirmAction(null)
      },
    })
  }

  const handleCancelInvite = (invite: Invitation) => {
    setConfirmAction({
      type: 'cancelInvite',
      title: 'Cancelar convite',
      message: `Cancelar o convite enviado para ${invite.email}?`,
      confirmText: 'Cancelar convite',
      onConfirm: () => {
        cancelInviteMutation.mutate(invite.id)
        setConfirmAction(null)
      },
    })
  }

  const toggleAdmin = (user: User) => {
    updateMutation.mutate({ id: user.id, data: { is_admin: !user.is_admin } })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
            <Clock size={12} /> Pendente
          </span>
        )
      case 'accepted':
        return (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full flex items-center gap-1">
            <Check size={12} /> Aceito
          </span>
        )
      case 'expired':
        return (
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
            <XCircle size={12} /> Expirado
          </span>
        )
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full flex items-center gap-1">
            <XCircle size={12} /> Cancelado
          </span>
        )
      default:
        return null
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuários</h1>
          <p className="text-gray-500 dark:text-gray-400">Gerencie os usuários e convites</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Mail size={20} />
            Convidar
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={clsx(
              'pb-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'users'
                ? 'border-biveto text-biveto dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            Usuários ({users?.data?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={clsx(
              'pb-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'invitations'
                ? 'border-biveto text-biveto dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            Convites ({invitations?.length || 0})
          </button>
        </nav>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Licença
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {users?.data?.map((user: User) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {user.name}
                        {user.is_admin && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={clsx(
                        'px-2 py-1 text-xs rounded-full',
                        user.is_active
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                      )}
                    >
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.license_id ? `#${user.license_id}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleAdmin(user)}
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          user.is_admin
                            ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        )}
                        title={user.is_admin ? 'Remover admin' : 'Tornar admin'}
                      >
                        {user.is_admin ? <Shield size={18} /> : <ShieldOff size={18} />}
                      </button>
                      <button
                        onClick={() => handleResetPassword(user)}
                        disabled={resetPasswordMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg"
                        title="Resetar senha"
                      >
                        <KeyRound size={18} />
                      </button>
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="card overflow-hidden">
          {isLoadingInvitations ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : invitations?.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Nenhum convite enviado ainda
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Licença
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Enviado por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Expira em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {invitations?.map((inv: Invitation) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {inv.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {inv.license_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {inv.invited_by_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(inv.expires_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {inv.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => resendMutation.mutate(inv.id)}
                            disabled={resendMutation.isPending}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                            title="Reenviar"
                          >
                            <Send size={18} />
                          </button>
                          <button
                            onClick={() => handleCancelInvite(inv)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                            title="Cancelar"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Senha {editingUser && '(deixe vazio para manter)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input"
                  required={!editingUser}
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Licença
                </label>
                <select
                  value={form.license_id || ''}
                  onChange={(e) =>
                    setForm({ ...form, license_id: e.target.value ? Number(e.target.value) : null })
                  }
                  className="input"
                >
                  <option value="">Sem licença</option>
                  {licenses?.data?.map((lic: License) => (
                    <option key={lic.id} value={lic.id}>
                      {lic.code} - {lic.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_admin"
                  checked={form.is_admin}
                  onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_admin" className="text-sm text-gray-700 dark:text-gray-300">
                  Administrador
                </label>
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Convidar Usuário</h2>
              <button onClick={closeInviteModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Um email será enviado com um link para criar a conta.
            </p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input"
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Licença (opcional)
                </label>
                <select
                  value={inviteLicenseId || ''}
                  onChange={(e) =>
                    setInviteLicenseId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="input"
                >
                  <option value="">Sem licença</option>
                  {licenses?.data?.map((lic: License) => (
                    <option key={lic.id} value={lic.id}>
                      {lic.code} - {lic.type}
                    </option>
                  ))}
                </select>
              </div>

              {inviteMutation.isError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {getApiErrorMessage(inviteMutation.error, 'Erro ao enviar convite')}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeInviteModal} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={inviteMutation.isPending}
                >
                  <Send size={18} />
                  {inviteMutation.isPending ? 'Enviando...' : 'Enviar Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-start gap-4">
              <div className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                confirmAction.type === 'delete' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-orange-100 dark:bg-orange-900/50'
              )}>
                {confirmAction.type === 'delete' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                ) : confirmAction.type === 'resetPassword' ? (
                  <KeyRound className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{confirmAction.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{confirmAction.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmAction(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium text-white transition-colors',
                  confirmAction.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-biveto hover:bg-biveto-dark'
                )}
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg',
            feedback.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          )}>
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
