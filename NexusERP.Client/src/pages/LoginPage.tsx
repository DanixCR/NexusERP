import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { LoginRequest } from '../types/auth.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState<LoginRequest>({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!form.email || !form.password) {
      setError('Completá todos los campos.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await login(form)
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        setError('Email o contraseña incorrectos.')
      } else {
        setError('Error inesperado. Intentá de nuevo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">NexusERP</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sistema de gestión empresarial</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>Ingresá tus credenciales para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@empresa.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
