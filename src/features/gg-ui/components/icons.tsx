/**
 * The GG.Typing icon set.
 *
 * Drawn for this UI on one 24-unit grid with a 1.75 stroke, so they sit
 * together at 18–20px. Every icon uses `currentColor`, which means it follows
 * the theme and the cross-fade without knowing either exists. All are
 * decorative: the control around each one carries the accessible name.
 */

import { useId, type SVGProps } from 'react'

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

export const UsersIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5" />
    <path d="M15.5 5.6a3.25 3.25 0 0 1 0 6" />
    <path d="M17.2 14.4c1.8.6 3 2.2 3.3 4.6" />
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

export const GlobeIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z" />
  </Icon>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Icon width="16" height="16" {...props}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
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

export const MuteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9.5h3l4.5-4v13l-4.5-4H4Z" />
    <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
  </Icon>
)

export const SmileIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14.2c.9 1.3 2 1.9 3.5 1.9s2.6-.6 3.5-1.9" />
    <circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none" />
  </Icon>
)

/**
 * A solid face: the features are cut out of the disc rather than drawn on it,
 * so they show whatever is behind the icon in any theme.
 */
export const SmileFilledIcon = (props: IconProps) => {
  // Mask ids are document-wide; two faces on one page must not share one.
  const maskId = `gg-smile-${useId().replace(/:/g, '')}`

  return (
    <Icon {...props}>
      <defs>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <circle cx="9" cy="10" r="1.1" fill="black" />
          <circle cx="15" cy="10" r="1.1" fill="black" />
          <path d="M8.5 14c.9 1.4 2 2.1 3.5 2.1s2.6-.7 3.5-2.1" stroke="black" strokeWidth="1.75" fill="none" />
        </mask>
      </defs>
      <circle cx="12" cy="12" r="9.25" fill="currentColor" stroke="none" mask={`url(#${maskId})`} />
    </Icon>
  )
}

export const ChartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 19.5h16" />
    <path d="m5 15 4.5-4.5 3.5 3 6-6.5" />
    <path d="M15 7h4v4" />
  </Icon>
)

export const TimerIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M12 13.5V10M10 3.5h4M18.3 7.2l1.2-1.2" />
  </Icon>
)

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.8 12S6.2 5.5 12 5.5 21.2 12 21.2 12 17.8 18.5 12 18.5 2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="2.75" />
  </Icon>
)

export const EditIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.5 5.5l4 4L9 19H5v-4Z" />
    <path d="M12.5 7.5l4 4" />
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
