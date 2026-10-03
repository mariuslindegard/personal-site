import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { dictionaries, type Dict, type Lang } from './translations'

export type I18nContextValue = {
  lang: Lang
  /** Dictionary for the active language. */
  t: Dict
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

export const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'marius.lang'

/** Stored preference first, then the browser's own language. Defaults to English. */
function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'no') return stored
  } catch {
    // localStorage can throw in private mode — fall through to browser detection.
  }
  const browser = window.navigator.language?.toLowerCase() ?? ''
  return browser.startsWith('no') || browser.startsWith('nb') || browser.startsWith('nn')
    ? 'no'
    : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Ignore write failures; the language still applies for this session.
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggleLang = useCallback(
    () => setLangState((prev) => (prev === 'en' ? 'no' : 'en')),
    [],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ lang, t: dictionaries[lang], setLang, toggleLang }),
    [lang, setLang, toggleLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
