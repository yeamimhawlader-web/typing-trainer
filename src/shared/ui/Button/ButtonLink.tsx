/**
 * A link that looks like a button.
 *
 * Navigation is a link and an action is a button, even when the two want the
 * same styling. Wrapping a `<button>` in an `<a>` — the obvious way to reuse
 * `Button` here — nests two interactive elements, which is invalid HTML and
 * reaches assistive technology as something neither of them is.
 *
 * It borrows `Button`'s stylesheet rather than restating it, so the two cannot
 * drift apart.
 */

import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

import { cx } from '@shared/lib'

import styles from './Button.module.css'
import type { ButtonVariant } from './Button.tsx'

export interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  readonly variant?: ButtonVariant
  readonly className?: string
  readonly children: ReactNode
}

export const ButtonLink = ({
  variant = 'secondary',
  className,
  children,
  ...rest
}: ButtonLinkProps) => (
  <Link className={cx(styles.button, styles[variant], className)} {...rest}>
    {children}
  </Link>
)
