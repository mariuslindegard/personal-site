import { Link } from 'react-router-dom'
import LineField from '../components/LineField'
import GoogleIcon from '../components/GoogleIcon'
import LanguageToggle from '../components/LanguageToggle'
import LocalClock from '../components/LocalClock'
import Projects from '../components/Projects'
import GitHub from '../components/GitHub'
import About from '../components/About'
import Section from '../components/Section'
import SectionNav from '../components/SectionNav'
import Socials from '../components/Socials'
import { useAuth } from '../context/useAuth'
import { useI18n } from '../i18n/useI18n'

function Spinner() {
  return (
    <span
      className="inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white/90"
      aria-hidden="true"
    />
  )
}

/**
 * Sign-in lives in the header: the dashboard is a private tool, so the landing
 * page no longer advertises it in the hero copy or asks visitors to log in.
 */
function HeaderAuth() {
  const { user, loading, configured, error, signInWithGoogle, clearError } =
    useAuth()
  const { t } = useI18n()

  if (loading) {
    return (
      <span
        role="status"
        aria-label={t.hero.restoring}
        className="flex h-[34px] items-center gap-2 rounded-full border border-white/10 px-3.5 text-xs text-white/40"
      >
        <Spinner />
      </span>
    )
  }

  if (user) {
    return (
      <Link
        to="/dashboard"
        className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white/80 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
      >
        {t.nav.dashboard}
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={!configured}
        title={configured ? undefined : t.hero.hint}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-sm text-white/80 backdrop-blur-sm transition hover:border-white/30 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        <GoogleIcon className="size-3.5" />
        {t.hero.signIn}
      </button>

      {/* Errors and the not-configured hint surface here rather than in the hero. */}
      {error && (
        <div
          role="alert"
          className="absolute right-0 z-40 mt-2 flex w-64 items-start gap-2 rounded-lg border border-red-400/25 bg-ink-900/95 px-3 py-2 text-xs text-red-200 shadow-xl backdrop-blur-md"
        >
          <span className="flex-1 leading-relaxed">{error}</span>
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

      {!configured && !error && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-amber-400/20 bg-ink-900/95 px-3 py-2 text-[11px] leading-relaxed text-amber-200/70 shadow-xl backdrop-blur-md">
          {t.hero.hint}
        </div>
      )}
    </div>
  )
}

export default function Landing() {
  const { t } = useI18n()

  const sections = [
    { id: 'home', label: t.nav.home },
    { id: 'projects', label: t.nav.projects },
    { id: 'github', label: t.nav.github },
    { id: 'about', label: t.nav.about },
    { id: 'socials', label: t.nav.socials },
  ]

  return (
    <div className="relative h-svh overflow-hidden bg-ink-950">
      {/*
        The animated line field sits behind every section and stays fixed, so
        the scroll feels like one continuous space rather than five slides.
      */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <LineField density={1.1} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(4,5,10,0.72)_0%,rgba(4,5,10,0.35)_45%,rgba(4,5,10,0.9)_100%)]" />
      </div>

      {/* Top bar — fixed above the scroll container */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-6 py-6 sm:px-10">
        <a
          href="#home"
          className="shrink-0 text-sm font-medium tracking-[0.22em] text-white/50 uppercase transition hover:text-white/80"
        >
          Marius
        </a>

        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <HeaderAuth />
        </div>
      </header>

      <SectionNav items={sections} ariaLabel={t.nav.sections} />

      <main className="scroll-area relative z-10 h-full snap-y overflow-y-auto scroll-smooth">
        {/* ── Hero ───────────────────────────────────────────── */}
        <Section id="home" ariaLabel={t.nav.home}>
          <div className="flex flex-col items-center text-center">
            <span
              className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 font-mono text-xs tracking-wide backdrop-blur-sm sm:mb-8"
              style={{ animationDelay: '0ms' }}
            >
              <span
                aria-hidden="true"
                className="size-1.5 animate-pulse rounded-full bg-accent"
              />
              <LocalClock label={t.hero.clockLabel} title={t.hero.clockTitle} />
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
              className="animate-fade-up mt-5 max-w-lg text-base leading-relaxed text-pretty text-white/55 sm:mt-7 sm:text-lg"
              style={{ animationDelay: '180ms' }}
            >
              {t.hero.subtitle}
            </p>

            <a
              href="#projects"
              className="animate-fade-up mt-14 flex flex-col items-center gap-2 text-[11px] tracking-[0.2em] text-white/30 uppercase transition hover:text-white/60 sm:mt-16 [@media(max-height:700px)]:hidden"
              style={{ animationDelay: '270ms' }}
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

        {/* ── GitHub ─────────────────────────────────────────── */}
        <Section id="github" ariaLabel={t.nav.github}>
          <GitHub />
        </Section>

        {/* ── About ──────────────────────────────────────────── */}
        <Section id="about" ariaLabel={t.nav.about}>
          <About />
        </Section>

        {/* ── Socials ────────────────────────────────────────── */}
        <Section id="socials" ariaLabel={t.nav.socials}>
          <Socials />
        </Section>
      </main>
    </div>
  )
}
