import { beforeEach, describe, expect, it } from 'vitest'

import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'

import { createLibraryProvider } from './provider.ts'
import { createLibraryService, parseLibraryText, type LibraryService } from './service.ts'
import { cleanPassage, cleanTitle, isTypeable, wordsFrom } from './text.ts'
import { LIBRARY_RULES } from './types.ts'

const sequence = (values: readonly number[]): (() => number) => {
  let index = 0
  return () => {
    const value = values[index % values.length] ?? 0
    index += 1
    return value
  }
}

describe('making what was pasted typeable', () => {
  it('keeps a quote as it was written', () => {
    expect(cleanPassage('The only way out is through.')).toBe('The only way out is through.')
  })

  it('turns the punctuation a word processor substitutes back into keys', () => {
    expect(cleanPassage('“Don’t wait,” she said — it’s late…')).toBe(
      '"Don\'t wait," she said - it\'s late...',
    )
  })

  it('folds every line break and run of space into single spaces, so it can be typed through', () => {
    expect(cleanPassage('  First line.\n\nSecond   line.\tThird.  ')).toBe(
      'First line. Second line. Third.',
    )
  })

  it('drops what no keyboard can type', () => {
    expect(cleanPassage('goals 🎯 for​ the year')).toBe('goals for the year')
  })

  it('never keeps more than a test’s worth', () => {
    expect(cleanPassage('word '.repeat(2000)).length).toBeLessThanOrEqual(
      LIBRARY_RULES.maxBodyCharacters,
    )
  })

  describe('a list of words', () => {
    it('takes words out of however they were written: a list, a line, or prose', () => {
      expect(wordsFrom('1. because\n2. through\n3. people')).toEqual(['because', 'through', 'people'])
      expect(wordsFrom('because, through, people')).toEqual(['because', 'through', 'people'])
    })

    it('lower-cases them and keeps each one once', () => {
      expect(wordsFrom('Because because BECAUSE through')).toEqual(['because', 'through'])
    })

    it("keeps an apostrophe inside a word, and drops what hangs off the edges", () => {
      expect(wordsFrom("don't, 'quoted' -dash-")).toEqual(["don't", 'quoted', 'dash'])
    })

    it('holds a practice set, not a dictionary', () => {
      const many = Array.from({ length: 2000 }, (_, index) => `word${index}`).join(' ')

      // Words with digits in them are the numbering of a list far more often
      // than words worth practising, so this list comes back empty.
      expect(wordsFrom(many)).toEqual(['word'])
      expect(wordsFrom(Array.from({ length: 2000 }, () => 'alpha beta gamma').join(' ')).length).toBeLessThanOrEqual(
        LIBRARY_RULES.maxWords,
      )
    })
  })

  it('names an untitled text after its own opening', () => {
    expect(cleanTitle('', 'The only way out is through the work itself.')).toBe(
      'The only way out is through',
    )
    expect(cleanTitle('  My rules  ', 'anything')).toBe('My rules')
    expect(cleanTitle('', '')).toBe('Untitled')
  })

  it('knows what is too small to be a test', () => {
    expect(isTypeable('too short', 'passage')).toBe(false)
    expect(isTypeable('long enough to type through', 'passage')).toBe(true)
    expect(isTypeable('one two', 'words')).toBe(false)
    expect(isTypeable('one two three', 'words')).toBe(true)
  })
})

