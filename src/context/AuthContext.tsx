import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase'

export type AuthContextValue = {
  user: User | null
  /** True while the initial Firebase session is being restored. */
  loading: boolean
  /** True when `.env.local` has not been filled in yet. */
  configured: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** Maps Firebase error codes to short, human-readable messages. */
function describeAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Auth settings.'
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.'
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in the Firebase console.'
    default:
      return err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser)
        setLoading(false)
      },
      (err) => {
        setError(describeAuthError(err))
        setLoading(false)
      },
    )

    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      setError('Firebase is not configured. Add your keys to .env.local.')
      return
    }
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(describeAuthError(err))
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!auth) return
    setError(null)
    try {
      await firebaseSignOut(auth)
    } catch (err) {
      setError(describeAuthError(err))
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      error,
      signInWithGoogle,
      signOut,
      clearError,
    }),
    [user, loading, error, signInWithGoogle, signOut, clearError],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
