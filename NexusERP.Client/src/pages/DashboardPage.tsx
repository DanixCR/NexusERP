import { useAuth } from '../hooks/useAuth'

// Página placeholder hasta que se implemente la spec 04 (layout del dashboard).
export function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p>Bienvenido, {user?.firstName} {user?.lastName}</p>
      <button onClick={logout}>Cerrar sesión</button>
    </div>
  )
}