describe('the library', () => {
  let storage: StorageAdapter
  let library: LibraryService

  beforeEach(() => {
    storage = createMemoryAdapter()
    library = createLibraryService(storage)
  })

  it('keeps a text, cleaned, and gives it back', async () => {
    const saved = await library.save({
      title: 'Marcus',
      body: '“You have power over your mind\n— not outside events.”',
      kind: 'passage',
    })

    expect(saved?.body).toBe('"You have power over your mind - not outside events."')
    expect(await library.getAll()).toEqual([saved])
    expect(await library.get(saved!.id)).toEqual(saved)
  })

  it('refuses what there is nothing to type in', async () => {
    expect(await library.save({ title: 'Empty', body: '   ', kind: 'passage' })).toBeNull()
    expect(await library.save({ title: 'Tiny', body: 'hi', kind: 'words' })).toBeNull()
    expect(await library.getAll()).toEqual([])
  })

  it('replaces a text when the draft names one, keeping when it was first kept', async () => {
    const first = await library.save({ title: 'Goals', body: 'run every morning', kind: 'passage' }, 1000)
    const edited = await library.save(
      { id: first!.id, title: 'Goals', body: 'run every morning without fail', kind: 'passage' },
      2000,
    )

    expect(edited?.id).toBe(first?.id)
    expect(edited?.createdAt).toBe(1000)
    expect(edited?.updatedAt).toBe(2000)
    expect(await library.getAll()).toHaveLength(1)
  })

  it('gives back the most recently changed first', async () => {
    await library.save({ title: 'One', body: 'the first passage here', kind: 'passage' }, 1000)
    const second = await library.save({ title: 'Two', body: 'the second passage here', kind: 'passage' }, 2000)

    expect((await library.getAll())[0]?.id).toBe(second?.id)
  })

  it('removes one, and clears them all', async () => {
    const saved = await library.save({ title: 'One', body: 'the first passage here', kind: 'passage' })
    await library.remove(saved!.id)
    expect(await library.getAll()).toEqual([])

    await library.save({ title: 'Two', body: 'the second passage here', kind: 'passage' })
    await library.clear()
    expect(await library.getAll()).toEqual([])
  })

  it('drops a record that was stored broken and keeps the rest', async () => {
    const good = { id: 'a', title: 'Good', body: 'a passage worth typing', kind: 'passage', createdAt: 1, updatedAt: 1 }
    await storage.write('library-texts', [good, { id: 'b' }, null, 'nonsense'])

    expect(await library.getAll()).toEqual([good])
    expect(parseLibraryText({ ...good, kind: 'songs' })).toBeNull()
  })

  it('keeps a library, not an archive', async () => {
    const saves = Array.from({ length: LIBRARY_RULES.maxTexts + 5 }, (_, index) => index)
    await saves.reduce(
      (waiting: Promise<unknown>, index) =>
        waiting.then(() =>
          library.save({ title: `Text ${index}`, body: `passage number ${index} here`, kind: 'passage' }, 1000 + index),
        ),
      Promise.resolve(),
    )

    const all = await library.getAll()
    expect(all).toHaveLength(LIBRARY_RULES.maxTexts)
    // The newest are what is kept.
    expect(all[0]?.title).toBe(`Text ${LIBRARY_RULES.maxTexts + 4}`)
  })
})

describe('your own text as practice material', () => {
  const passage = {
    id: 'a',
    title: 'Marcus',
    body: 'You have power over your mind, not outside events.',
    kind: 'passage' as const,
    createdAt: 1,
    updatedAt: 1,
  }

  it('gives a passage exactly as written, whatever length was asked for', () => {
    const provider = createLibraryProvider(passage)

    expect(provider.provide({ wordCount: 15 }).text).toBe(passage.body)
    expect(provider.provide({ wordCount: 60 }).text).toBe(passage.body)
    expect(provider.label).toBe('Marcus')
  })

  it('draws a word list at the length asked for', () => {
    const provider = createLibraryProvider(
      { ...passage, kind: 'words', body: 'alpha beta' },
      { random: sequence([0, 0.9]) },
    )

    expect(provider.provide({ wordCount: 4 }).text).toBe('alpha beta alpha beta')
  })

  it('records itself as its own source, so history can say where a test came from', () => {
    expect(createLibraryProvider(passage).provide({ wordCount: 10 }).sourceId).toBe('your-text')
  })
})
