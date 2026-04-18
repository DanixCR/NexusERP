import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Página placeholder hasta que se implemente la spec 04 (layout del dashboard).
export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p>Bienvenido, {user?.firstName} {user?.lastName}</p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button className="btn-primary" onClick={() => navigate('/clients')}>
          Clientes
        </button>
        <button className="btn-primary" onClick={() => navigate('/projects')}>
          Proyectos
        </button>
        <button className="btn-secondary" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
