import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'Admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
