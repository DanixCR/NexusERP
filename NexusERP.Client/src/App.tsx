import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientsPage } from './pages/ClientsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { ProductsPage } from './pages/ProductsPage'
import { TicketsPage } from './pages/TicketsPage'

// QueryClient es el caché central de React Query.
// Se crea una sola vez fuera del componente para no recrearlo en cada render.
const queryClient = new QueryClient()

function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider: provee isAuthenticated, user, login, logout a toda la app */}
      <AuthProvider>
        {/* QueryClientProvider: provee el caché de React Query (para llamadas al API) */}
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                // ProtectedRoute redirige a /login si el usuario no está autenticado
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <ClientsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <ProjectsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <TicketsPage />
                </ProtectedRoute>
              }
            />
            {/* Ruta raíz: redirige al dashboard (ProtectedRoute lo enviará al login si hace falta) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
