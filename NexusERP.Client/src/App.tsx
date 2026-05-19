import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientsPage } from './pages/ClientsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { ProductsPage } from './pages/ProductsPage'
import { TicketsPage } from './pages/TicketsPage'
import { ProfilePage } from './pages/ProfilePage'
import { UsersPage } from './pages/UsersPage'

const queryClient = new QueryClient()

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard"   element={<DashboardPage />} />
              <Route path="/clients"     element={<ClientsPage />} />
              <Route path="/projects"    element={<ProjectsPage />} />
              <Route path="/employees"   element={<EmployeesPage />} />
              <Route path="/products"    element={<ProductsPage />} />
              <Route path="/tickets"     element={<TicketsPage />} />
              <Route path="/profile"     element={<ProfilePage />} />
              <Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
