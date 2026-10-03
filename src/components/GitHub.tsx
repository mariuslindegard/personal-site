import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import {
  fetchGitHub,
  GITHUB_FALLBACK,
  GITHUB_PROFILE_URL,
  languageColor,
  type GitHubData,
} from '../lib/github'
import { ArrowUpRight, GitHubIcon } from './Icons'

/** Shared chrome, matching the panes used by the Projects section. */
const paneClass =
  'overflow-hidden rounded-xl border border-white/10 bg-ink-900/70 backdrop-blur-sm'

function TitleBar({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-white/8 px-4 py-2.5">
      <span className="size-2.5 rounded-full bg-[#ff5f57]/70" />
      <span className="size-2.5 rounded-full bg-[#febc2e]/70" />
      <span className="size-2.5 rounded-full bg-[#28c840]/70" />
      <span className="ml-2 truncate font-mono text-[11px] text-white/40">
        {label}
      </span>
    </div>
  )
}

/** "2 days ago" / "for 2 dager siden", localised by the active language. */
function useRelativeTime() {
  const { lang } = useI18n()

  return (iso: string) => {
    const diffMs = new Date(iso).getTime() - Date.now()
    const formatter = new Intl.RelativeTimeFormat(
      lang === 'no' ? 'nb' : 'en',
      { numeric: 'auto' },
    )

    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 1000 * 60 * 60 * 24 * 365],
      ['month', 1000 * 60 * 60 * 24 * 30],
      ['week', 1000 * 60 * 60 * 24 * 7],
      ['day', 1000 * 60 * 60 * 24],
      ['hour', 1000 * 60 * 60],
      ['minute', 1000 * 60],
    ]

    for (const [unit, ms] of units) {
      if (Math.abs(diffMs) >= ms) {
        return formatter.format(Math.round(diffMs / ms), unit)
      }
    }
    return formatter.format(0, 'minute')
  }
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-lg leading-none text-white">{value}</span>
      <span className="mt-1.5 text-[11px] tracking-wide text-white/40">
        {label}
      </span>
    </div>
  )
}

export default function GitHub() {
  const { t } = useI18n()
  const relative = useRelativeTime()

  /*
    Seeded with the cached snapshot so the section renders real content
    immediately; the live request upgrades it in place. `loading` also
    suppresses the "cached" note until we actually know the API failed.
  */
  const [data, setData] = useState<GitHubData>(GITHUB_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    fetchGitHub(controller.signal)
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch(() => {
        // Aborted on unmount, or the fallback already covers us.
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const { profile, repos } = data

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <header className="mb-6 shrink-0 sm:mb-7">
        <span className="font-mono text-[11px] tracking-[0.2em] text-accent-soft/70 uppercase">
          {t.github.eyebrow}
        </span>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {t.github.heading}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45 sm:text-base">
          {t.github.subtitle}
        </p>
      </header>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-5">
        {/* Profile */}
        <div className={`${paneClass} flex min-h-0 flex-col`}>
          <TitleBar label={t.github.eyebrow} />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
            <div className="flex items-center gap-3.5">
              <img
                src={profile.avatar_url}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
                className="size-14 shrink-0 rounded-full border border-white/10 bg-ink-800 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {profile.name ?? profile.login}
                </p>
                <p className="truncate font-mono text-xs text-accent-soft/80">
                  @{profile.login}
                </p>
              </div>
            </div>

            {/* Omitted entirely when no bio is set on the GitHub profile. */}
            {profile.bio && (
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                {profile.bio}
              </p>
            )}

            <div className="mt-5 flex items-center gap-6 border-y border-white/8 py-4">
              <Stat value={profile.public_repos} label={t.github.repositories} />
              <Stat value={profile.followers} label={t.github.followers} />
              <Stat value={profile.following} label={t.github.following} />
            </div>

            {profile.location && (
              <p className="mt-4 font-mono text-xs text-white/35">
                {profile.location}
              </p>
            )}

            <div className="mt-auto pt-5">
              <a
                href={GITHUB_PROFILE_URL}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-white/85 transition hover:border-accent/50 hover:bg-white/[0.07] hover:text-white"
              >
                <GitHubIcon className="size-4" />
                {t.github.openProfile}
                <ArrowUpRight className="size-3.5 text-white/40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/80" />
              </a>
            </div>
          </div>
        </div>

        {/* Repos */}
        <div className={`${paneClass} flex min-h-0 flex-col`}>
          <TitleBar label="~/github --recent" />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul className="divide-y divide-white/6">
              {repos.map((repo) => (
                <li key={repo.name}>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex flex-col gap-1.5 px-4 py-3.5 transition hover:bg-white/[0.035] sm:px-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="truncate font-mono text-[13px] text-white/85 group-hover:text-white">
                        {repo.name}
                      </span>
                      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/70" />
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed text-white/45">
                      {repo.description ?? t.github.noDescription}
                    </p>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-white/35">
                      {repo.language && (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: languageColor(repo.language),
                            }}
                          />
                          {repo.language}
                        </span>
                      )}
                      <span>
                        {t.github.updated} {relative(repo.pushed_at)}
                      </span>
                      {repo.stargazers_count > 0 && (
                        <span>★ {repo.stargazers_count}</span>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0 border-t border-white/8 px-4 py-3 sm:px-5">
            <a
              href={`${GITHUB_PROFILE_URL}?tab=repositories`}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 font-mono text-[11px] text-accent-soft/70 transition hover:text-accent-soft"
            >
              {t.github.viewAll}
              <ArrowUpRight className="size-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Only shown when the live API call actually failed. */}
      {!loading && !data.live && (
        <p className="mt-3 shrink-0 font-mono text-[11px] text-amber-200/50">
          {t.github.cached}
        </p>
      )}
    </div>
  )
}
