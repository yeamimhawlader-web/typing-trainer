/**
 * The GG.Typing icon set.
 *
 * Drawn for this UI on one 24-unit grid with a 1.75 stroke, so they sit
 * together at 18–20px. Every icon uses `currentColor`, which means it follows
 * the theme without knowing one exists. All are
 * decorative: the control around each one carries the accessible name.
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const Icon = ({ children, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
)

/** The mark: the word stream's own block cursor, sitting on a baseline. */
export const LogoGlyph = (props: IconProps) => (
  <Icon {...props}>
    <rect x="6" y="6.5" width="7" height="10" rx="1.5" fill="currentColor" stroke="none" />
    <path d="M15.5 16.5h3" />
  </Icon>
)

export const PaletteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6h2.1c2.4 0 3.9-1.6 3.9-4C20.5 6.6 16.7 3.5 12 3.5Z" />
    <circle cx="7.8" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="7.3" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7.6" r="1" fill="currentColor" stroke="none" />
  </Icon>
)

export const RestartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4" />
    <path d="M4.5 4.5v4h4" />
  </Icon>
)

/** An eight-tooth cog. Drawn as one outline so it cannot be mistaken for the sun. */
export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.41 5.39L9.77 5.26L10.21 3.18L13.79 3.18L14.23 5.26L14.85 5.5L15.19 5.66L16.97 4.5L19.5 7.03L18.34 8.81L18.61 9.41L18.74 9.77L20.82 10.21L20.82 13.79L18.74 14.23L18.5 14.85L18.34 15.19L19.5 16.97L16.97 19.5L15.19 18.34L14.59 18.61L14.23 18.74L13.79 20.82L10.21 20.82L9.77 18.74L9.15 18.5L8.81 18.34L7.03 19.5L4.5 16.97L5.66 15.19L5.39 14.59L5.26 14.23L3.18 13.79L3.18 10.21L5.26 9.77L5.5 9.15L5.66 8.81L4.5 7.03L7.03 4.5L8.81 5.66Z" />
    <circle cx="12" cy="12" r="2.75" />
  </Icon>
)

export const SunIcon = (props: IconProps) => (
  <Icon width="18" height="18" {...props}>
    <circle cx="12" cy="12" r="3.75" />
    <path d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6 17 7M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
  </Icon>
)

export const MoonIcon = (props: IconProps) => (
  <Icon width="18" height="18" {...props}>
    <path d="M19.5 14.6A7.5 7.5 0 0 1 9.4 4.5a7.5 7.5 0 1 0 10.1 10.1Z" />
  </Icon>
)
