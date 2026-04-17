import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { LoginRequest } from '../types/auth.types'

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState<LoginRequest>({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Mientras AuthContext verifica la sesión al inicio, no renderizar nada.
  // Sin esto, el login podría parpadear antes de redirigir al dashboard.
  if (isLoading) {
    return <div className="auth-loading">Cargando...</div>
  }

  // Si ya hay sesión activa, ir directo al dashboard (o a la ruta intentada).
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    // Validación básica en cliente — el backend también valida, pero esto da
    // feedback instantáneo sin esperar el round-trip al servidor.
    if (!form.email || !form.password) {
      setError('Completá todos los campos.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await login(form)

      // Redirigir a la ruta que el usuario intentaba acceder (si existe),
      // o al dashboard por defecto.
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status

      if (status === 401) {
        // Mensaje genérico para no revelar si el email existe o no (enumeración de usuarios)
        setError('Email o contraseña incorrectos.')
      } else {
        setError('Error inesperado. Intentá de nuevo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-container">
      <h1 className="auth-brand">NexusERP</h1>

      <div className="auth-card">
        <h2>Iniciar sesión</h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="usuario@empresa.com"
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="auth-link">¿Olvidaste tu contraseña?</p>
      </div>
    </div>
  )
}
