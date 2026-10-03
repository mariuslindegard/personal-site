import { MailIcon, PhoneIcon } from './Icons'
import { useI18n } from '../i18n/useI18n'

const EMAIL = 'marius@mariusbl.no'
const PHONE_DISPLAY = '+47 987 64 237'
/** tel: links must not contain spaces. */
const PHONE_HREF = '+4798764237'

export default function About() {
  const { t } = useI18n()

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <header className="mb-6 shrink-0 sm:mb-7">
        <span className="font-mono text-[11px] tracking-[0.2em] text-accent-soft/70 uppercase">
          {t.about.eyebrow}
        </span>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {t.about.heading}
        </h2>
      </header>

      <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-7">
        {/* Photo */}
        <figure className="relative min-h-0 overflow-hidden rounded-xl border border-white/10 bg-ink-900/70 backdrop-blur-sm">
          <img
            src="/about-me.jpg"
            alt={t.about.photoAlt}
            width={665}
            height={1182}
            loading="lazy"
            decoding="async"
            /*
              On large screens the photo fills whatever height the pane has;
              object-cover keeps the framing sane instead of letterboxing.
              Below `lg` it gets a fixed ratio so it can't run away vertically.
            */
            className="h-full max-h-[46svh] w-full object-cover object-center lg:max-h-none"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/55 via-transparent to-transparent"
          />
        </figure>

        {/* Text + contact */}
        <div className="flex min-h-0 flex-col lg:overflow-y-auto">
          <p className="text-sm leading-relaxed text-pretty text-white/60 sm:text-base">
            {t.about.intro}
          </p>

          <div className="mt-5">
            <span className="font-mono text-[11px] tracking-[0.18em] text-white/35 uppercase">
              {t.about.likesLabel}
            </span>
            <ul className="mt-3 flex flex-wrap gap-2">
              {t.about.likes.map((like) => (
                <li
                  key={like}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm transition hover:border-accent/40 hover:text-white"
                >
                  {like}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact card */}
          <div className="mt-6 rounded-xl border border-accent/25 bg-accent/[0.06] p-5 backdrop-blur-sm sm:p-6">
            <h3 className="text-lg font-medium text-white">
              {t.about.contactHeading}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {t.about.contactBody}
            </p>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
              <a
                href={`mailto:${EMAIL}`}
                className="group inline-flex items-center gap-2.5 rounded-lg border border-white/12 bg-ink-950/50 px-3.5 py-2.5 text-sm text-white/85 transition hover:border-accent/50 hover:text-white"
              >
                <MailIcon className="size-4 shrink-0 text-accent-soft/80" />
                <span className="flex flex-col leading-tight sm:flex-row sm:items-center sm:gap-2">
                  <span className="font-mono text-[10px] tracking-wider text-white/35 uppercase">
                    {t.about.emailLabel}
                  </span>
                  <span className="break-all">{EMAIL}</span>
                </span>
              </a>

              <a
                href={`tel:${PHONE_HREF}`}
                className="group inline-flex items-center gap-2.5 rounded-lg border border-white/12 bg-ink-950/50 px-3.5 py-2.5 text-sm text-white/85 transition hover:border-accent/50 hover:text-white"
              >
                <PhoneIcon className="size-4 shrink-0 text-accent-soft/80" />
                <span className="flex flex-col leading-tight sm:flex-row sm:items-center sm:gap-2">
                  <span className="font-mono text-[10px] tracking-wider text-white/35 uppercase">
                    {t.about.phoneLabel}
                  </span>
                  <span>{PHONE_DISPLAY}</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
