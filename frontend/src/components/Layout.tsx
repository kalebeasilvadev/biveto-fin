import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { useQuickTransactionStore } from '../stores/quickTransactionStore'
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
  Repeat,
  Bot,
  Settings,
  Building,
  Plus,
  ChevronRight,
  Moon,
  Sun,
  Briefcase,
  BadgeDollarSign,
  FileText,
  Download,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import api from '../services/api'
import FloatingAssistant from './FloatingAssistant'
import QuickTransactionModal from './QuickTransactionModal'
import ToastContainer from './shared/ToastContainer'
import InstallPromptBanner from './InstallPromptBanner'
import IOSInstallModal from './IOSInstallModal'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { NotificationBell } from './notifications'

// Main navigation items
const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: Receipt, label: 'Transações' },
  { to: '/accounts', icon: Building, label: 'Contas' },
  { to: '/credit-cards', icon: CreditCard, label: 'Cartões' },
  { to: '/invoices', icon: FileText, label: 'Faturas' },
  { to: '/income-sources', icon: Briefcase, label: 'Receitas' },
  { to: '/budget', icon: Wallet, label: 'Orçamento' },
  { to: '/goals', icon: Target, label: 'Metas' },
  { to: '/debts', icon: BadgeDollarSign, label: 'Dívidas' },
  { to: '/recurring', icon: Repeat, label: 'Recorrentes' },
  { to: '/upload', icon: Upload, label: 'Adicionar' },
  { to: '/insights', icon: Lightbulb, label: 'Insights' },
  { to: '/chat', icon: Bot, label: 'Assistente' },
]

