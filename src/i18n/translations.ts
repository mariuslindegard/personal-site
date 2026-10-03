export type Lang = 'en' | 'no'

export type ProjectItem = {
  id: string
  /** Folder name shown in the file tree. */
  dir: string
  name: string
  status: string
  tagline: string
  description: string
  tags: string[]
  url: string
  dashboard: string
  /** Filenames listed under the folder in the tree. */
  files: string[]
}

export type Dict = {
  langToggle: { aria: string }
  nav: { home: string; projects: string; socials: string; dashboard: string; sections: string }
  hero: {
    badge: string
    titleTop: string
    titleAccent: string
    subtitle: string
    signIn: string
    continueAs: string
    restoring: string
    scroll: string
    hint: string
    dismiss: string
  }
  projects: {
    eyebrow: string
    heading: string
    subtitle: string
    treeHint: string
    openSite: string
    openDashboard: string
    newTab: string
    alt: string
    more: string
    items: ProjectItem[]
  }
  socials: {
    eyebrow: string
    heading: string
    subtitle: string
    linkedin: { label: string; handle: string; note: string }
    instagram: { label: string; handle: string; note: string }
    footer: string
  }
}

export const en: Dict = {
  langToggle: { aria: 'Change language' },
  nav: {
    home: 'Home',
    projects: 'Projects',
    socials: 'Socials',
    dashboard: 'Dashboard',
    sections: 'Sections',
  },
  hero: {
    badge: 'Personal space',
    titleTop: 'Welcome to my',
    titleAccent: 'corner of the web',
    subtitle:
      'A quiet place on the internet. Sign in to continue to your dashboard, or scroll on to see what I have been building.',
    signIn: 'Sign in with Google',
    continueAs: 'Continue as',
    restoring: 'Restoring session…',
    scroll: 'Scroll',
    hint: 'Firebase isn’t configured yet. Copy .env.example to .env.local and add your keys, then restart the dev server.',
    dismiss: 'Dismiss error',
  },
  projects: {
    eyebrow: '~/projects',
    heading: 'Projects',
    subtitle:
      'A file-system view of what I build and run. Pick an entry to preview it.',
    treeHint: 'ls ~/projects',
    openSite: 'Open site',
    openDashboard: 'Dashboard',
    newTab: 'opens in a new tab',
    alt: 'Screenshot of the KI Chat website',
    more: 'more soon',
    items: [
      {
        id: 'kichat',
        dir: 'kichat',
        name: 'KI Chat',
        status: 'live',
        tagline: 'AI-powered customer service',
        description:
          'A chatbot platform that answers your customers from your own website content, so routine enquiries never reach the inbox. Live on a customer site in under 12 minutes, with a dashboard for conversations, leads and booking.',
        tags: ['AI', 'SaaS', 'Chatbot'],
        url: 'https://kichat.no',
        dashboard: 'https://dashboard.kichat.no',
        files: ['kichat.no', 'dashboard.kichat.no'],
      },
    ],
  },
  socials: {
    eyebrow: '~/socials',
    heading: 'Socials',
    subtitle: 'The usual places — come say hello.',
    linkedin: {
      label: 'LinkedIn',
      handle: 'Marius Berg Lindegård',
      note: 'Work, projects and the occasional update.',
    },
    instagram: {
      label: 'Instagram',
      handle: '@marius_lindegaard',
      note: 'Everything else.',
    },
    footer: '© 2026 Marius Berg Lindegård',
  },
}

export const no: Dict = {
  langToggle: { aria: 'Bytt språk' },
  nav: {
    home: 'Hjem',
    projects: 'Prosjekter',
    socials: 'Sosiale medier',
    dashboard: 'Dashbord',
    sections: 'Seksjoner',
  },
  hero: {
    badge: 'Min lille plass',
    titleTop: 'Velkommen til min',
    titleAccent: 'del av nettet',
    subtitle:
      'Et rolig sted på internett. Logg inn for å komme til dashbordet, eller bla videre for å se hva jeg har bygget.',
    signIn: 'Logg inn med Google',
    continueAs: 'Fortsett som',
    restoring: 'Gjenoppretter økt…',
    scroll: 'Bla',
    hint: 'Firebase er ikke konfigurert ennå. Kopier .env.example til .env.local, fyll inn nøklene og start utviklingsserveren på nytt.',
    dismiss: 'Lukk feilmelding',
  },
  projects: {
    eyebrow: '~/prosjekter',
    heading: 'Prosjekter',
    subtitle:
      'Et filsystem-aktig innblikk i det jeg bygger og drifter. Velg en oppføring for å se nærmere på den.',
    treeHint: 'ls ~/prosjekter',
    openSite: 'Åpne nettsted',
    openDashboard: 'Dashbord',
    newTab: 'åpnes i ny fane',
    alt: 'Skjermbilde av nettstedet KI Chat',
    more: 'mer kommer',
    items: [
      {
        id: 'kichat',
        dir: 'kichat',
        name: 'KI Chat',
        status: 'live',
        tagline: 'AI-drevet kundeservice',
        description:
          'En chatbotplattform som svarer kundene dine ut fra innholdet på din egen nettside, slik at rutinehenvendelser aldri når innboksen. Live på kundens nettside på under 12 minutter, med dashbord for samtaler, leads og booking.',
        tags: ['KI', 'SaaS', 'Chatbot'],
        url: 'https://kichat.no',
        dashboard: 'https://dashboard.kichat.no',
        files: ['kichat.no', 'dashboard.kichat.no'],
      },
    ],
  },
  socials: {
    eyebrow: '~/sosiale',
    heading: 'Sosiale medier',
    subtitle: 'De vanlige stedene — si gjerne hei.',
    linkedin: {
      label: 'LinkedIn',
      handle: 'Marius Berg Lindegård',
      note: 'Jobb, prosjekter og en og annen oppdatering.',
    },
    instagram: {
      label: 'Instagram',
      handle: '@marius_lindegaard',
      note: 'Alt det andre.',
    },
    footer: '© 2026 Marius Berg Lindegård',
  },
}

export const dictionaries: Record<Lang, Dict> = { en, no }
