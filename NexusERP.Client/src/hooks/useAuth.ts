import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import type { AuthContextValue } from '../types/auth.types'

// Hook para consumir el contexto de autenticación desde cualquier componente.
//
// ¿Por qué un hook separado en lugar de useContext(AuthContext) directamente?
// 1. Lanza un error descriptivo si se usa fuera del AuthProvider.
// 2. Centraliza el punto de acceso — si el contexto cambia, se actualiza aquí.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