// Bottom navigation items (mobile) - most important screens
const bottomNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/transactions', icon: Receipt, label: 'Transações' },
  { to: '/upload', icon: Plus, label: 'Adicionar', primary: true },
  { to: '/insights', icon: Lightbulb, label: 'Insights' },
  { to: '/chat', icon: Bot, label: 'Chat' },
]

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const { isOpen: showQuickTransaction, open: openQuickTransaction, close: closeQuickTransaction } = useQuickTransactionStore()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const { theme, toggleTheme } = useThemeStore()
  const { canInstall, isIOS, promptInstall } = usePWAInstall()
  const navigate = useNavigate()
  const location = useLocation()

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const hasValidSession = useAuthStore((state) => state.hasValidSession)

  // Fetch user info on mount to get is_admin (only if session is valid)
  useEffect(() => {
    const fetchUser = async () => {
      // Verifica se a sessão é válida antes de fazer requisição
      if (!hasValidSession()) {
        return
      }

      try {
        const response = await api.get('/users/me')
        setUser(response.data)
      } catch {
        // Erros são tratados pelo interceptor do Axios
        // Não precisa fazer nada aqui
      }
    }

    // Só busca se não tiver is_admin carregado e sessão for válida
    if (!user?.is_admin && hasValidSession()) {
      fetchUser()
    }
  }, [user?.is_admin, hasValidSession, setUser])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 glass border-b border-gray-200/50 dark:bg-slate-900/80 dark:border-slate-700 mobile-header">
        <div className="flex items-center justify-between px-4 h-14">
          <img src={isDark ? "/logo-white.svg" : "/logo.svg"} alt="Biveto" className="h-8" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn-icon"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-100 dark:bg-slate-800 dark:border-slate-700" role="complementary" aria-label="Menu lateral">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-100 dark:border-slate-700">
            <img src={isDark ? "/logo-white.svg" : "/logo.svg"} alt="Biveto" className="h-9" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Navegação principal">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200',
                    isActive
                      ? 'bg-biveto-light text-biveto shadow-sm dark:bg-biveto/20 dark:text-biveto'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white'
                  )
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Admin Menu */}
            {user?.is_admin && (
              <>
                <div className="border-t border-gray-100 dark:border-slate-700 my-3" />
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200',
                      isActive
                        ? 'bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white'
                    )
                  }
                >
                  <Settings size={20} />
                  <span>Admin</span>
                </NavLink>
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <div className="avatar avatar-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || ''}
                </p>
              </div>
              <NotificationBell />
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-400 hover:text-biveto hover:bg-biveto-light rounded-lg transition-colors dark:hover:bg-slate-700"
                title={isDark ? 'Modo claro' : 'Modo escuro'}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <NavLink
                to="/settings"
                className="p-2 text-gray-400 hover:text-biveto hover:bg-biveto-light rounded-lg transition-colors dark:hover:bg-slate-700"
                title="Configurações"
              >
                <Settings size={18} />
              </NavLink>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/30"
                title="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-800 shadow-xl transform transition-transform duration-300 ease-out lg:hidden flex flex-col',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          role="dialog"
          aria-label="Menu de navegação"
          aria-modal="true"
          aria-hidden={!mobileMenuOpen}
        >
          {/* Header with safe area */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100 dark:border-slate-700 mobile-header">
            <img src={isDark ? "/logo-white.svg" : "/logo.svg"} alt="Biveto" className="h-8" />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="btn-icon"
              aria-label="Fechar menu"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="avatar">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || ''}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation - scrollable area */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0" role="navigation" aria-label="Navegação do menu">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all duration-200',
                    isActive
                      ? 'bg-biveto-light text-biveto dark:bg-biveto/20'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
              </NavLink>
            ))}

            {/* Admin Menu */}
            {user?.is_admin && (
              <>
                <div className="border-t border-gray-100 dark:border-slate-700 my-3" />
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all duration-200',
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white'
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <Settings size={20} />
                    <span>Admin</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
                </NavLink>
              </>
            )}
          </nav>

          {/* Settings & Logout - with extra padding for bottom nav + safe area */}
          <div className="p-4 border-t border-gray-100 dark:border-slate-700 space-y-2 pb-safe" style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 5rem))' }}>
            {/* Install App Option */}
            {canInstall && (
              <button
                onClick={() => {
                  if (isIOS) {
                    setShowIOSInstallModal(true)
                  } else {
                    promptInstall()
                  }
                  setMobileMenuOpen(false)
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white gradient-biveto rounded-xl font-medium transition-all active:scale-[0.98]"
              >
                <Download size={20} />
                <span>Instalar App</span>
              </button>
            )}
            <NavLink
              to="/settings"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-700 bg-gray-50 hover:bg-gray-100 dark:text-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl font-medium transition-colors"
            >
              <Settings size={20} />
              <span>Configurações</span>
            </NavLink>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-xl font-medium transition-colors"
            >
              <LogOut size={20} />
              <span>Sair da conta</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-64 overflow-x-hidden" role="main" aria-label="Conteúdo principal">
          {/* Spacer for mobile header (h-14 = 56px + safe area top) */}
          <div className="lg:hidden safe-area-top" style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }} aria-hidden="true" />

          {/* Content */}
          <div className="p-4 lg:p-8 pb-32 lg:pb-8">
            <Outlet />
          </div>

          {/* Spacer for mobile bottom nav + FAB - extra padding for iOS safe area */}
          <div className="h-28 lg:hidden" />
        </main>
      </div>

      {/* Floating Assistant Button */}
      <FloatingAssistant />

      {/* Quick Transaction Modal */}
      <QuickTransactionModal
        isOpen={showQuickTransaction}
        onClose={closeQuickTransaction}
      />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* PWA Install Prompt */}
      <InstallPromptBanner />

      {/* iOS Install Modal (from sidebar menu) */}
      <IOSInstallModal
        isOpen={showIOSInstallModal}
        onClose={() => setShowIOSInstallModal(false)}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav" role="navigation" aria-label="Navegação principal mobile">
        {bottomNavItems.map((item) =>
          item.primary ? (
            <button
              key={item.to}
              onClick={openQuickTransaction}
              className="relative -mt-5"
              aria-label="Adicionar nova transação"
            >
              <div className="w-14 h-14 rounded-2xl gradient-biveto shadow-lg shadow-biveto flex items-center justify-center text-white active:scale-95 transition-transform">
                <item.icon size={26} strokeWidth={2.5} aria-hidden="true" />
              </div>
            </button>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'bottom-nav-item',
                  isActive && 'bottom-nav-item-active'
                )
              }
            >
              <item.icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  )
}
