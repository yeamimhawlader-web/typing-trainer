/**
 * Your own texts: what you want in your hands, and in your head.
 *
 * Three ways in, in the order they are worth to someone arriving:
 *
 * 1. The words you actually use. A prompt to take to whichever AI you talk to,
 *    which answers with the words you reach for most; pasted back here they
 *    become a word list to practise. Nothing is sent anywhere by this
 *    application — the typist carries the prompt there and the answer back, and
 *    the answer is treated as text to clean, never as an instruction.
 * 2. A passage worth keeping: a quote, your goals, the rules you hold yourself
 *    to. Typing is slow, deliberate reading, which is why people copy out what
 *    they want to remember.
 * 3. Everything kept so far, to practise, edit or let go.
 *
 * All of it is this browser's, beside the history and the settings.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { textPath } from '@app/routes.ts'
import {
  libraryService as defaultLibrary,
  LIBRARY_RULES,
  type LibraryKind,
  type LibraryService,
  type LibraryText,
} from '@core/library'
import { Button, ConfirmAction, Page } from '@shared/ui'

import styles from './LibraryPage.module.css'

/**
 * What to take to an AI. Written to be pasted as it is: it asks for plain
 * words and nothing else, because everything else has to be thrown away here.
 */
export const WORDS_PROMPT = `Look back over everything I have written to you in our conversations.

List the 150 words I use most often, most frequent first. Skip the filler every English sentence has — "the", "and", "is", "to". Keep the words that are mine: what I ask about, how I phrase things, the words I reach for.

Answer with the words alone, separated by spaces. No numbers, no bullets, no explanation.`

const KIND_LABELS: Readonly<Record<LibraryKind, string>> = {
  passage: 'Typed as written',
  words: 'Words, in random order',
}

const sizeOf = (text: LibraryText): string => {
  const words = text.body.split(' ').filter((word) => word.length > 0).length
  return `${words} ${words === 1 ? 'word' : 'words'}`
}

export interface LibraryPageProps {
  /** Injectable for tests; defaults to the application's library. */
  readonly library?: LibraryService
}

