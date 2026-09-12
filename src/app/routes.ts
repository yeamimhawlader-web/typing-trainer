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
 * A drill for one character sequence.
 *
 * Encoded: the sequences come from real typed characters, so most are plain
 * letters, but nothing guarantees that and a `/` or `?` would change the route.
 */
export const drillPath = (sequence: string): string =>
  `/drill/${encodeURIComponent(sequence)}`
