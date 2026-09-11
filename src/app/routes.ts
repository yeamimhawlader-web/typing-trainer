/**
 * Route paths, in one place.
 *
 * Components link via `ROUTES.practice` rather than a '/practice' string
 * literal, so renaming a route is a single edit the compiler verifies.
 */

export const ROUTES = {
  home: '/',
  practice: '/practice',
  settings: '/settings',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
