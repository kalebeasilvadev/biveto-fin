import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budget from './pages/Budget'
import Goals from './pages/Goals'
import Debts from './pages/Debts'
import Upload from './pages/Upload'
import Insights from './pages/Insights'
import Chat from './pages/Chat'
import Accounts from './pages/Accounts'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminLicenses from './pages/admin/AdminLicenses'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Registro desabilitado - gerenciado via admin */}
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
        <Route path="upload" element={<Upload />} />
        <Route path="insights" element={<Insights />} />
        <Route path="chat" element={<Chat />} />
        <Route path="accounts" element={<Accounts />} />
        {/* Admin routes */}
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/licenses" element={<AdminLicenses />} />
      </Route>
    </Routes>
  )
}

export default App
