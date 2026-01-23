import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Lightbulb,
  LogOut,
  Menu,
  Wallet,
  Target,
  CreditCard,
  Repeat,
  Bot,
  Settings,
  Building,
  Plus,
  ChevronRight,
  ChevronDown,
  Moon,
  Sun,
  Briefcase,
  BadgeDollarSign,
  FileText,
  Calendar,
  Inbox,
  Calculator,
  Zap,
  ClipboardCheck,
  PieChart,
  ArrowLeftRight,
  Wrench,
  LucideIcon,
  ShoppingCart,
  Ticket,
  Store,
  Percent,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import api from '../services/api'
import FloatingAssistant from './FloatingAssistant'
import ToastContainer from './shared/ToastContainer'
import SemicircleFAB from './SemicircleFAB'
import { useUploadStore } from '../stores/uploadStore'
import InstallPromptBanner from './InstallPromptBanner'
import IOSInstallModal from './IOSInstallModal'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useServiceWorker } from '../hooks/useServiceWorker'
import { useBottomSheet } from '../hooks/useBottomSheet'
import { NotificationBell } from './notifications'
import { PullToRefreshIndicator, UpdateBanner } from './pwa'
import { BottomSheet, UserCard } from './mobile'

// Types for menu structure
interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

interface NavGroup {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
  defaultOpen?: boolean
}

// Menu groups structure
const menuGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: PieChart,
    defaultOpen: true,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/insights', icon: Lightbulb, label: 'Insights' },
      { to: '/calendar', icon: Calendar, label: 'Calendário' },
    ],
  },
  {
    id: 'accounts',
    label: 'Contas & Cartões',
    icon: Building,
    items: [
      { to: '/accounts', icon: Building, label: 'Contas' },
      { to: '/credit-cards', icon: CreditCard, label: 'Cartões' },
      { to: '/benefit-cards', icon: Ticket, label: 'Benefícios' },
      { to: '/invoices', icon: FileText, label: 'Faturas' },
    ],
  },
  {
    id: 'transactions',
    label: 'Movimentações',
    icon: ArrowLeftRight,
    items: [
      { to: '/transactions', icon: Receipt, label: 'Transações' },
      { to: '/receipts', icon: Store, label: 'Compras' },
      { to: '/recurring', icon: Repeat, label: 'Recorrentes' },
      { to: '/income-sources', icon: Briefcase, label: 'Receitas' },
      { to: '/income-split-rules', icon: Percent, label: 'Divisao' },
    ],
  },
  {
    id: 'planning',
    label: 'Planejamento',
    icon: Target,
    items: [
      { to: '/budget', icon: Wallet, label: 'Orçamento' },
      { to: '/goals', icon: Target, label: 'Metas' },
      { to: '/envelopes', icon: Inbox, label: 'Envelopes' },
      { to: '/debts', icon: BadgeDollarSign, label: 'Dívidas' },
      { to: '/market', icon: ShoppingCart, label: 'Mercado' },
    ],
  },
  {
    id: 'tools',
    label: 'Ferramentas',
    icon: Wrench,
    items: [
      { to: '/simulators', icon: Calculator, label: 'Simuladores' },
      { to: '/automations', icon: Zap, label: 'Automações' },
      { to: '/weekly-review', icon: ClipboardCheck, label: 'Revisão' },
    ],
  },
]

// Bottom navigation items (mobile) - most important screens
// Note: 'action' items trigger callbacks instead of navigation
interface BottomNavItem {
  to?: string
  icon: LucideIcon
  label: string
  primary?: boolean
  action?: 'openMenu'
}

const bottomNavItems: BottomNavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/transactions', icon: Receipt, label: 'Transações' },
  { to: '/upload', icon: Plus, label: 'Adicionar', primary: true },
  { to: '/chat', icon: Bot, label: 'Chat' },
  { icon: Menu, label: 'Menu', action: 'openMenu' },
]

// LocalStorage key for persisting group states
const MENU_STATE_KEY = 'biveto_menu_groups_state'

// Hook for managing menu group states with persistence
function useMenuGroupState() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Initialize from localStorage or defaults
    try {
      const saved = localStorage.getItem(MENU_STATE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Ignore parse errors
    }
    // Default: only 'overview' is open
    return menuGroups.reduce((acc, group) => {
      acc[group.id] = group.defaultOpen ?? false
      return acc
    }, {} as Record<string, boolean>)
  })

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(MENU_STATE_KEY, JSON.stringify(openGroups))
    } catch {
      // Ignore storage errors
    }
  }, [openGroups])

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }, [])

  const isGroupOpen = useCallback((groupId: string) => {
    return openGroups[groupId] ?? false
  }, [openGroups])

  return { isGroupOpen, toggleGroup }
}

// NavGroup component for collapsible menu sections
interface NavGroupComponentProps {
  group: NavGroup
  isOpen: boolean
  onToggle: () => void
  isMobile?: boolean
  currentPath: string
}

