import type { ReactNode } from 'react'

type SectionProps = {
  id: string
  ariaLabel: string
  children: ReactNode
  /** Extra classes for the inner content wrapper. */
  className?: string
}

/**
 * One full-viewport section. `min-h-svh` (not `h-svh`) so the content can
 * still grow on short viewports instead of being clipped.
 */
export default function Section({
  id,
  ariaLabel,
  children,
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className="snap-section relative flex min-h-svh items-center px-6 py-14 sm:px-10 sm:py-20"
    >
      {/*
        On large screens the wrapper is given an exact height: 100svh minus the
        section's own vertical padding (5rem top + 5rem bottom). That makes the
        content box precisely one viewport tall, so children can flex to fill
        the leftover space instead of guessing at fixed pixel heights.
      */}
      <div
        className={`mx-auto w-full max-w-5xl lg:flex lg:h-[calc(100svh-10rem)] lg:min-h-0 lg:flex-col ${className ?? ''}`}
      >
        {children}
      </div>
    </section>
  )
}
