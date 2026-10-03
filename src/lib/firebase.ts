import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'

/**
 * Firebase web config. Every value comes from a Vite env var so that no
 * project secrets are committed to the repo — see `.env.example`.
 *
 * These values are not secret in the "private key" sense (they ship in the
 * client bundle regardless), but keeping them in env vars means the same
 * codebase works against a dev and a prod Firebase project.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * True once the minimum required env vars are present. The UI uses this to
 * show a setup hint instead of throwing an opaque error when `.env.local`
 * has not been filled in yet.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

let app: FirebaseApp | undefined
let auth: Auth | undefined

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
}

export { app, auth }

/** Google provider, pre-configured to always let the user pick an account. */
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
