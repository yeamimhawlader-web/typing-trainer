/**
 * The GG.Typing control shapes.
 *
 * - `Keycap` — a toggle that reads as a physical key.
 * - `PillGroup` — a single choice among short text labels, as native radios.
 * - `IconCircle` — an icon action or toggle, transparent until hovered or active.
 * - `SlidingTabs` — a two-or-more choice whose underline slides between options.
 *
 * Choices use native radio inputs rather than buttons with ARIA: arrow keys,
 * "2 of 5" announcements and form semantics come from the browser, not from code
 * here.
 */

import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

import styles from './controls.module.css'

// --- Keycap ------------------------------------------------------------

export interface KeycapProps {
  readonly legend: string
  readonly pressed: boolean
  readonly onPress: () => void
  readonly label?: string
}

export const Keycap = ({ legend, pressed, onPress, label }: KeycapProps) => (
  <button
    type="button"
    className={styles.keycap}
    aria-pressed={pressed}
    aria-label={label ?? legend}
    onClick={onPress}
  >
    <span className={styles.keycapLegend} aria-hidden="true">
      {legend}
    </span>
  </button>
)

// --- Pill group --------------------------------------------------------

export interface PillOption<T extends string | number> {
  readonly value: T
  readonly label: string
  /** Spoken name when the visible label is terse, e.g. "10 minutes" for "10". */
  readonly accessibleLabel?: string
}

export interface PillGroupProps<T extends string | number> {
  readonly name: string
  readonly label: string
  readonly options: readonly PillOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
}

export const PillGroup = <T extends string | number>({
  name,
  label,
  options,
  value,
  onChange,
}: PillGroupProps<T>) => (
  <div role="radiogroup" aria-label={label} className={styles.group}>
    {options.map((option) => (
      <label key={String(option.value)} className={styles.pill}>
        <input
          type="radio"
          className={styles.nativeInput}
          name={name}
          value={String(option.value)}
          checked={option.value === value}
          onChange={() => onChange(option.value)}
          aria-label={option.accessibleLabel}
        />
        <span className={styles.pillFace} aria-hidden={option.accessibleLabel === undefined ? undefined : true}>
          {option.label}
        </span>
      </label>
    ))}
  </div>
)

// --- Icon circle -------------------------------------------------------

export interface IconCircleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  readonly label: string
  readonly children: ReactNode
}

export const IconCircle = forwardRef<HTMLButtonElement, IconCircleProps>(
  ({ label, children, type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type} className={styles.iconCircle} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  ),
)

IconCircle.displayName = 'IconCircle'

// --- Separator ---------------------------------------------------------

export const Separator = () => <span className={styles.separator} aria-hidden="true" />

// --- Sliding tabs ------------------------------------------------------

export interface SlidingTabsProps<T extends string> {
  readonly name: string
  readonly label: string
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly value: T
  readonly onChange: (value: T) => void
}

/**
 * The underline is one element that moves. Its position is read from the
 * selected label when the choice changes or the row resizes — never per frame —
 * and applied as a transform, so the slide is pure compositor work.
 */
export const SlidingTabs = <T extends string>({ name, label, options, value, onChange }: SlidingTabsProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const [measured, setMeasured] = useState(false)

  useLayoutEffect(() => {
    const container = containerRef.current
    const indicator = indicatorRef.current
    if (container === null || indicator === null) return undefined

    const place = () => {
      const index = options.findIndex((option) => option.value === value)
      const selected = container.querySelectorAll<HTMLElement>('label > span')[index]
      if (selected === undefined) return
      indicator.style.transform = `translateX(${selected.offsetLeft}px) scaleX(${Math.max(1, selected.offsetWidth)})`
      setMeasured(true)
    }

    place()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(place)
    observer.observe(container)
    return () => observer.disconnect()
  }, [options, value])

  return (
    <div ref={containerRef} role="radiogroup" aria-label={label} className={styles.tabs}>
      {options.map((option) => (
        <label key={option.value} className={styles.tab}>
          <input
            type="radio"
            className={styles.nativeInput}
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className={styles.tabLabel}>{option.label}</span>
        </label>
      ))}
      <span ref={indicatorRef} className={styles.tabIndicator} data-measured={measured} aria-hidden="true" />
    </div>
  )
}
