import { useEffect, useState } from 'react'

export type SectionNavItem = { id: string; label: string }

type SectionNavProps = {
  items: SectionNavItem[]
  ariaLabel: string
}

/**
 * Right-hand dot navigation. Highlights the section currently filling the
 * viewport via IntersectionObserver; links use plain `#id` anchors so the
 * scroll container's `scroll-behavior: smooth` handles the motion.
 */
export default function SectionNav({ items, ariaLabel }: SectionNavProps) {
  const [active, setActive] = useState(items[0]?.id ?? '')

  useEffect(() => {
    const nodes = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null)

    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      { threshold: 0.55 },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [items])

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed top-1/2 right-5 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 sm:flex"
    >
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={isActive ? 'location' : undefined}
            className="group flex items-center gap-2.5"
          >
            <span
              className={`text-[10px] tracking-[0.18em] uppercase transition-colors ${
                isActive
                  ? 'text-white/75'
                  : 'text-white/0 group-hover:text-white/50'
              }`}
            >
              {item.label}
            </span>
            <span
              className={`h-px transition-all duration-300 ${
                isActive
                  ? 'w-7 bg-white/90'
                  : 'w-4 bg-white/30 group-hover:w-6 group-hover:bg-white/60'
              }`}
            />
          </a>
        )
      })}
    </nav>
  )
}
