/**
 * The words for Hover Mode at its tired difficulty.
 *
 * A hand-picked set rather than a frequency list: these are the words the
 * typist chose to work on, and tired is the difficulty that stays with a word
 * longest -- three clean repetitions, three more for every repetition with a
 * mistake, up to ten. Practising a narrow set that hard is the point of it.
 *
 * So this list is deliberately not the common vocabulary (word-list.ts) and
 * not the advanced one (advanced-words.ts). It overlaps both and belongs to
 * neither; a word being frequent is no reason to add it here, and a word being
 * rare is no reason to leave it out. The only rule is that the typist asked
 * for it.
 *
 * Kept as one block of text rather than a line a word, as the advanced list is,
 * and split once when the module loads.
 */

export const TIRED_WORDS: readonly string[] = `
  about after again all also another any ask back be
  because become before begin both but by call change child
  consider could day develop down each early even eye face
  fact few find follow for form from general give go
  good group he head help here hold home how however
  in increase interest into it know large last late life
  like line long make man many may mean might more
  most move much must nation never new no not now
  number of off old on only open order other out
  over own part person place plan play point possible problem
  program public right run same say school see seem set
  she should show small so some stand state still such
  system tell than that the then there these they thing
  this through time to too turn use very want way
  we well what when where which while who will with
  word world would write you
`
  .trim()
  .split(/\s+/)
