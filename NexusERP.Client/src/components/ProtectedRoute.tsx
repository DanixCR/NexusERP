import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

type Props = {
  children: ReactNode
}

// Wrapper que protege rutas privadas.
// - Mientras AuthContext verifica la sesión: muestra spinner
// - Si está autenticado: renderiza los children
// - Si no está autenticado: redirige a /login, guardando la ruta actual en state
//   para poder volver a ella después del login
export function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="auth-loading">Cargando...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
