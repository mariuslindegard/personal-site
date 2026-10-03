import { useI18n } from '../i18n/useI18n'
import type { Lang } from '../i18n/translations'

const LANGS: Lang[] = ['en', 'no']

export default function LanguageToggle() {
  const { lang, setLang, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t.langToggle.aria}
      className="flex items-center rounded-full border border-white/12 bg-white/5 p-0.5 backdrop-blur-sm"
    >
      {LANGS.map((code) => {
        const isActive = lang === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={isActive}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase transition ${
              isActive
                ? 'bg-white text-ink-950'
                : 'text-white/55 hover:text-white/85'
            }`}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
