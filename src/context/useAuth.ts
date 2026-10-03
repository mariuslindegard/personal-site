import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'

/** Access the current auth session. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
