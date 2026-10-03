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
  nav: {
    home: string
    projects: string
    github: string
    about: string
    socials: string
    dashboard: string
    sections: string
  }
  hero: {
    /** Short timezone label shown next to the live clock. */
    clockLabel: string
    /** Tooltip for the live clock. */
    clockTitle: string
    titleTop: string
    titleAccent: string
    subtitle: string
    signIn: string
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
  github: {
    eyebrow: string
    heading: string
    subtitle: string
    openProfile: string
    viewAll: string
    reposHeading: string
    repositories: string
    followers: string
    following: string
    noDescription: string
    updated: string
    cached: string
  }
  about: {
    eyebrow: string
    heading: string
    intro: string
    likesLabel: string
    likes: string[]
    photoAlt: string
    contactHeading: string
    contactBody: string
    emailLabel: string
    phoneLabel: string
  }
  socials: {
    eyebrow: string
    heading: string
    subtitle: string
    linkedin: { label: string; handle: string; note: string }
    instagram: { label: string; handle: string; note: string }
    github: { label: string; handle: string; note: string }
    footer: string
  }
}

export const en: Dict = {
  langToggle: { aria: 'Change language' },
  nav: {
    home: 'Home',
    projects: 'Projects',
    github: 'GitHub',
    about: 'About',
    socials: 'Socials',
    dashboard: 'Dashboard',
    sections: 'Sections',
  },
  hero: {
    clockLabel: 'Oslo',
    clockTitle: 'Local time in Oslo',
    titleTop: 'Welcome to my',
    titleAccent: 'corner of the internet',
    subtitle: 'Scroll on to see what I have built.',
    signIn: 'Sign in with Google',
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
  github: {
    eyebrow: '~/github',
    heading: 'GitHub',
    subtitle:
      'Public repositories and the code behind the things on this page.',
    openProfile: 'Open profile',
    viewAll: 'View all repositories',
    reposHeading: 'Recently pushed',
    repositories: 'Repositories',
    followers: 'Followers',
    following: 'Following',
    noDescription: 'No description yet.',
    updated: 'Updated',
    cached: 'Showing a cached snapshot — the GitHub API is unreachable right now.',
  },
  about: {
    eyebrow: '~/about',
    heading: 'About me',
    intro:
      'I build software and systems, and I like to understand how things work all the way down. If it can be taken apart, automated or self-hosted, I am probably already reading about it.',
    likesLabel: 'What I like',
    likes: [
      'Nature',
      'Hikes',
      'Programming',
      'Systems',
      'Motorcycles',
      'People',
    ],
    photoAlt: 'Marius outdoors, wearing a backpack',
    contactHeading: 'Want to work with me?',
    contactBody:
      'I am open to interesting projects, collaborations and good conversations. The fastest way to reach me is by email.',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
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
    github: {
      label: 'GitHub',
      handle: '@mariuslindegard',
      note: 'Code, side projects and experiments.',
    },
    footer: '© 2026 Marius Berg Lindegård',
  },
}

export const no: Dict = {
  langToggle: { aria: 'Bytt språk' },
  nav: {
    home: 'Hjem',
    projects: 'Prosjekter',
    github: 'GitHub',
    about: 'Om meg',
    socials: 'Sosiale medier',
    dashboard: 'Dashbord',
    sections: 'Seksjoner',
  },
  hero: {
    clockLabel: 'Oslo',
    clockTitle: 'Lokal tid i Oslo',
    titleTop: 'Velkommen til mitt',
    titleAccent: 'internett hjørne',
    subtitle: 'Bla videre for å se hva jeg har bygget.',
    signIn: 'Logg inn med Google',
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
  github: {
    eyebrow: '~/github',
    heading: 'GitHub',
    subtitle:
      'Offentlige repositorier og koden bak tingene på denne siden.',
    openProfile: 'Åpne profil',
    viewAll: 'Se alle repositorier',
    reposHeading: 'Nylig pushet',
    repositories: 'Repositorier',
    followers: 'Følgere',
    following: 'Følger',
    noDescription: 'Ingen beskrivelse ennå.',
    updated: 'Oppdatert',
    cached:
      'Viser et mellomlagret øyeblikksbilde — GitHub-API-et er utilgjengelig akkurat nå.',
  },
  about: {
    eyebrow: '~/om-meg',
    heading: 'Om meg',
    intro:
      'Jeg bygger programvare og systemer, og liker å forstå hvordan ting henger sammen helt ned til bunnen. Hvis det kan tas fra hverandre, automatiseres eller driftes selv, har jeg sannsynligvis allerede lest om det.',
    likesLabel: 'Det jeg liker',
    likes: [
      'Natur',
      'Fjellturer',
      'Programmering',
      'Systemer',
      'Motorsykler',
      'Mennesker',
    ],
    photoAlt: 'Marius utendørs, med ryggsekk',
    contactHeading: 'Vil du jobbe med meg?',
    contactBody:
      'Jeg er åpen for interessante prosjekter, samarbeid og gode samtaler. Raskeste vei til meg er e-post.',
    emailLabel: 'E-post',
    phoneLabel: 'Telefon',
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
    github: {
      label: 'GitHub',
      handle: '@mariuslindegard',
      note: 'Kode, sideprosjekter og eksperimenter.',
    },
    footer: '© 2026 Marius Berg Lindegård',
  },
}

export const dictionaries: Record<Lang, Dict> = { en, no }
