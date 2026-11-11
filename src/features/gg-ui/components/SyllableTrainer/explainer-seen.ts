/**
 * Whether the Syllable Trainer's explanation has been seen in this browser.
 *
 * It opens by itself on a first visit and is put away with "Got it"; after
 * that it is only shown when asked for. A flag of its own rather than a
 * preference: it is not a setting anyone chooses, and it has no business
 * following an account to another browser, where the first visit is a first
 * visit again.
 */

const SEEN_KEY = 'typing-trainer:v1:syllable-explainer-seen'

/** Whether the explanation has been closed once in this browser. Storage that cannot be read counts as not. */
export const explainerSeen = (): boolean => {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export const rememberExplainerSeen = (): void => {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Not remembered: it opens again next time, which is the harmless way to fail.
  }
}
