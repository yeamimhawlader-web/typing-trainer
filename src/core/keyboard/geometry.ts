/**
 * The keyboard as a place: where each key is, which finger is taught to press
 * it, and how far it is from one key to the next.
 *
 * ## The layout
 *
 * A standard QWERTY board, one unit to a key. The rows are staggered as they
 * are on a real one, not laid out as a grid: the top letter row sits half a key
 * to the right of the number row, the home row a quarter further, the bottom
 * row half a key further again. So Q to A is not straight down — it is a
 * quarter of a key across and one down — and that is the difference between
 * measuring a keyboard and measuring a table.
 *
 * ## What is measured
 *
 * The straight-line distance from the centre of one key to the centre of the
 * next, summed along a word:
 *
 *     D(w) = Σ √((x[i+1] − x[i])² + (y[i+1] − y[i])²)
 *
 * It is a distance, in key widths, and nothing more. It is not how far a
 * finger moves — two hands share the work, and each returns home — and it is
 * not how hard a word is to type or how fast it will be typed. A short word can
 * still be awkward. The numbers are here to be looked at beside the timings the
 * application really measures, never in place of them.
 *
 * ## Fingers
 *
 * The assignment is the conventional touch-typing one, by column. It says which
 * finger a typing course would teach for a key, not which finger a given
 * typist uses: the application sees keys and times, never hands.
 *
 * No DOM, no React: data and arithmetic.
 */

export type Hand = 'left' | 'right'

export type Finger =
  | 'leftPinky'
  | 'leftRing'
  | 'leftMiddle'
  | 'leftIndex'
  | 'rightIndex'
  | 'rightMiddle'
  | 'rightRing'
  | 'rightPinky'

export interface KeyPosition {
  /** The key, as the unshifted character it types. */
  readonly key: string
  /** Its centre, in key widths from the centre of the number row's first key. */
  readonly x: number
  /** Its row: 0 the number row, 1 the top letter row, 2 the home row, 3 the bottom row. */
  readonly y: number
  readonly hand: Hand
  readonly finger: Finger
}

/** Each row's keys, left to right, and how far its first key sits to the right of the number row's. */
export const KEYBOARD_ROWS: readonly { readonly keys: string; readonly offset: number; readonly y: number }[] = [
  { keys: '1234567890', offset: 0, y: 0 },
  { keys: 'qwertyuiop', offset: 0.5, y: 1 },
  { keys: 'asdfghjkl;', offset: 0.75, y: 2 },
  { keys: 'zxcvbnm,./', offset: 1.25, y: 3 },
]

/** The finger taught for each of a row's ten columns: the two index fingers take two columns each. */
const COLUMN_FINGERS: readonly Finger[] = [
  'leftPinky',
  'leftRing',
  'leftMiddle',
  'leftIndex',
  'leftIndex',
  'rightIndex',
  'rightIndex',
  'rightMiddle',
  'rightRing',
  'rightPinky',
]

const POSITIONS: ReadonlyMap<string, KeyPosition> = new Map(
  KEYBOARD_ROWS.flatMap(({ keys, offset, y }) =>
    [...keys].map((key, column): [string, KeyPosition] => {
      const finger = COLUMN_FINGERS[column] as Finger
      return [key, { key, x: offset + column, y, hand: finger.startsWith('left') ? 'left' : 'right', finger }]
    }),
  ),
)

/** Where a character's key is, whichever case it is typed in; null for one this layout does not place. */
export const keyPosition = (character: string): KeyPosition | null =>
  POSITIONS.get(character.toLowerCase()) ?? null

/** The distance between two keys, centre to centre, in key widths. */
export const keyDistance = (from: KeyPosition, to: KeyPosition): number =>
  Math.hypot(to.x - from.x, to.y - from.y)

/**
 * The keys a text is typed on, in order. A character with no place on the
 * layout — a space, an accent — is left out, and the path carries on past it.
 */
export const keyPath = (text: string): readonly KeyPosition[] =>
  [...text].map(keyPosition).filter((position): position is KeyPosition => position !== null)

/** D(w): the distance along a text's keys, first to last. Nothing for fewer than two. */
export const keyTravel = (text: string): number => {
  const path = keyPath(text)
  let total = 0
  for (let index = 1; index < path.length; index += 1) {
    total += keyDistance(path[index - 1] as KeyPosition, path[index] as KeyPosition)
  }
  return total
}

export interface WordGeometry {
  /** How many of the word's characters are on the layout. */
  readonly keys: number
  /** D(w), in key widths. */
  readonly totalTravel: number
  /** `totalTravel` per transition, so a long word is not marked down for being long. 0 for one key. */
  readonly averageTravel: number
  /** Transitions between two different keys taught to the same finger. */
  readonly sameFingerTransitions: number
  /** Transitions from one hand to the other. */
  readonly handAlternations: number
  /** Transitions between two rows. */
  readonly rowTransitions: number
  /** A key pressed twice running: "tt" in "letter". Counted apart from same-finger transitions. */
  readonly repeatedCharacters: number
  /** The finger taught for each key, in order. */
  readonly fingers: readonly Finger[]
}

/** Everything the layout can say about a word, each as its own plain count. */
export const wordGeometry = (word: string): WordGeometry => {
  const path = keyPath(word)
  let totalTravel = 0
  let sameFingerTransitions = 0
  let handAlternations = 0
  let rowTransitions = 0
  let repeatedCharacters = 0

  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1] as KeyPosition
    const to = path[index] as KeyPosition
    totalTravel += keyDistance(from, to)
    if (from.key === to.key) repeatedCharacters += 1
    else if (from.finger === to.finger) sameFingerTransitions += 1
    if (from.hand !== to.hand) handAlternations += 1
    if (from.y !== to.y) rowTransitions += 1
  }

  return {
    keys: path.length,
    totalTravel,
    averageTravel: path.length > 1 ? totalTravel / (path.length - 1) : 0,
    sameFingerTransitions,
    handAlternations,
    rowTransitions,
    repeatedCharacters,
    fingers: path.map((position) => position.finger),
  }
}

export interface ChunkTravel {
  /** D of each chunk on its own: the distance typed without a break. */
  readonly runs: readonly number[]
  /** The distance from each chunk's last key to the next chunk's first: crossed during the breath. */
  readonly bridges: readonly number[]
  /** The longest of `runs`. */
  readonly longestRun: number
  /** Every run and every bridge: the same as D of the chunks joined. */
  readonly totalTravel: number
}

/**
 * A word's travel, taken a chunk at a time.
 *
 * Chunking a word does not shorten it: the keys are the same keys. What changes
 * is how far the hands go in one unbroken run — the whole word, or only its
 * longest chunk — and that is the figure worth setting beside the whole.
 */
export const chunkTravel = (chunks: readonly string[]): ChunkTravel => {
  const runs = chunks.map(keyTravel)
  const bridges: number[] = []
  for (let index = 1; index < chunks.length; index += 1) {
    const from = keyPath(chunks[index - 1] as string).at(-1)
    const to = keyPath(chunks[index] as string)[0]
    bridges.push(from === undefined || to === undefined ? 0 : keyDistance(from, to))
  }
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)
  return { runs, bridges, longestRun: Math.max(0, ...runs), totalTravel: sum(runs) + sum(bridges) }
}
