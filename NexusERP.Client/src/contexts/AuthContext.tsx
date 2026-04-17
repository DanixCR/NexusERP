import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { authService } from '../services/authService'
import { setAccessToken } from '../lib/axios'
import type { AuthContextValue, User } from '../types/auth.types'
import type { LoginRequest, RegisterRequest } from '../types/auth.types'

// El contexto se exporta para que useAuth pueda verificar que no sea null.
export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Restaurar sesión al cargar la app ──────────────────────────────────────
  // El accessToken vive en RAM: si el usuario recarga la página, lo pierde.
  // La cookie HttpOnly persiste. Al iniciar, llamamos al backend para ver si
  // hay una sesión válida — si la hay, el backend emite un nuevo accessToken.
  useEffect(() => {
    authService
      .refresh()
      .then((data) => {
        setAccessTokenState(data.accessToken)
        setAccessToken(data.accessToken) // actualiza el puente para el interceptor
        setUser(data.user)
      })
      .catch(() => {
        // No había sesión activa — el usuario tendrá que loguearse
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  async function login(data: LoginRequest) {
    const response = await authService.login(data)
    setAccessTokenState(response.accessToken)
    setAccessToken(response.accessToken) // actualiza el puente para el interceptor
    setUser(response.user)
  }

  async function register(data: RegisterRequest) {
    const response = await authService.register(data)
    setAccessTokenState(response.accessToken)
    setAccessToken(response.accessToken)
    setUser(response.user)
  }

  async function logout() {
    try {
      await authService.logout()
    } finally {
      // Limpiar estado local aunque el backend falle
      setAccessTokenState(null)
      setAccessToken(null)
      setUser(null)
    }
  }

  const value: AuthContextValue = {
    user,
    accessToken,
    isAuthenticated: user !== null,
    isLoading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
