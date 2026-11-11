/**
 * A page with nothing on it yet: what is missing, and the one thing to do
 * about it.
 *
 * A sentence alone leaves the page a dead end. The action is a button, not a
 * link inside the sentence, so the way forward is the most visible thing here.
 */

import type { ReactNode } from 'react'

import { ButtonLink } from '../Button/ButtonLink.tsx'

import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  /** What is not here yet, in a few words. */
  readonly title: string
  /** What will be here, and when. */
  readonly children: ReactNode
  /** Where the action leads, and what it says. */
  readonly action: { readonly to: string; readonly label: string }
}

export const EmptyState = ({ title, children, action }: EmptyStateProps) => (
  <div className={styles.empty}>
    <p className={styles.title}>{title}</p>
    <p className={styles.body}>{children}</p>
    <ButtonLink to={action.to} variant="primary" className={styles.action}>
      {action.label}
    </ButtonLink>
  </div>
)
