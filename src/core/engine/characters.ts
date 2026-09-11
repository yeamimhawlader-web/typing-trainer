/**
 * Splitting text into typeable units.
 *
 * `'née'.split('')` can yield four elements, and `'👍'.split('')` yields two
 * broken halves, because a JavaScript string is UTF-16 code units rather than
 * characters. Either would put the cursor half-way through a character and
 * make every index after it wrong.
 *
 * `Array.from` iterates code points, so accented letters and emoji stay whole.
 * The cost is one pass when a target is loaded; every index in the engine is a
 * code-point index from then on.
 */

export const toCharacters = (text: string): readonly string[] => Array.from(text)
