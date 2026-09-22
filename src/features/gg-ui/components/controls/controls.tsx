/**
 * The GG.Typing control shapes.
 *
 * - `PillGroup` — a single choice among short text labels, as native radios.
 * - `IconCircle` — an icon action, transparent until hovered or active.
 * - `IconLink` — the same shape, for navigation.
 * - `PillLink` — a pill for navigation, such as choosing a mode.
 * - `TogglePill` — a pill that is on or off, as a native checkbox.
 * - `Separator` — the hairline between groups.
 *
 * Choices use native radio inputs rather than buttons with ARIA: arrow keys,
 * "2 of 5" announcements and form semantics come from the browser, not from code
 * here.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'

import styles from './controls.module.css'

// --- Pill group --------------------------------------------------------

export interface PillOption<T extends string | number> {
  readonly value: T
  readonly label: string
  /** Spoken name when the visible label is terse, e.g. "60 words" for "60". */
  readonly accessibleLabel?: string
  /** A class for the label's face, where the label shows what it chooses — a typeface set in itself. */
  readonly faceClassName?: string
}

export interface PillGroupProps<T extends string | number> {
  readonly name: string
  readonly label: string
  readonly options: readonly PillOption<T>[]
  /** Null where the group holds no choice: another group has it. */
  readonly value: T | null
  readonly onChange: (value: T) => void
  /** Shown before the pills, where the group's name is worth reading. */
  readonly caption?: string
}

export const PillGroup = <T extends string | number>({
  name,
  label,
  options,
  value,
  onChange,
  caption,
}: PillGroupProps<T>) => (
  <div role="radiogroup" aria-label={label} className={styles.group}>
    {caption !== undefined && <span className={styles.caption}>{caption}</span>}
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
        <span
          className={option.faceClassName === undefined ? styles.pillFace : `${styles.pillFace} ${option.faceClassName}`}
          aria-hidden={option.accessibleLabel === undefined ? undefined : true}
          title={option.accessibleLabel}
        >
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

export interface IconLinkProps {
  readonly to: string
  readonly label: string
  readonly children: ReactNode
}

export const IconLink = ({ to, label, children }: IconLinkProps) => (
  <Link to={to} className={styles.iconCircle} aria-label={label} title={label}>
    {children}
  </Link>
)

export interface PillLinkProps {
  readonly to: string
  readonly label: string
  /** Said after the label, and shown as a tooltip. */
  readonly description: string
  readonly current: boolean
  readonly onClick?: (() => void) | undefined
}

export const PillLink = ({ to, label, description, current, onClick }: PillLinkProps) => (
  <Link
    to={to}
    className={styles.pillLink}
    aria-current={current ? 'page' : undefined}
    title={description}
    onClick={onClick}
  >
    <span className={styles.pillFace}>
      {label}
      <span className="visually-hidden">: {description}</span>
    </span>
  </Link>
)

// --- Toggle pill -------------------------------------------------------

export interface TogglePillProps {
  readonly label: string
  /** Said after the label, and shown as a tooltip. */
  readonly description: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}

/** The pill face over a native checkbox: Space toggles it, and it is announced as checked or not. */
export const TogglePill = ({ label, description, checked, onChange }: TogglePillProps) => (
  <label className={styles.pill} title={description}>
    <input
      type="checkbox"
      className={styles.nativeInput}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={`${label}: ${description}`}
    />
    <span className={styles.pillFace} aria-hidden="true">
      {label}
    </span>
  </label>
)

// --- Separator ---------------------------------------------------------

export const Separator = () => <span className={styles.separator} aria-hidden="true" />
