/**
 * Route paths, in one place.
 *
 * Components link via `ROUTES.practice` rather than a '/practice' string
 * literal, so renaming a route is a single edit the compiler verifies.
 */

export const ROUTES = {
  home: '/',
  practice: '/practice',
  history: '/history',
  statistics: '/statistics',
  /** Pattern for the router; build real paths with `sessionDetailPath`. */
  sessionDetail: '/history/:sessionId',
  settings: '/settings',
  /** Pattern for the router; build real paths with `drillPath`. */
  drill: '/drill/:sequence',
  /**
   * GG.Typing: the primary typing screen, a full screen of its own outside the
   * application layout. Practice at the root, drills beneath it.
   */
  gg: '/gg',
  /** GG.Typing Hover Mode: a mistake focuses its word for repetition. */
  ggHover: '/gg/hover',
  /** GG.Typing Syllable Trainer: long words typed as syllables, in rhythm. */
  ggSyllables: '/gg/syllables',
  /** Hover Mode over the typist's Golden Nuggets. */
  ggHoverNuggets: '/gg/hover/nuggets',
  /** Golden Nuggets: words Hover Mode released before they cleared. */
  ggNuggets: '/gg/nuggets',
  /** Pattern for the router; build real paths with `drillPath`. */
  ggDrill: '/gg/drill/:sequence',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/**
 * A session's detail page.
 *
 * The id is encoded: it comes from `crypto.randomUUID` today, but a future
 * source could contain something a URL would mangle.
 */
export const sessionDetailPath = (sessionId: string): string =>
  `/history/${encodeURIComponent(sessionId)}`

/**
 * A drill for one character sequence, on GG.Typing.
 *
 * Encoded: the sequences come from real typed characters, so most are plain
 * letters, but nothing guarantees that and a `/` or `?` would change the route.
 */
export const drillPath = (sequence: string): string =>
  `/gg/drill/${encodeURIComponent(sequence)}`

/** The same drill on the classic screen, for direct access while both exist. */
export const classicDrillPath = (sequence: string): string =>
  `/drill/${encodeURIComponent(sequence)}`

/**
 * Where "practice" leads from anywhere in the application.
 *
 * GG.Typing is the primary typing screen. The classic one stays reachable at
 * `ROUTES.practice` — nothing is removed until GG.Typing has replaced it
 * outright — but links to practise go here.
 */
export const PRACTICE_PATH: string = ROUTES.gg
