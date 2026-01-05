import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../services/api'
import { Users, Key, Shield, Activity } from 'lucide-react'

export default function AdminDashboard() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.dashboard(),
  })

  const stats = dashboard?.data

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel Admin</h1>
        <p className="text-gray-500">Gestão de usuários e licenças</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Usuários</p>
              <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
            </div>
            <Users className="text-primary-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Usuários Ativos</p>
              <p className="text-2xl font-bold">{stats?.active_users || 0}</p>
            </div>
            <Activity className="text-green-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Administradores</p>
              <p className="text-2xl font-bold">{stats?.admin_users || 0}</p>
            </div>
            <Shield className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Licenças Ativas</p>
              <p className="text-2xl font-bold">{stats?.active_licenses || 0}</p>
            </div>
            <Key className="text-yellow-500" size={32} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Licenças</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span className="font-medium">{stats?.total_licenses || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ativas</span>
              <span className="font-medium text-green-600">{stats?.active_licenses || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Expiradas</span>
              <span className="font-medium text-red-600">{stats?.expired_licenses || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
          <div className="space-y-2">
            <a href="/admin/users" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              Gerenciar Usuários
            </a>
            <a href="/admin/licenses" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              Gerenciar Licenças
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
