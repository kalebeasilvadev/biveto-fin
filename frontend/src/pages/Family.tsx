import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { familyApi } from '../services/api'
import {
  Users,
  UserPlus,
  Mail,
  X,
  Check,
  AlertCircle,
  Clock,
  Crown,
  Shield,
  User,
  Send,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { clsx } from 'clsx'

interface HouseholdMember {
  id: number
  license_id: number
  user_id: number
  user_name: string | null
  user_email: string | null
  role: string
  nickname: string | null
  joined_at: string
  can_create_transactions: boolean
  can_edit_shared: boolean
  can_invite_members: boolean
  can_see_all: boolean
}

interface FamilyContext {
  license_id: number
  license_type: string
  is_owner: boolean
  can_invite: boolean
  member_count: number
  max_members: number
  members: HouseholdMember[]
}

interface Invitation {
  id: number
  email: string
  status: string
  created_at: string
  expires_at: string
}

export default function Family() {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNickname, setInviteNickname] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const queryClient = useQueryClient()

  const { data: familyContext, isLoading: loadingContext, error: contextError } = useQuery({
    queryKey: ['family-context'],
    queryFn: async () => {
      const response = await familyApi.getContext()
      return response.data as FamilyContext
    },
  })

  const { data: invitations, isLoading: loadingInvitations } = useQuery({
    queryKey: ['family-invitations'],
    queryFn: async () => {
      const response = await familyApi.listInvitations()
      return response.data as Invitation[]
    },
    enabled: !!familyContext?.can_invite,
  })

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; nickname?: string }) =>
      familyApi.invite(data.email, data.nickname || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['family-context'] })
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteNickname('')
      setSuccess('Convite enviado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Erro ao enviar convite')
    },
  })

  const cancelInviteMutation = useMutation({
    mutationFn: (id: number) => familyApi.cancelInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-invitations'] })
      setSuccess('Convite cancelado')
      setTimeout(() => setSuccess(''), 3000)
    },
  })

  const resendInviteMutation = useMutation({
    mutationFn: (id: number) => familyApi.resendInvitation(id),
    onSuccess: () => {
      setSuccess('Convite reenviado!')
      setTimeout(() => setSuccess(''), 3000)
    },
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    inviteMutation.mutate({
      email: inviteEmail,
      nickname: inviteNickname || undefined,
    })
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown size={16} className="text-yellow-500" />
      case 'admin':
        return <Shield size={16} className="text-blue-500" />
      default:
        return <User size={16} className="text-gray-400" />
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Proprietario'
      case 'admin':
        return 'Administrador'
      default:
        return 'Membro'
    }
  }

  if (loadingContext) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
      </div>
    )
  }

  // Usuario sem licenca
  if (contextError || !familyContext) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Sem Plano Familiar
          </h2>
          <p className="text-gray-500">
            Voce ainda nao possui uma licenca vinculada.
            <br />
            Entre em contato com o administrador.
          </p>
        </div>
      </div>
    )
  }

  const canAddMore = familyContext.member_count < familyContext.max_members

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Familia</h1>
        <p className="text-gray-500">Gerencie os membros do seu plano familiar</p>
      </div>

      {/* Success/Error alerts */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Plan Info Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Seu Plano</h2>
          <span
            className={clsx(
              'px-3 py-1 text-sm font-medium rounded-full uppercase',
              familyContext.license_type === 'premium'
                ? 'bg-purple-100 text-purple-800'
                : familyContext.license_type === 'lifetime'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            )}
          >
            {familyContext.license_type}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Membros</p>
            <p className="text-2xl font-bold text-gray-900">
              {familyContext.member_count}
              <span className="text-base font-normal text-gray-400">
                /{familyContext.max_members}
              </span>
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Seu Papel</p>
            <div className="flex items-center gap-2 mt-1">
              {getRoleIcon(familyContext.is_owner ? 'owner' : 'member')}
              <span className="text-lg font-semibold text-gray-900">
                {familyContext.is_owner ? 'Proprietario' : 'Membro'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Members Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users size={20} />
            Membros
          </h2>
          {familyContext.can_invite && canAddMore && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus size={18} />
              Convidar
            </button>
          )}
        </div>

        {!canAddMore && familyContext.can_invite && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-orange-50 text-orange-700 rounded-lg">
            <AlertCircle size={18} />
            <span>Limite de membros atingido</span>
          </div>
        )}

        <div className="space-y-3">
          {familyContext.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-biveto-light flex items-center justify-center text-biveto font-semibold">
                  {member.user_name?.charAt(0).toUpperCase() || member.user_email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {member.nickname || member.user_name || member.user_email}
                    </span>
                    {getRoleIcon(member.role)}
                  </div>
                  <p className="text-sm text-gray-500">{member.user_email}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                  {getRoleLabel(member.role)}
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  Desde {new Date(member.joined_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {familyContext.can_invite && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Mail size={20} />
            Convites Pendentes
          </h2>

          {loadingInvitations ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-biveto"></div>
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-orange-500" />
                    <div>
                      <p className="font-medium text-gray-900">{inv.email}</p>
                      <p className="text-sm text-gray-500">
                        Expira em{' '}
                        {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resendInviteMutation.mutate(inv.id)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      disabled={resendInviteMutation.isPending}
                      title="Reenviar"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => cancelInviteMutation.mutate(inv.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      disabled={cancelInviteMutation.isPending}
                      title="Cancelar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">
              Nenhum convite pendente
            </p>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Convidar Membro</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setError('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 text-red-700 rounded-lg">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apelido (opcional)
                </label>
                <input
                  type="text"
                  value={inviteNickname}
                  onChange={(e) => setInviteNickname(e.target.value)}
                  className="input"
                  placeholder="Ex: Esposa, Filho, etc."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false)
                    setError('')
                  }}
                  className="btn-secondary"
                >
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
    </div>
  )
}
