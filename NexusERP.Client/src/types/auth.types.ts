// Espeja LoginRequestDto del backend
export type LoginRequest = {
  email: string
  password: string
}

// Espeja RegisterRequestDto del backend
export type RegisterRequest = {
  email: string
  password: string
  firstName: string
  lastName: string
}

// Espeja UserDto del backend
export type User = {
  id: string        // GUID como string en el frontend
  email: string
  firstName: string
  lastName: string
}

// Espeja LoginResponseDto del backend
// Nota: refreshToken NO está aquí — viaja en cookie HttpOnly, invisible para JS
export type AuthResponse = {
  accessToken: string
  expiresAt: string  // ISO 8601 — cuándo expira el accessToken
  user: User
}

// Estado del contexto de autenticación
export type AuthState = {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// Acciones disponibles en el contexto
export type AuthContextValue = AuthState & {
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
}