function NavGroupComponent({ group, isOpen, onToggle, isMobile = false, currentPath }: NavGroupComponentProps) {
  const hasActiveChild = group.items.some(item =>
    item.to === '/' ? currentPath === '/' : currentPath.startsWith(item.to)
  )

  return (
    <div className="space-y-1">
      {/* Group header */}
      <button
        onClick={onToggle}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-medium transition-all duration-200',
          hasActiveChild && !isOpen
            ? 'bg-biveto-light/50 text-biveto dark:bg-biveto/10 dark:text-biveto'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-slate-700/50 dark:hover:text-gray-200'
        )}
      >
        <div className="flex items-center gap-3">
          <group.icon size={20} />
          <span>{group.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              {group.items.length}
            </span>
          )}
          <ChevronDown
            size={16}
            className={clsx(
              'transition-transform duration-200',
              isOpen ? 'rotate-0' : '-rotate-90'
            )}
          />
        </div>
      </button>

      {/* Group items */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className={clsx('pl-4 space-y-0.5', isMobile ? 'py-1' : 'py-0.5')}>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-2 rounded-xl font-medium transition-all duration-200',
                  isMobile ? 'justify-between' : '',
                  isActive
                    ? 'bg-biveto-light text-biveto shadow-sm dark:bg-biveto/20 dark:text-biveto'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white'
                )
              }
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                <span>{item.label}</span>
              </div>
              {isMobile && (
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const [fabMenuOpen, setFabMenuOpen] = useState(false)
  const setPendingFile = useUploadStore((state) => state.setPendingFile)
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const { theme, toggleTheme } = useThemeStore()
  // PWA install prompt is handled by InstallPromptBanner - install option available in Settings
  usePWAInstall()
  const { hasUpdate, isUpdating, updateApp, dismissUpdate } = useServiceWorker()
  const navigate = useNavigate()
  const location = useLocation()
  const { isGroupOpen, toggleGroup } = useMenuGroupState()

  // Bottom sheet for mobile menu
  const {
    isOpen: mobileMenuOpen,
    open: openMobileMenu,
    close: closeMobileMenu,
    dragHandlers,
    translateY,
    isDragging,
  } = useBottomSheet({ snapPoints: [0.7, 0.9] })

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    // Refresh the current page data
    window.location.reload()
  }, [])

  // Desabilitar pull to refresh em certas páginas (upload tem sua própria navegação)
  const isUploadPage = location.pathname === '/upload'

  const {
    pullDistance,
    isRefreshing,
    containerRef,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 100,
    minStartDistance: 30, // Aumentado para reduzir sensibilidade
    triggerZoneHeight: 150, // Só ativa se puxar dos primeiros 150px do topo
    disabled: mobileMenuOpen || fabMenuOpen || isUploadPage,
  })

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

  // Close mobile menu and FAB menu on route change
  useEffect(() => {
    closeMobileMenu()
    setFabMenuOpen(false)
  }, [location.pathname, closeMobileMenu])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Handle file selection from SemicircleFAB
  const handleFabFileSelect = (file: File) => {
    setPendingFile(file)
    navigate('/upload')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        threshold={100}
      />

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 glass border-b border-gray-200/50 dark:bg-slate-900/80 dark:border-slate-700 mobile-header">
        <div className="flex items-center justify-between px-4 h-14">
          <img src={isDark ? "/logo-white.svg" : "/logo.svg"} alt="Biveto" className="h-8" />
          <NotificationBell />
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-100 dark:bg-slate-800 dark:border-slate-700" role="complementary" aria-label="Menu lateral">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-100 dark:border-slate-700">
            <img src={isDark ? "/logo-white.svg" : "/logo.svg"} alt="Biveto" className="h-9" />
          </div>

          {/* Quick Actions */}
          <div className="px-3 pt-4 pb-2 space-y-2">
            <NavLink
              to="/upload?mode=manual"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-biveto text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Nova Transação</span>
            </NavLink>
            <NavLink
              to="/upload"
              className={({ isActive }) =>
                clsx(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 font-medium rounded-xl transition-all duration-200 border-2 border-dashed',
                  isActive
                    ? 'border-biveto bg-biveto-light text-biveto dark:bg-biveto/20'
                    : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-biveto hover:text-biveto dark:hover:border-biveto dark:hover:text-biveto'
                )
              }
            >
              <Upload size={18} />
              <span>Importar</span>
            </NavLink>
          </div>

          {/* Navigation with Groups */}
          <nav className="flex-1 px-3 py-2 space-y-2 overflow-y-auto" role="navigation" aria-label="Navegação principal">
            {menuGroups.map((group) => (
              <NavGroupComponent
                key={group.id}
                group={group}
                isOpen={isGroupOpen(group.id)}
                onToggle={() => toggleGroup(group.id)}
                currentPath={location.pathname}
              />
            ))}

            {/* Assistente IA - Item especial */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
              <NavLink
                to="/chat"
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-purple-500/10 to-biveto/10 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white'
                  )
                }
              >
                <Bot size={20} />
                <span>Assistente IA</span>
              </NavLink>
            </div>

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
          <div className="p-3 border-t border-gray-100 dark:border-slate-700 space-y-3">
            {/* User info card */}
            <NavLink
              to="/settings"
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-biveto-navy to-biveto-green flex items-center justify-center text-white font-semibold text-sm shadow-md">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || ''}
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            </NavLink>

            {/* Action buttons row */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1">
                <NotificationBell />
                <button
                  onClick={toggleTheme}
                  className="p-2.5 text-gray-500 hover:text-biveto hover:bg-biveto-light rounded-xl transition-all dark:text-gray-400 dark:hover:bg-slate-700 dark:hover:text-white"
                  title={isDark ? 'Modo claro' : 'Modo escuro'}
                >
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all dark:text-red-400 dark:hover:bg-red-900/30"
                title="Sair"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Bottom Sheet Menu */}
        <BottomSheet
          isOpen={mobileMenuOpen}
          onClose={closeMobileMenu}
          snapPoints={[0.7, 0.9]}
          dragHandlers={dragHandlers}
          translateY={translateY}
          isDragging={isDragging}
          className="lg:hidden"
        >
          {/* User Card - Compact */}
          <div className="mb-4">
            <UserCard
              user={user}
              onLogout={handleLogout}
              onClose={closeMobileMenu}
            />
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 mb-4">
            <NavLink
              to="/upload?mode=manual"
              onClick={closeMobileMenu}
              className="w-full flex items-center gap-3 px-4 py-3 gradient-biveto text-white font-semibold rounded-xl shadow-md active:scale-[0.98] transition-transform"
            >
              <Plus size={20} strokeWidth={2.5} />
              <span>Nova Transação</span>
            </NavLink>
            <NavLink
              to="/upload"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                clsx(
                  'w-full flex items-center gap-3 px-4 py-3 font-medium rounded-xl transition-all duration-200 border-2 border-dashed',
                  isActive
                    ? 'border-biveto bg-biveto-light text-biveto dark:bg-biveto/20'
                    : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300'
                )
              }
            >
              <Upload size={20} />
              <span>Importar</span>
            </NavLink>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-slate-700 my-3" />

          {/* Navigation Groups */}
          <nav className="space-y-2" role="navigation" aria-label="Navegação do menu">
            {menuGroups.map((group) => (
              <NavGroupComponent
                key={group.id}
                group={group}
                isOpen={isGroupOpen(group.id)}
                onToggle={() => toggleGroup(group.id)}
                isMobile={true}
                currentPath={location.pathname}
              />
            ))}

            {/* Assistente IA - Item especial */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
              <NavLink
                to="/chat"
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-purple-500/10 to-biveto/10 text-purple-600 dark:text-purple-400'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700 dark:hover:text-white'
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <Bot size={20} />
                  <span>Assistente IA</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
              </NavLink>
            </div>

            {/* Admin Menu */}
            {user?.is_admin && (
              <>
                <div className="border-t border-gray-100 dark:border-slate-700 my-3" />
                <NavLink
                  to="/admin"
                  onClick={closeMobileMenu}
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

          {/* Bottom padding for safe area */}
          <div className="h-24" />
        </BottomSheet>

        {/* Main content */}
        <main
          ref={containerRef as React.RefObject<HTMLElement>}
          className="flex-1 lg:ml-64 overflow-x-hidden overflow-y-auto"
          role="main"
          aria-label="Conteúdo principal"
          style={{
            // Add padding top when pulling
            paddingTop: pullDistance > 0 ? `${pullDistance}px` : undefined,
            transition: pullDistance === 0 ? 'padding-top 0.2s ease-out' : undefined,
          }}
        >
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

      {/* Toast Notifications */}
      <ToastContainer />

      {/* PWA Update Banner */}
      <UpdateBanner
        isVisible={hasUpdate}
        isUpdating={isUpdating}
        onUpdate={updateApp}
        onDismiss={dismissUpdate}
      />

      {/* PWA Install Prompt */}
      <InstallPromptBanner />

      {/* iOS Install Modal (from sidebar menu) */}
      <IOSInstallModal
        isOpen={showIOSInstallModal}
        onClose={() => setShowIOSInstallModal(false)}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav" role="navigation" aria-label="Navegação principal mobile">
        {bottomNavItems.map((item, index) => {
          // FAB Primary Button - Use SemicircleFAB
          if (item.primary) {
            return (
              <SemicircleFAB
                key={item.to || index}
                onFileSelect={handleFabFileSelect}
                isOpen={fabMenuOpen}
                onToggle={setFabMenuOpen}
              />
            )
          }

          // Menu Action Button (opens Bottom Sheet)
          if (item.action === 'openMenu') {
            return (
              <button
                key={item.label}
                onClick={openMobileMenu}
                className={clsx(
                  'bottom-nav-item',
                  mobileMenuOpen && 'bottom-nav-item-active'
                )}
                aria-label={item.label}
                aria-expanded={mobileMenuOpen}
              >
                <item.icon size={22} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          }

          // Regular NavLink
          return (
            <NavLink
              key={item.to}
              to={item.to!}
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
        })}
      </nav>
    </div>
  )
}
