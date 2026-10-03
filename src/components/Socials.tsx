import { useI18n } from '../i18n/useI18n'
import { ArrowUpRight, InstagramIcon, LinkedInIcon } from './Icons'

const LINKEDIN_URL =
  'https://www.linkedin.com/in/marius-berg-lindeg%C3%A5rd-21826121a/'
const INSTAGRAM_URL = 'https://www.instagram.com/marius_lindegaard/'

export default function Socials() {
  const { t } = useI18n()

  const links = [
    {
      id: 'linkedin',
      href: LINKEDIN_URL,
      Icon: LinkedInIcon,
      ...t.socials.linkedin,
    },
    {
      id: 'instagram',
      href: INSTAGRAM_URL,
      Icon: InstagramIcon,
      ...t.socials.instagram,
    },
  ]

  return (
    <div>
      <header className="mb-8">
        <span className="font-mono text-[11px] tracking-[0.2em] text-accent-soft/70 uppercase">
          {t.socials.eyebrow}
        </span>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {t.socials.heading}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45 sm:text-base">
          {t.socials.subtitle}
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {links.map(({ id, href, Icon, label, handle, note }) => (
          <li key={id}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col rounded-xl border border-white/10 bg-ink-900/70 p-5 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition group-hover:text-white">
                  <Icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/70" />
              </div>

              <span className="mt-4 text-sm font-medium text-white">{label}</span>
              <span className="mt-0.5 font-mono text-xs text-accent-soft/80">
                {handle}
              </span>
              <span className="mt-3 text-sm leading-relaxed text-white/45">
                {note}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-10 font-mono text-[11px] text-white/25">
        {t.socials.footer}
      </p>
    </div>
  )
}
