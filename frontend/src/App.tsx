import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'

// Lazy-loaded page routes
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Budget = lazy(() => import('./pages/Budget'))
const Goals = lazy(() => import('./pages/Goals'))
const Debts = lazy(() => import('./pages/Debts'))
const Recurring = lazy(() => import('./pages/Recurring'))
const Upload = lazy(() => import('./pages/Upload'))
const Insights = lazy(() => import('./pages/Insights'))
const Chat = lazy(() => import('./pages/Chat'))
const Accounts = lazy(() => import('./pages/Accounts'))
const CreditCards = lazy(() => import('./pages/CreditCards'))
const BenefitCards = lazy(() => import('./pages/BenefitCards'))
const IncomeSources = lazy(() => import('./pages/IncomeSources'))
const IncomeSplitRules = lazy(() => import('./pages/IncomeSplitRules'))
const Invoices = lazy(() => import('./pages/Invoices'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminLicenses = lazy(() => import('./pages/admin/AdminLicenses'))
const Settings = lazy(() => import('./pages/Settings'))
const Family = lazy(() => import('./pages/Family'))
const HouseholdMigration = lazy(() => import('./pages/HouseholdMigration'))
const ApiKeys = lazy(() => import('./pages/ApiKeys'))
const Invite = lazy(() => import('./pages/Invite'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ShareTarget = lazy(() => import('./pages/ShareTarget'))
const CashCalendar = lazy(() => import('./pages/CashCalendar'))
// Envelopes module removed - functionality merged into Budgets module
const Simulators = lazy(() => import('./pages/Simulators'))
const Automations = lazy(() => import('./pages/Automations'))
const WeeklyReview = lazy(() => import('./pages/WeeklyReview'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Market = lazy(() => import('./pages/Market'))
const Receipts = lazy(() => import('./pages/Receipts'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Challenges = lazy(() => import('./pages/Challenges'))
const Installments = lazy(() => import('./pages/Installments'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  // User data still loading - show nothing until we know if they're admin
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
      </div>
    )
  }

  // User loaded but not admin - redirect to home
  if (!user.is_admin) {
    return <Navigate to="/" />
  }

  return <>{children}</>
}

function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route
          path="/onboarding"
          element={
            <PrivateRoute>
              <Onboarding />
            </PrivateRoute>
          }
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="installments" element={<Installments />} />
          <Route path="budget" element={<Budget />} />
          <Route path="goals" element={<Goals />} />
          <Route path="debts" element={<Debts />} />
          <Route path="recurring" element={<Recurring />} />
          <Route path="calendar" element={<CashCalendar />} />
          {/* Envelopes removed - redirect to budget */}
          <Route path="envelopes" element={<Navigate to="/budget" replace />} />
          <Route path="simulators" element={<Simulators />} />
          <Route path="automations" element={<Automations />} />
          <Route path="weekly-review" element={<WeeklyReview />} />
          <Route path="market" element={<Market />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="challenges" element={<Challenges />} />
          <Route path="upload" element={<Upload />} />
          <Route path="insights" element={<Insights />} />
          <Route path="chat" element={<Chat />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="credit-cards" element={<CreditCards />} />
          <Route path="benefit-cards" element={<BenefitCards />} />
          <Route path="income-sources" element={<IncomeSources />} />
          <Route path="income-split-rules" element={<IncomeSplitRules />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="settings" element={<Settings />} />
          <Route path="family" element={<Family />} />
          <Route path="household-migration" element={<HouseholdMigration />} />
          <Route path="api-keys" element={<ApiKeys />} />
          <Route path="share-target" element={<ShareTarget />} />
          {/* Admin routes - protegidas por AdminRoute */}
          <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="admin/licenses" element={<AdminRoute><AdminLicenses /></AdminRoute>} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
