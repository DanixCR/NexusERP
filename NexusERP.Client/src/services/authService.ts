import { apiClient } from '../lib/axios'
import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/auth.types'

// Centraliza todas las llamadas HTTP al módulo /auth del backend.
// Los componentes y hooks nunca llaman a apiClient directamente — siempre pasan por aquí.
export const authService = {
  login(data: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', data).then((r) => r.data)
  },

  register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', data).then((r) => r.data)
  },

  // El refreshToken viaja en la cookie HttpOnly — no se envía en el body.
  // El navegador la adjunta automáticamente porque configuramos withCredentials: true.
  logout(): Promise<void> {
    return apiClient.post('/auth/logout').then(() => undefined)
  },

  // Llamado solo por el interceptor de Axios y por AuthContext al iniciar la app.
  refresh(): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/refresh').then((r) => r.data)
  },
}
