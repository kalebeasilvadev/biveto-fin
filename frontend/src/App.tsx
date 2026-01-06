import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budget from './pages/Budget'
import Goals from './pages/Goals'
import Debts from './pages/Debts'
import Recurring from './pages/Recurring'
import Upload from './pages/Upload'
import Insights from './pages/Insights'
import Chat from './pages/Chat'
import Accounts from './pages/Accounts'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminLicenses from './pages/admin/AdminLicenses'
import Settings from './pages/Settings'
import Invite from './pages/Invite'
import ResetPassword from './pages/ResetPassword'

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
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
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
        <Route path="budget" element={<Budget />} />
        <Route path="goals" element={<Goals />} />
        <Route path="debts" element={<Debts />} />
        <Route path="recurring" element={<Recurring />} />
        <Route path="upload" element={<Upload />} />
        <Route path="insights" element={<Insights />} />
        <Route path="chat" element={<Chat />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="settings" element={<Settings />} />
        {/* Admin routes - protegidas por AdminRoute */}
        <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="admin/licenses" element={<AdminRoute><AdminLicenses /></AdminRoute>} />
      </Route>
    </Routes>
  )
}

export default App
