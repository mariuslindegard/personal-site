/**
 * GitHub data for the profile section.
 *
 * github.com refuses to be framed (it sends `X-Frame-Options: deny` and
 * `frame-ancestors 'none'`), so an <iframe> embed of the profile page is not
 * an option — it renders as a blank box. We read the public REST API instead.
 *
 * The API is unauthenticated and rate-limited per IP (60 req/h), so a snapshot
 * of the real data is cached below and used whenever the request fails. The
 * section therefore always renders something meaningful rather than an empty
 * state or a spinner that never resolves.
 */

export const GITHUB_USERNAME = 'mariuslindegard'
export const GITHUB_PROFILE_URL = `https://github.com/${GITHUB_USERNAME}`

export type GhProfile = {
  login: string
  name: string | null
  bio: string | null
  blog: string | null
  location: string | null
  avatar_url: string
  public_repos: number
  followers: number
  following: number
  html_url: string
}

export type GhRepo = {
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  html_url: string
  pushed_at: string
  fork: boolean
  archived: boolean
}

/** Snapshot captured 2026-10-03, used as the offline / rate-limited fallback. */
const FALLBACK_PROFILE: GhProfile = {
  login: GITHUB_USERNAME,
  name: 'Marius Lindegård',
  bio: null,
  blog: 'www.mariusbl.no',
  location: 'Norway',
  avatar_url: 'https://avatars.githubusercontent.com/u/61710316?v=4',
  public_repos: 23,
  followers: 5,
  following: 3,
  html_url: GITHUB_PROFILE_URL,
}

const FALLBACK_REPOS: GhRepo[] = [
  {
    name: 'personal-site',
    description: 'Personal webpage with Google SSO login (Firebase Auth)',
    language: 'TypeScript',
    stargazers_count: 0,
    html_url: `${GITHUB_PROFILE_URL}/personal-site`,
    pushed_at: '2026-10-03T12:11:18Z',
    fork: false,
    archived: false,
  },
  {
    name: 'lifeos',
    description:
      'An application made for analyzing and managing your life - locally, running Gemma 4B.',
    language: 'Python',
    stargazers_count: 0,
    html_url: `${GITHUB_PROFILE_URL}/lifeos`,
    pushed_at: '2026-04-30T10:02:11Z',
    fork: false,
    archived: false,
  },
  {
    name: 'plexstack',
    description: null,
    language: 'Shell',
    stargazers_count: 0,
    html_url: `${GITHUB_PROFILE_URL}/plexstack`,
    pushed_at: '2025-07-16T14:12:30Z',
    fork: false,
    archived: false,
  },
  {
    name: 'DominosExpressServer',
    description: 'Backend API for Dominos Chrome Extension',
    language: 'JavaScript',
    stargazers_count: 0,
    html_url: `${GITHUB_PROFILE_URL}/DominosExpressServer`,
    pushed_at: '2024-06-29T22:04:17Z',
    fork: false,
    archived: false,
  },
  {
    name: 'DiscordBotTemplate',
    description: null,
    language: 'Python',
    stargazers_count: 0,
    html_url: `${GITHUB_PROFILE_URL}/DiscordBotTemplate`,
    pushed_at: '2022-10-31T14:39:42Z',
    fork: false,
    archived: false,
  },
  {
    name: 'Memory',
    description: null,
    language: null,
    stargazers_count: 0,
    html_url: `${GITHUB_PROFILE_URL}/Memory`,
    pushed_at: '2021-12-19T12:51:41Z',
    fork: false,
    archived: false,
  },
]

export type GitHubData = {
  profile: GhProfile
  repos: GhRepo[]
  /** False when the live API call failed and the cached snapshot is in use. */
  live: boolean
}

/**
 * The snapshot as a ready-to-render payload. Used as the initial state so the
 * section has real content on first paint — no skeleton, no layout shift —
 * and gets upgraded in place once the live request resolves.
 */
export const GITHUB_FALLBACK: GitHubData = {
  profile: FALLBACK_PROFILE,
  repos: FALLBACK_REPOS,
  live: false,
}

/** Rough brand colours for the language dot, with a neutral default. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  Dockerfile: '#384d54',
  Nix: '#7e7eff',
  Vue: '#41b883',
}

export function languageColor(language: string | null): string {
  if (!language) return 'rgba(255,255,255,0.3)'
  return LANGUAGE_COLORS[language] ?? '#8b949e'
}

/** How many repos the section lists before it becomes a scroll area. */
export const REPO_LIMIT = 6

export async function fetchGitHub(
  signal?: AbortSignal,
): Promise<GitHubData> {
  const headers = { Accept: 'application/vnd.github+json' }

  try {
    const [profileRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, {
        headers,
        signal,
      }),
      fetch(
        `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=pushed&per_page=100`,
        { headers, signal },
      ),
    ])

    if (!profileRes.ok || !reposRes.ok) throw new Error('GitHub API error')

    const profile = (await profileRes.json()) as GhProfile
    const all = (await reposRes.json()) as GhRepo[]

    const repos = all
      .filter((repo) => !repo.fork && !repo.archived)
      .sort(
        (a, b) =>
          new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
      )
      .slice(0, REPO_LIMIT)

    if (!Array.isArray(repos)) throw new Error('Unexpected payload')

    return { profile, repos, live: true }
  } catch (err) {
    // An abort is a deliberate teardown, not a failure — let it through.
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return { profile: FALLBACK_PROFILE, repos: FALLBACK_REPOS, live: false }
  }
}
