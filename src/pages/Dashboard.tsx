import { useAuth } from '../context/useAuth'

export default function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="relative min-h-svh bg-ink-950">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-5 sm:px-10">
        <span className="text-sm font-medium tracking-[0.22em] text-white/50 uppercase">
          Dashboard
        </span>

        <div className="flex items-center gap-4">
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              className="size-8 rounded-full ring-1 ring-white/15"
            />
          )}
          <span className="hidden text-sm text-white/60 sm:inline">
            {user?.displayName ?? user?.email}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-28 text-center">
        <h1 className="animate-fade-up text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          You’re in{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.
        </h1>
        <p className="animate-fade-up mt-4 max-w-md text-white/50">
          Auth is wired up end to end. The dashboard content is still a blank
          canvas — we’ll fill it in later.
        </p>

        <div className="animate-fade-up mt-10 w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-8 py-14">
          <p className="text-sm text-white/35">
            Nothing here yet — content plan coming next.
          </p>
        </div>

        <dl className="mt-10 grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/5 text-left sm:grid-cols-2">
          {[
            ['Signed in as', user?.email ?? '—'],
            ['Provider', user?.providerData[0]?.providerId ?? '—'],
            ['User ID', user?.uid ?? '—'],
            [
              'Email verified',
              user?.emailVerified ? 'yes' : 'no',
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-ink-900 px-5 py-4">
              <dt className="text-xs tracking-wide text-white/35 uppercase">
                {label}
              </dt>
              <dd className="mt-1 truncate text-sm text-white/80">{value}</dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  )
}
