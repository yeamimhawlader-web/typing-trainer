/**
 * Standard page frame: one h1, an optional lede, then content.
 *
 * Exists so that heading level and page rhythm are decided once rather than
 * re-invented per page. The document title is decided here too, from the same
 * string as the heading, so the tab and the page cannot disagree.
 */

import type { ReactNode } from 'react'

import { useDocumentTitle } from '@shared/lib'

import styles from './Page.module.css'

export interface PageProps {
  readonly title: string
  readonly description?: string
  readonly children?: ReactNode
}

export const Page = ({ title, description, children }: PageProps) => {
  useDocumentTitle(title)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {description !== undefined && <p className={styles.description}>{description}</p>}
      </header>
      {children}
    </div>
  )
}
