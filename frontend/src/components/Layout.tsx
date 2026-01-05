import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Lightbulb,
  LogOut,
  Menu,
  X,
  Wallet,
  Target,
  CreditCard,
  Bot,
  Settings,
  Building,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import api from '../services/api'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: Receipt, label: 'Transações' },
  { to: '/accounts', icon: Building, label: 'Contas' },
  { to: '/budget', icon: Wallet, label: 'Orçamento' },
  { to: '/goals', icon: Target, label: 'Metas' },
  { to: '/debts', icon: CreditCard, label: 'Dívidas' },
  { to: '/upload', icon: Upload, label: 'Adicionar' },
  { to: '/insights', icon: Lightbulb, label: 'Insights' },
  { to: '/chat', icon: Bot, label: 'Assistente IA' },
]

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const navigate = useNavigate()

  // Fetch user info on mount to get is_admin
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me')
        setUser(response.data)
      } catch {
        // Ignore errors
      }
    }
    if (!user?.is_admin) {
      fetchUser()
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary-600">Financeiro</h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={clsx(
            'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform lg:transform-none',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="p-6 hidden lg:block">
            <h1 className="text-xl font-bold text-primary-600">Financeiro</h1>
          </div>

          <nav className="px-4 py-6 lg:py-0 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}

            {/* Admin Menu */}
            {user?.is_admin && (
              <>
                <div className="border-t my-2" />
                <NavLink
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )
                  }
                >
                  <Settings size={20} />
                  Admin
                </NavLink>
              </>
            )}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 truncate">
                {user?.name || 'Usuário'}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
