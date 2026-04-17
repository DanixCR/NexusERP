import axios from 'axios'

// "Puente" entre AuthContext (que vive en React) y los interceptores (que viven fuera de React).
// AuthContext actualiza esta variable al hacer login/logout.
// El interceptor de request la lee para adjuntar el JWT.
let accessTokenBridge: string | null = null

export function setAccessToken(token: string | null) {
  accessTokenBridge = token
}

export function getAccessToken(): string | null {
  return accessTokenBridge
}

// Instancia única de Axios configurada para esta app.
// Todos los servicios importan esta instancia — nunca axios directamente.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://localhost:7052/api',
  // withCredentials: true hace que el navegador adjunte la cookie HttpOnly
  // del refreshToken en cada request cross-origin al backend.
  withCredentials: true,
})

// ─── Interceptor de REQUEST ──────────────────────────────────────────────────
// Se ejecuta antes de cada request saliente.
// Si hay un accessToken en RAM, lo adjunta como Bearer en el header Authorization.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Interceptor de RESPONSE ─────────────────────────────────────────────────
// Maneja la renovación automática del accessToken cuando expira (HTTP 401).
//
// Problema: si hay múltiples requests en vuelo y todos reciben 401,
// sin este mecanismo se dispararían N refreshes en paralelo.
// Solución: isRefreshing + cola de callbacks pendientes.
let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processPendingQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  pendingQueue = []
}

apiClient.interceptors.response.use(
  // Respuestas exitosas: pasan directo sin modificación
  (response) => response,

  // Respuestas de error:
  async (error) => {
    const originalRequest = error.config

    const is401 = error.response?.status === 401
    const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh')
    const alreadyRetried = originalRequest?._retry

    // Solo intentar refresh si es un 401, no es el endpoint de refresh (evita loop),
    // y no es un reintento (evita loop por fallo de refresh).
    if (is401 && !isRefreshEndpoint && !alreadyRetried) {
      // Si ya hay un refresh en curso, encolar este request para cuando termine.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Importación dinámica para evitar dependencia circular:
        // axios.ts ← authService.ts ← AuthContext.tsx → axios.ts
        const { authService } = await import('../services/authService')
        const data = await authService.refresh()

        setAccessToken(data.accessToken)
        processPendingQueue(null, data.accessToken)

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processPendingQueue(refreshError, null)
        setAccessToken(null)

        // Redirigir al login si el refresh token también expiró o fue revocado
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
