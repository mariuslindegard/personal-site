import { Link } from 'react-router-dom'
import LineField from '../components/LineField'
import GoogleIcon from '../components/GoogleIcon'
import LanguageToggle from '../components/LanguageToggle'
import Projects from '../components/Projects'
import Section from '../components/Section'
import SectionNav from '../components/SectionNav'
import Socials from '../components/Socials'
import { useAuth } from '../context/useAuth'
import { useI18n } from '../i18n/useI18n'

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
  const { t } = useI18n()

  const firstName = user?.displayName?.split(' ')[0]

  const sections = [
    { id: 'home', label: t.nav.home },
    { id: 'projects', label: t.nav.projects },
    { id: 'socials', label: t.nav.socials },
  ]

  return (
    <div className="relative h-svh overflow-hidden bg-ink-950">
      {/*
        The animated line field sits behind every section and stays fixed, so
        the scroll feels like one continuous space rather than three slides.
      */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <LineField density={1.1} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(4,5,10,0.72)_0%,rgba(4,5,10,0.35)_45%,rgba(4,5,10,0.9)_100%)]" />
      </div>

      {/* Top bar — fixed above the scroll container */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 sm:px-10">
        <a
          href="#home"
          className="text-sm font-medium tracking-[0.22em] text-white/50 uppercase transition hover:text-white/80"
        >
          Marius
        </a>

        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          {!loading && user && (
            <Link
              to="/dashboard"
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
            >
              {t.nav.dashboard}
            </Link>
          )}
        </div>
      </header>

      <SectionNav items={sections} ariaLabel={t.nav.sections} />

      <main className="scroll-area relative z-10 h-full snap-y overflow-y-auto scroll-smooth">
        {/* ── Hero ───────────────────────────────────────────── */}
        <Section id="home" ariaLabel={t.nav.home}>
          <div className="flex flex-col items-center text-center">
            <span
              className="animate-fade-up mb-6 inline-flex sm:mb-8 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs tracking-wide text-white/60 backdrop-blur-sm"
              style={{ animationDelay: '0ms' }}
            >
              <span className="size-1.5 rounded-full bg-accent" />
              {t.hero.badge}
            </span>

            <h1
              className="animate-fade-up text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-white sm:text-6xl lg:text-7xl"
              style={{ animationDelay: '90ms' }}
            >
              {t.hero.titleTop}
              <br />
              <span className="bg-gradient-to-b from-white via-white to-white/45 bg-clip-text text-transparent">
                {t.hero.titleAccent}
              </span>
            </h1>

            <p
              className="animate-fade-up mt-5 max-w-lg sm:mt-7 text-base leading-relaxed text-pretty text-white/55 sm:text-lg"
              style={{ animationDelay: '180ms' }}
            >
              {t.hero.subtitle}
            </p>

            <div
              className="animate-fade-up mt-8 flex flex-col items-center gap-5 sm:mt-11"
              style={{ animationDelay: '270ms' }}
            >
              {loading ? (
                <div className="flex h-12 items-center gap-3 text-sm text-white/50">
                  <Spinner />
                  {t.hero.restoring}
                </div>
              ) : user ? (
                <Link
                  to="/dashboard"
                  className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-medium text-ink-950 shadow-[0_0_40px_-8px_rgba(122,162,255,0.55)] transition hover:shadow-[0_0_56px_-6px_rgba(122,162,255,0.8)]"
                >
                  {t.hero.continueAs} {firstName ?? 'you'}
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
                  {t.hero.signIn}
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
                    aria-label={t.hero.dismiss}
                    className="text-red-200/60 transition hover:text-red-100"
                  >
                    ✕
                  </button>
                </div>
              )}

              {!configured && !loading && (
                <p className="max-w-sm text-xs leading-relaxed text-amber-200/70">
                  {t.hero.hint}
                </p>
              )}
            </div>

            <a
              href="#projects"
              className="animate-fade-up mt-10 flex flex-col items-center gap-2 sm:mt-16 [@media(max-height:700px)]:hidden text-[11px] tracking-[0.2em] text-white/30 uppercase transition hover:text-white/60"
              style={{ animationDelay: '380ms' }}
            >
              {t.hero.scroll}
              <span aria-hidden="true" className="text-base leading-none">
                ↓
              </span>
            </a>
          </div>
        </Section>

        {/* ── Projects ───────────────────────────────────────── */}
        <Section id="projects" ariaLabel={t.nav.projects}>
          <Projects />
        </Section>

        {/* ── Socials ────────────────────────────────────────── */}
        <Section id="socials" ariaLabel={t.nav.socials}>
          <Socials />
        </Section>
      </main>
    </div>
  )
}
