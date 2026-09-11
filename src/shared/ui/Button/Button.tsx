/**
 * The one button primitive.
 *
 * Shared UI lives here when it is genuinely generic. Anything that knows about
 * typing sessions belongs in a feature, not in shared/.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cx } from '@shared/lib'

import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  /**
   * Marks this button as a toggle and gives its state. Left undefined for
   * ordinary buttons — `aria-pressed` on a non-toggle misreports it to screen
   * readers, so it is only emitted when a caller opts in here.
   */
  readonly selected?: boolean
  readonly children: ReactNode
}

export const Button = ({
  variant = 'secondary',
  selected,
  className,
  children,
  ...rest
}: ButtonProps) => {
  const classNames = cx(
    styles.button,
    styles[variant],
    selected === true && styles.selected,
    className,
  )

  return (
    <button
      type="button"
      className={classNames}
      {...(selected === undefined ? {} : { 'aria-pressed': selected })}
      {...rest}
    >
      {children}
    </button>
  )
}
