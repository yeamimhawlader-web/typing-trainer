/**
 * Every way to practise, as the front page lists them: what each is, and a
 * photograph shown as it is hovered.
 *
 * The photographs are from Unsplash and are served from this site rather than
 * from theirs. Loading them from Unsplash handed a visitor's address to a
 * company they had not chosen to visit, on a page that otherwise asks nothing
 * of anyone, and left the front page depending on somebody else's service
 * staying exactly as it is. They keep their Unsplash names, so any one of them
 * can still be traced back to the photographer who took it.
 */

import type { InteractiveListItem } from '@/components/ui/interactive-list-preview.tsx'
import { ROUTES } from '@app/routes.ts'

/** A photograph, cropped to the list's upright preview at 640x740. */
const photo = (id: string): string => `/photos/${id}.webp`

export const WAYS_TO_PRACTISE: InteractiveListItem[] = [
  {
    client: 'Typing Test',
    platform: 'Standard',
    services: 'Common words, timed or counted',
    img: photo('photo-1486312338219-ce68d2c6f44d'),
    href: ROUTES.gg,
  },
  {
    client: 'Hover Mode',
    platform: 'High speed trainer',
    services: 'A missed word repeats until it clears',
    img: photo('photo-1595225476474-87563907a212'),
    href: ROUTES.ggHover,
  },
  {
    client: 'Syllable Trainer',
    platform: 'High speed trainer',
    services: 'Long words, typed syllable by syllable',
    img: photo('photo-1507838153414-b4b713384a76'),
    href: ROUTES.ggSyllables,
  },
  {
    client: 'Your texts',
    platform: 'Your own words',
    services: 'Quotes, goals, and the words you actually use',
    img: photo('photo-1455390582262-044cdead277a'),
    href: ROUTES.ggTexts,
  },
  {
    client: 'Golden Nuggets',
    platform: 'Your trouble words',
    services: 'The words that keep getting away',
    img: photo('photo-1610375461246-83df859d849d'),
    href: ROUTES.ggNuggets,
  },
  {
    client: 'History',
    platform: 'Your tests',
    services: 'Your last 50 tests, each in detail',
    img: photo('photo-1501139083538-0139583c060f'),
    href: ROUTES.history,
  },
  {
    client: 'Statistics',
    platform: 'Your progress',
    services: 'Speed, accuracy and slow key pairs',
    img: photo('photo-1551288049-bebda4e38f71'),
    href: ROUTES.statistics,
  },
]
