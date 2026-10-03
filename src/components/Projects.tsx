import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { ArrowUpRight } from './Icons'

/** Shared chrome for the panes, so the tree and preview line up visually. */
const paneClass =
  'overflow-hidden rounded-xl border border-white/10 bg-ink-900/70 backdrop-blur-sm'

/** Fake window title-bar used by both panes. */
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

export default function Projects() {
  const { t } = useI18n()
  const items = t.projects.items
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '')

  const active = items.find((item) => item.id === selectedId) ?? items[0]
  if (!active) return null

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <header className="mb-6 shrink-0 sm:mb-7">
        <span className="font-mono text-[11px] tracking-[0.2em] text-accent-soft/70 uppercase">
          {t.projects.eyebrow}
        </span>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {t.projects.heading}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45 sm:text-base">
          {t.projects.subtitle}
        </p>
      </header>

      {/*
        On large screens the panes take exactly the space the header left over
        (the parent is a flex column with a definite height). That is what lets
        the preview image flex to fill its pane — without it the image would
        drive the height and the section would spill past one viewport.
      */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-5">
        {/* File tree */}
        <div className={`${paneClass} flex min-h-0 flex-col`}>
          <TitleBar label={t.projects.eyebrow} />

          <div className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-[13px]">
            <p className="text-white/30">$ {t.projects.treeHint}</p>

            <ul className="mt-2">
              {items.map((item, index) => {
                const isLast = index === items.length - 1
                const isSelected = item.id === active.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                        isSelected
                          ? 'bg-accent/12 text-accent-soft'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="text-white/25">{isLast ? '└──' : '├──'}</span>
                      <span className="font-medium">{item.dir}/</span>
                    </button>

                    <ul className="ml-3">
                      {item.files.map((file, fileIndex) => {
                        const fileIsLast = fileIndex === item.files.length - 1
                        return (
                          <li
                            key={file}
                            className="flex items-center gap-2 px-2 py-1 pl-4 text-white/35"
                          >
                            <span className="text-white/20">
                              {isLast && fileIsLast ? '└──' : '├──'}
                            </span>
                            {file}
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}

              <li className="flex items-center gap-2 px-2 py-1.5 text-white/20">
                <span>└──</span>
                <span className="italic">{t.projects.more}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Preview */}
        <article className={`${paneClass} flex min-h-0 flex-col`}>
          <TitleBar label={active.url.replace(/^https?:\/\//, '')} />

          <a
            href={active.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${active.name} — ${t.projects.newTab}`}
            className="relative aspect-[16/10] shrink-0 overflow-hidden bg-ink-950 lg:aspect-auto lg:min-h-0 lg:flex-1"
          >
            <img
              src="/kichat-preview.jpg"
              alt={t.projects.alt}
              loading="lazy"
              className="size-full object-cover object-top transition duration-500 hover:scale-[1.02]"
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10 ring-inset" />
          </a>

          <div className="shrink-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-semibold text-white">{active.name}</h3>
              <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-accent-soft uppercase">
                {active.status}
              </span>
            </div>

            <p className="mt-1.5 text-sm text-white/70">{active.tagline}</p>
            <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-white/45 [@media(max-height:720px)]:hidden">
              {active.description}
            </p>

            <ul className="mt-3 flex flex-wrap gap-1.5 [@media(max-height:700px)]:hidden">
              {active.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] tracking-wide text-white/50"
                >
                  {tag}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-950 transition hover:shadow-[0_0_32px_-8px_rgba(122,162,255,0.75)]"
              >
                {t.projects.openSite}
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <a
                href={active.dashboard}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
              >
                {t.projects.openDashboard}
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