export const LibraryPage = ({ library = defaultLibrary }: LibraryPageProps = {}) => {
  const [texts, setTexts] = useState<readonly LibraryText[] | null>(null)
  const [editing, setEditing] = useState<LibraryText | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<LibraryKind>('passage')
  const [pasted, setPasted] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reload = useCallback(async () => {
    setTexts(await library.getAll())
  }, [library])

  useEffect(() => {
    let active = true
    library
      .getAll()
      .then((all) => {
        if (active) setTexts(all)
      })
      .catch((error: unknown) => {
        console.warn('[library] failed to read your texts', error)
        if (active) setTexts([])
      })
    return () => {
      active = false
    }
  }, [library])

  const startNew = () => {
    setEditing(null)
    setTitle('')
    setBody('')
    setKind('passage')
  }

  const keep = async (draft: { title: string; body: string; kind: LibraryKind }, said: string) => {
    const saved = await library.save(draft)
    if (saved === null) {
      setNotice(
        draft.kind === 'words'
          ? 'That had no words in it to practise.'
          : 'That was too short to type. A sentence or more.',
      )
      return null
    }
    setNotice(said)
    await reload()
    return saved
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void keep(
      { ...(editing === null ? {} : { id: editing.id }), title, body, kind },
      editing === null ? 'Kept.' : 'Saved.',
    ).then((saved) => {
      if (saved !== null) startNew()
    })
  }

  const keepPasted = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void keep({ title: 'Words I use most', body: pasted, kind: 'words' }, 'Kept as a word list.').then(
      (saved) => {
        if (saved !== null) setPasted('')
      },
    )
  }

  const copyPrompt = () => {
    navigator.clipboard?.writeText(WORDS_PROMPT).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      },
      () => setNotice('Your browser would not let the page copy. Select the prompt and copy it.'),
    )
  }

  const edit = (text: LibraryText) => {
    setEditing(text)
    setTitle(text.title)
    setBody(text.body)
    setKind(text.kind)
  }

  return (
    <Page
      title="Your texts"
      description="A quote you want to keep, the goals you read every morning, the words you actually use. Type them until they stick."
    >
      {notice !== null && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <section className={styles.section} aria-labelledby="ai-words">
        <h2 id="ai-words" className={styles.heading}>
          The words you actually use
        </h2>
        <p className={styles.lede}>
          Take this to ChatGPT, Claude, or whichever you talk to. It answers with the
          words you reach for most; paste the answer back and practise those, because
          those are the ones you will keep typing.
        </p>

        <pre className={styles.prompt}>{WORDS_PROMPT}</pre>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={copyPrompt}>
            {copied ? 'Copied' : 'Copy the prompt'}
          </Button>
        </div>

        <form className={styles.form} onSubmit={keepPasted}>
          <label className={styles.label} htmlFor="pasted-words">
            Paste what it gives you
          </label>
          <textarea
            id="pasted-words"
            className={styles.textarea}
            rows={4}
            value={pasted}
            maxLength={LIBRARY_RULES.maxBodyCharacters * 2}
            onChange={(event) => setPasted(event.target.value)}
            placeholder="because through people something different…"
          />
          <div className={styles.actions}>
            <Button type="submit" variant="primary" disabled={pasted.trim().length === 0}>
              Keep as a word list
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="add-text">
        <h2 id="add-text" className={styles.heading}>
          {editing === null ? 'Keep a text of your own' : `Editing “${editing.title}”`}
        </h2>
        <p className={styles.lede}>
          A quote, your goals for the year, the rules you hold yourself to, a word list
          of your own. Line breaks become spaces, so it can be typed straight through.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label} htmlFor="text-title">
            Name it
          </label>
          <input
            id="text-title"
            className={styles.input}
            value={title}
            maxLength={LIBRARY_RULES.maxTitleCharacters}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Marcus Aurelius, my goals, words to remember…"
          />

          <fieldset className={styles.kinds}>
            <legend className={styles.label}>How it is typed</legend>
            {(['passage', 'words'] as const).map((option) => (
              <label key={option} className={styles.kind}>
                <input
                  type="radio"
                  name="library-kind"
                  value={option}
                  checked={kind === option}
                  onChange={() => setKind(option)}
                />
                <span>{KIND_LABELS[option]}</span>
              </label>
            ))}
          </fieldset>

          <label className={styles.label} htmlFor="text-body">
            The text
          </label>
          <textarea
            id="text-body"
            className={styles.textarea}
            rows={6}
            value={body}
            maxLength={LIBRARY_RULES.maxBodyCharacters * 2}
            onChange={(event) => setBody(event.target.value)}
            placeholder="You have power over your mind — not outside events. Realise this, and you will find strength."
          />

          <div className={styles.actions}>
            <Button type="submit" variant="primary" disabled={body.trim().length === 0}>
              {editing === null ? 'Keep it' : 'Save changes'}
            </Button>
            {editing !== null && (
              <Button variant="ghost" onClick={startNew}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="kept-texts">
        <h2 id="kept-texts" className={styles.heading}>
          Kept
        </h2>

        {texts === null && <p className={styles.lede}>Reading your texts…</p>}

        {texts !== null && texts.length === 0 && (
          <p className={styles.lede}>
            Nothing kept yet. Anything above becomes a test you can take as often as you
            like.
          </p>
        )}

        {texts !== null && texts.length > 0 && (
          <ul className={styles.list}>
            {texts.map((text) => (
              <li key={text.id} className={styles.item}>
                <div className={styles.itemText}>
                  <p className={styles.itemTitle}>{text.title}</p>
                  <p className={styles.itemMeta}>
                    {KIND_LABELS[text.kind]} · {sizeOf(text)}
                  </p>
                  <p className={styles.itemBody}>{text.body}</p>
                </div>

                <div className={styles.itemActions}>
                  <Link className={styles.practise} to={textPath(text.id)}>
                    Practise
                  </Link>
                  <Button variant="ghost" onClick={() => edit(text)}>
                    Edit
                  </Button>
                  <ConfirmAction
                    label="Delete"
                    triggerLabel={`Delete ${text.title}`}
                    prompt="Delete this text?"
                    confirmLabel="Delete"
                    onConfirm={() => {
                      void library.remove(text.id).then(reload)
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}
