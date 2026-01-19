import { Settings, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface User {
  name?: string
  email?: string
}

interface UserCardProps {
  user: User | null
  onLogout: () => void
  onClose?: () => void
}

export default function UserCard({ user, onLogout, onClose }: UserCardProps) {
  const navigate = useNavigate()

  const handleSettingsClick = () => {
    onClose?.()
    navigate('/settings')
  }

  const handleLogoutClick = () => {
    const confirmed = window.confirm('Deseja realmente sair da sua conta?')
    if (confirmed) {
      onLogout()
    }
  }

  const handleCardClick = () => {
    onClose?.()
    navigate('/settings')
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 transition-colors">
      {/* Avatar - clickable to go to settings */}
      <button
        onClick={handleCardClick}
        className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-biveto rounded-full"
        aria-label="Ir para configurações"
      >
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-biveto-navy to-biveto-green flex items-center justify-center text-white font-semibold text-base shadow-md">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      </button>

      {/* User info - clickable to go to settings */}
      <button
        onClick={handleCardClick}
        className="flex-1 min-w-0 text-left focus:outline-none"
        aria-label="Ir para configurações"
      >
        <p className="font-semibold text-gray-900 dark:text-white truncate">
          {user?.name || 'Usuário'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {user?.email || ''}
        </p>
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSettingsClick}
          className="p-2.5 text-gray-500 hover:text-biveto hover:bg-gray-100 dark:hover:bg-slate-600 rounded-xl transition-all"
          title="Configurações"
          aria-label="Configurações"
        >
          <Settings size={20} />
        </button>
        <button
          onClick={handleLogoutClick}
          className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
          title="Sair"
          aria-label="Sair da conta"
        >
          <LogOut size={20} />
        </button>
      </div>
    </div>
  )
}
