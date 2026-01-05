import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../services/api'
import { Plus, Trash2, Edit2, Shield, ShieldOff, X } from 'lucide-react'
import { clsx } from 'clsx'

interface User {
  id: number
  email: string
  name: string
  is_active: boolean
  is_admin: boolean
  license_id: number | null
  created_at: string
}

interface UserForm {
  email: string
  password: string
  name: string
  is_admin: boolean
  license_id: number | null
}

export default function AdminUsers() {
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>({
    email: '',
    password: '',
    name: '',
    is_admin: false,
    license_id: null,
  })

  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
  })

  const { data: licenses } = useQuery({
    queryKey: ['admin-licenses'],
    queryFn: () => adminApi.listLicenses(),
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

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setForm({ email: '', password: '', name: '', is_admin: false, license_id: null })
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

  const handleDelete = (user: User) => {
    if (confirm(`Tem certeza que deseja excluir ${user.name}?`)) {
      deleteMutation.mutate(user.id)
    }
  }

  const toggleAdmin = (user: User) => {
    updateMutation.mutate({ id: user.id, data: { is_admin: !user.is_admin } })
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
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500">Gerencie os usuários do sistema</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Licença
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Criado em
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users?.data?.map((user: User) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {user.name}
                      {user.is_admin && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={clsx(
                      'px-2 py-1 text-xs rounded-full',
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    )}
                  >
                    {user.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.license_id ? `#${user.license_id}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => toggleAdmin(user)}
                      className={clsx(
                        'p-1.5 rounded-lg transition-colors',
                        user.is_admin
                          ? 'text-blue-600 hover:bg-blue-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      )}
                      title={user.is_admin ? 'Remover admin' : 'Tornar admin'}
                    >
                      {user.is_admin ? <Shield size={18} /> : <ShieldOff size={18} />}
                    </button>
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg"
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha {editingUser && '(deixe vazio para manter)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input"
                  required={!editingUser}
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  {licenses?.data?.map((lic: { id: number; key: string; type: string }) => (
                    <option key={lic.id} value={lic.id}>
                      #{lic.id} - {lic.type}
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
                <label htmlFor="is_admin" className="text-sm text-gray-700">
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
    </div>
  )
}
