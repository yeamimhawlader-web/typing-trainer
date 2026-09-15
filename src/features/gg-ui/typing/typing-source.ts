/**
 * The seam between the GG.Typing UI and whatever does the typing.
 *
 * The brief's interface is `onKeyPress`, `currentIndex` and `words[]`. It is
 * expressed as a small store rather than as props, because props would mean a
 * re-render of the whole word stream on every keystroke. Each character reads
 * its own mark and the cursor reads the index, both through
 * `useSyncExternalStore`, so a keystroke re-renders the one character it
 * touched — the same discipline the existing typing screen keeps.
 *
 * `createStubTypingSource` is a placeholder, and deliberately naive: it
 * compares a key with the character at the cursor and moves on. The wiring pass
 * replaces it with an adapter over `@core/engine`, which already implements
 * word-synchronised error recovery, the idle rule, metrics and telemetry. Do not
 * grow this stub into a second typing engine.
 */

export type CharacterMark = 'pending' | 'correct' | 'incorrect'

export interface TypingSource {
  /** The words to type, in order. */
  readonly words: readonly string[]
  /** The words joined by single spaces: what positions index into. */
  readonly text: string
  /** One key from the input field: a single character, or `Backspace`. */
  onKeyPress(key: string): void
  /** Position of the character awaiting input. Equals `text.length` at the end. */
  getCurrentIndex(): number
  getMark(index: number): CharacterMark
  subscribe(listener: () => void): () => void
}

export const createStubTypingSource = (words: readonly string[]): TypingSource => {
  const text = words.join(' ')
  const characters = Array.from(text)
  const marks: CharacterMark[] = characters.map(() => 'pending')
  const listeners = new Set<() => void>()
  let currentIndex = 0

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    words,
    text,

    onKeyPress: (key) => {
      if (key === 'Backspace') {
        if (currentIndex === 0) return
        currentIndex -= 1
        marks[currentIndex] = 'pending'
        notify()
        return
      }

      if (Array.from(key).length !== 1 || currentIndex >= characters.length) return

      marks[currentIndex] = key === characters[currentIndex] ? 'correct' : 'incorrect'
      currentIndex += 1
      notify()
    },

    getCurrentIndex: () => currentIndex,
    getMark: (index) => marks[index] ?? 'pending',

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
