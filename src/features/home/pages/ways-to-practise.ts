/**
 * Every way to practise, as the front page lists them: what each is, and a
 * photograph (from Unsplash) shown as it is hovered.
 */

import type { InteractiveListItem } from '@/components/ui/interactive-list-preview.tsx'
import { ROUTES } from '@app/routes.ts'

/** An Unsplash photograph, cropped to the list's upright preview. */
const unsplash = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&h=740&q=75`

export const WAYS_TO_PRACTISE: InteractiveListItem[] = [
  {
    client: 'Typing Test',
    platform: 'Standard',
    services: 'Common words, timed or counted',
    img: unsplash('photo-1486312338219-ce68d2c6f44d'),
    href: ROUTES.gg,
  },
  {
    client: 'Hover Mode',
    platform: 'High speed trainer',
    services: 'A missed word repeats until it clears',
    img: unsplash('photo-1595225476474-87563907a212'),
    href: ROUTES.ggHover,
  },
  {
    client: 'Syllable Trainer',
    platform: 'High speed trainer',
    services: 'Long words, typed syllable by syllable',
    img: unsplash('photo-1507838153414-b4b713384a76'),
    href: ROUTES.ggSyllables,
  },
  {
    client: 'Your texts',
    platform: 'Your own words',
    services: 'Quotes, goals, and the words you actually use',
    img: unsplash('photo-1455390582262-044cdead277a'),
    href: ROUTES.ggTexts,
  },
  {
    client: 'Golden Nuggets',
    platform: 'Your trouble words',
    services: 'The words that keep getting away',
    img: unsplash('photo-1610375461246-83df859d849d'),
    href: ROUTES.ggNuggets,
  },
  {
    client: 'History',
    platform: 'Your tests',
    services: 'Your last 50 tests, each in detail',
    img: unsplash('photo-1501139083538-0139583c060f'),
    href: ROUTES.history,
  },
  {
    client: 'Statistics',
    platform: 'Your progress',
    services: 'Speed, accuracy and slow key pairs',
    img: unsplash('photo-1551288049-bebda4e38f71'),
    href: ROUTES.statistics,
  },
]
