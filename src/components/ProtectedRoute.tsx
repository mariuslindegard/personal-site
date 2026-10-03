import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

/**
 * Gates a route behind authentication. While the session is still being
 * restored it shows nothing (avoids a redirect flash on reload).
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink-950">
        <span className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  return <>{children}</>
}
