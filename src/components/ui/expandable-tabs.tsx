/**
 * Expandable tabs: a row of icons where the chosen one opens to show its name.
 *
 * From the shadcn-style ExpandableTabs component (framer-motion underneath),
 * with three additions so it can be navigation as well as a toolbar:
 *
 *   - `selected` makes it controlled: the caller says which tab is open (the
 *     page you are on), and a click outside closes nothing. Left out, it keeps
 *     its own choice and a click outside clears it, as the original does.
 *   - A tab with an `href` is a link, not a button: it can be opened in a new
 *     tab, and a plain click is handed to `onChange` so a router can take it.
 *     The open link is `aria-current="page"`.
 *   - Every tab is named by its title even while only its icon shows, so a
 *     screen reader hears "History", and a pointer resting on it says so too.
 *
 * Motion follows the system's reduced-motion setting: with it on, a tab opens
 * at once rather than sliding. framer-motion is loaded in its smaller form
 * (`LazyMotion` with `domAnimation`, and `m` for `motion`): it sits in the top
 * bar on every page, and the full library more than doubled what every page
 * loads first.
 */

import * as React from 'react'
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
  type Transition,
} from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { useOnClickOutside } from 'usehooks-ts'

import { cn } from '@/lib/utils'

interface Tab {
  title: string
  icon: LucideIcon
  /** Makes the tab a link to here. */
  href?: string
  type?: never
}

interface Separator {
  type: 'separator'
  title?: never
  icon?: never
  href?: never
}

export type TabItem = Tab | Separator

interface ExpandableTabsProps {
  tabs: readonly TabItem[]
  className?: string
  activeColor?: string
  /** The open tab, for a caller that decides it. Left out, the tabs decide. */
  selected?: number | null
  onChange?: (index: number | null) => void
  'aria-label'?: string
}

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: '.5rem',
    paddingRight: '.5rem',
  },
  animate: (isSelected: boolean) => ({
    gap: isSelected ? '.5rem' : 0,
    paddingLeft: isSelected ? '1rem' : '.5rem',
    paddingRight: isSelected ? '1rem' : '.5rem',
  }),
}

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: 'auto', opacity: 1 },
  exit: { width: 0, opacity: 0 },
}

const transition: Transition = { delay: 0.1, type: 'spring', bounce: 0, duration: 0.6 }

/** A click the browser should keep: a new tab, a new window, a download. */
const isModifiedClick = (event: React.MouseEvent): boolean =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

const SeparatorLine = () => (
  <div className="mx-1 h-[24px] w-[1.2px] bg-border" aria-hidden="true" />
)

export function ExpandableTabs({
  tabs,
  className,
  activeColor = 'text-primary',
  selected: controlled,
  onChange,
  'aria-label': label,
}: ExpandableTabsProps) {
  const [chosen, setChosen] = React.useState<number | null>(null)
  const isControlled = controlled !== undefined
  const selected = isControlled ? controlled : chosen
  const outsideClickRef = React.useRef<HTMLDivElement>(null)

  useOnClickOutside(outsideClickRef as React.RefObject<HTMLElement>, () => {
    if (isControlled) return
    setChosen(null)
    onChange?.(null)
  })

  const handleSelect = (index: number) => {
    if (!isControlled) setChosen(index)
    onChange?.(index)
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div
          ref={outsideClickRef}
          aria-label={label}
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-2xl border bg-background p-1 shadow-sm',
            className,
          )}
        >
          {tabs.map((tab, index) => {
            // Named by the tab before it: a separator has nothing of its own.
            if (tab.type === 'separator')
              return (
                <SeparatorLine key={`after-${tabs[index - 1]?.title ?? 'start'}`} />
              )

            const Icon = tab.icon
            const isSelected = selected === index
            const shared = {
              variants: buttonVariants,
              initial: false,
              animate: 'animate',
              custom: isSelected,
              transition,
              'aria-label': tab.title,
              title: tab.title,
              className: cn(
                'relative flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-300',
                isSelected
                  ? cn('bg-muted', activeColor)
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ),
            } as const
            const content = (
              <>
                <Icon size={20} aria-hidden="true" />
                <AnimatePresence initial={false}>
                  {isSelected && (
                    <m.span
                      variants={spanVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={transition}
                      className="overflow-hidden whitespace-nowrap"
                      aria-hidden="true"
                    >
                      {tab.title}
                    </m.span>
                  )}
                </AnimatePresence>
              </>
            )

            return tab.href === undefined ? (
              <m.button
                key={tab.title}
                type="button"
                {...shared}
                onClick={() => handleSelect(index)}
              >
                {content}
              </m.button>
            ) : (
              <m.a
                key={tab.title}
                href={tab.href}
                {...shared}
                aria-current={isSelected ? 'page' : undefined}
                onClick={(event) => {
                  if (isModifiedClick(event)) return
                  event.preventDefault()
                  handleSelect(index)
                }}
              >
                {content}
              </m.a>
            )
          })}
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}
