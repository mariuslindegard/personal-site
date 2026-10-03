import { useEffect, useState } from 'react'

/** The site owner's timezone — the clock shows their local time, not the visitor's. */
const TIME_ZONE = 'Europe/Oslo'

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function readTime() {
  return formatter.format(new Date())
}

type LocalClockProps = {
  /** Short timezone label, e.g. "Oslo". */
  label: string
  /** Full description for the tooltip, e.g. "Local time in Oslo". */
  title: string
}

/**
 * Live clock in the owner's timezone, used as the hero badge.
 *
 * Re-arms the timer against the wall clock each tick rather than using a fixed
 * 1s interval, so the readout never skips or repeats a second and it corrects
 * itself straight away after the tab has been throttled in the background.
 */
export default function LocalClock({ label, title }: LocalClockProps) {
  const [time, setTime] = useState(readTime)

  useEffect(() => {
    let timer: number

    const tick = () => {
      setTime(readTime())
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    }

    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <span title={title} className="whitespace-nowrap">
      <span className="text-white/40">{label}</span>{' '}
      <span className="tabular-nums text-white/75">{time}</span>
    </span>
  )
}
