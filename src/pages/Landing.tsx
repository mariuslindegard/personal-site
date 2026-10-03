import { Link } from 'react-router-dom'
import LineField from '../components/LineField'
import GoogleIcon from '../components/GoogleIcon'
import { useAuth } from '../context/useAuth'

function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white/90"
      aria-hidden="true"
    />
  )
}

export default function Landing() {
  const { user, loading, configured, error, signInWithGoogle, clearError } =
    useAuth()

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-ink-950">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <LineField density={1.1} />
        {/* Radial vignette so the centre stays readable over the lines */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(4,5,10,0.72)_0%,rgba(4,5,10,0.35)_45%,rgba(4,5,10,0.9)_100%)]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <span className="text-sm font-medium tracking-[0.22em] text-white/50 uppercase">
          Marius
        </span>
        {!loading && user && (
          <Link
            to="/dashboard"
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
          >
            Dashboard
          </Link>
        )}
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-24">
        <div className="flex max-w-2xl flex-col items-center text-center">
          <span
            className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs tracking-wide text-white/60 backdrop-blur-sm"
            style={{ animationDelay: '0ms' }}
          >
            <span className="size-1.5 rounded-full bg-accent" />
            Personal space
          </span>

          <h1
            className="animate-fade-up text-5xl leading-[1.05] font-semibold tracking-tight text-balance text-white sm:text-7xl"
            style={{ animationDelay: '90ms' }}
          >
            Welcome to my
            <br />
            <span className="bg-gradient-to-b from-white via-white to-white/45 bg-clip-text text-transparent">
              corner of the web
            </span>
          </h1>

          <p
            className="animate-fade-up mt-7 max-w-lg text-base leading-relaxed text-pretty text-white/55 sm:text-lg"
            style={{ animationDelay: '180ms' }}
          >
            A quiet place on the internet. Sign in to continue to your
            dashboard.
          </p>

          {/* Action */}
          <div
            className="animate-fade-up mt-11 flex flex-col items-center gap-5"
            style={{ animationDelay: '270ms' }}
          >
            {loading ? (
              <div className="flex h-12 items-center gap-3 text-sm text-white/50">
                <Spinner />
                Restoring session…
              </div>
            ) : user ? (
              <Link
                to="/dashboard"
                className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-medium text-ink-950 shadow-[0_0_40px_-8px_rgba(122,162,255,0.55)] transition hover:shadow-[0_0_56px_-6px_rgba(122,162,255,0.8)]"
              >
                Continue as {user.displayName?.split(' ')[0] ?? 'you'}
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={!configured}
                className="inline-flex h-12 items-center gap-3 rounded-full border border-white/15 bg-white/95 px-6 text-[15px] font-medium text-ink-950 shadow-[0_0_40px_-10px_rgba(122,162,255,0.6)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-center gap-3 rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-200"
              >
                {error}
                <button
                  type="button"
                  onClick={clearError}
                  aria-label="Dismiss error"
                  className="text-red-200/60 transition hover:text-red-100"
                >
                  ✕
                </button>
              </div>
            )}

            {!configured && !loading && (
              <p className="max-w-sm text-xs leading-relaxed text-amber-200/70">
                Firebase isn’t configured yet. Copy{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                  .env.example
                </code>{' '}
                to{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                  .env.local
                </code>{' '}
                and add your project keys.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center px-6 pb-8 text-xs text-white/30">
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
