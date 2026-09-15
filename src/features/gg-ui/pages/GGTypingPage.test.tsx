/**
 * The GG.Typing shell, rendered whole.
 *
 * Covers what the brief asks the shell to do without a typing engine behind
 * it: the six components and their defaults, typing through the input into the
 * word stream, the controls changing shell state, and the theme panel's
 * behaviour — opening, focus, dismissal and switching. Layout and motion are
 * judged in a browser; jsdom has neither.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useShellStore } from '../state/shell.store.ts'
import { removeTheme } from '../themes/apply-theme.ts'
import { createStubTypingSource } from '../typing/typing-source.ts'
import { GGTypingPage } from './GGTypingPage.tsx'

const WORDS = ['alpha', 'bravo', 'charlie', 'delta']
const initialShell = useShellStore.getState()

const renderPage = () =>
  render(
    <MemoryRouter>
      <GGTypingPage createSource={() => createStubTypingSource(WORDS)} />
    </MemoryRouter>,
  )

const stream = () => screen.getByRole('region', { name: 'Words to type' })
const characters = () => Array.from(stream().querySelectorAll<HTMLElement>('[data-i]'))
const markAt = (index: number) => {
  const className = characters()[index]?.className ?? ''
  return /incorrect/.test(className) ? 'incorrect' : /correct/.test(className) ? 'correct' : 'pending'
}
const input = () => screen.getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement

/** Text arriving the way every input method delivers it. */
const typeText = (text: string) => {
  act(() => {
    for (const character of Array.from(text)) {
      input().dispatchEvent(
        new InputEvent('beforeinput', { inputType: 'insertText', data: character, bubbles: true, cancelable: true }),
      )
    }
  })
}

const backspace = () => {
  act(() => {
    input().dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true }),
    )
  })
}

beforeEach(() => {
  useShellStore.setState(initialShell, true)
})

afterEach(() => {
  removeTheme()
})

describe('GG.Typing shell', () => {
  describe('on first load', () => {
    it('shows the top bar, control row, toolbar, word stream and input', () => {
      renderPage()

      expect(screen.getByRole('link', { name: 'GG.Typing' })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Main' })).toHaveTextContent('Typing Test')
      expect(screen.getByRole('combobox', { name: 'Language' })).toHaveDisplayValue('English (english)')
      expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
      for (const group of ['Presets', 'Feedback', 'View']) {
        expect(screen.getByRole('group', { name: group })).toBeInTheDocument()
      }
      expect(stream()).toHaveTextContent('alpha bravo charlie delta')
      expect(input()).toBeInTheDocument()
    })

    it('opens on Default (Dark), size sm, a 1-minute test, English and Normal', () => {
      renderPage()

      expect(document.documentElement.dataset.ggTheme).toBe('default-dark')
      expect(screen.getByRole('radio', { name: 'Small text' })).toBeChecked()
      expect(screen.getByRole('radio', { name: '1 minute' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
      expect(stream()).toHaveAttribute('data-size', 'sm')
    })

    it('is ready to type without a click', () => {
      renderPage()

      expect(input()).toHaveFocus()
    })

    it('names the page in the tab', () => {
      renderPage()

      expect(document.title).toBe('Typing Test · GG.Typing')
    })
  })

  describe('typing', () => {
    it('marks characters right and wrong as text arrives', () => {
      renderPage()

      typeText('alpxa')

      expect([0, 1, 2, 3, 4].map(markAt)).toEqual(['correct', 'correct', 'correct', 'incorrect', 'correct'])
      expect(markAt(5)).toBe('pending')
    })

    it('shows the word being typed, and starts the field over on space', () => {
      renderPage()

      typeText('alp')
      expect(input().value).toBe('alp')

      typeText('ha ')
      expect(input().value).toBe('')

      typeText('br')
      expect(input().value).toBe('br')
    })

    it('handles several characters delivered at once, as a phone keyboard sends them', () => {
      renderPage()

      act(() => {
        input().dispatchEvent(
          new InputEvent('beforeinput', { inputType: 'insertText', data: 'alpha b', bubbles: true, cancelable: true }),
        )
      })

      expect(markAt(6)).toBe('correct')
      expect(input().value).toBe('b')
    })

    it('steps back on delete, in the stream and in the field', () => {
      renderPage()
      typeText('alx')

      backspace()

      expect(markAt(2)).toBe('pending')
      expect(input().value).toBe('al')
    })

    it('refuses pasted text: a typing test types', () => {
      renderPage()
      const paste = new InputEvent('beforeinput', {
        inputType: 'insertFromPaste',
        data: 'alpha',
        bubbles: true,
        cancelable: true,
      })

      act(() => {
        input().dispatchEvent(paste)
      })

      expect(paste.defaultPrevented).toBe(true)
      expect(markAt(0)).toBe('pending')
    })

    it('changes only the character typed, not the rest of the stream', () => {
      renderPage()
      typeText('a')

      const changed: Node[] = []
      const observer = new MutationObserver((records) => {
        for (const record of records) if (record.attributeName === 'class') changed.push(record.target)
      })
      observer.observe(stream(), { attributes: true, subtree: true })

      typeText('l')
      const pending = observer.takeRecords()
      observer.disconnect()
      for (const record of pending) if (record.attributeName === 'class') changed.push(record.target)

      expect(changed).toEqual([characters()[1]])
    })

    it('starts a new test from the restart control, with an empty field', async () => {
      const user = userEvent.setup()
      renderPage()
      typeText('alp')

      await user.click(screen.getByRole('button', { name: 'Restart test' }))

      expect(markAt(0)).toBe('pending')
      expect(input().value).toBe('')
      expect(input()).toHaveFocus()
    })
  })

  describe('controls', () => {
    it('changes the word stream size without touching the stream text', async () => {
      const user = userEvent.setup()
      renderPage()
      typeText('al')

      await user.click(screen.getByRole('radio', { name: 'Extra large text' }))

      expect(stream()).toHaveAttribute('data-size', 'xl')
      expect(markAt(1)).toBe('correct')
    })

    it('chooses a test length and a mode', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('radio', { name: '10 minutes' }))
      await user.click(screen.getByRole('radio', { name: 'Advanced' }))

      expect(useShellStore.getState().minutes).toBe(10)
      expect(useShellStore.getState().mode).toBe('advanced')
      expect(screen.getByRole('radio', { name: 'Advanced' })).toBeChecked()
    })

    it('presses and releases keycaps and icon toggles', async () => {
      const user = userEvent.setup()
      renderPage()
      const f2 = screen.getByRole('button', { name: 'Preset F2' })
      const mute = screen.getByRole('button', { name: 'Mute' })

      await user.click(f2)
      await user.click(mute)
      expect(f2).toHaveAttribute('aria-pressed', 'true')
      expect(mute).toHaveAttribute('aria-pressed', 'true')

      await user.click(f2)
      expect(f2).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('theme panel', () => {
    const panel = () => screen.getByRole('dialog', { hidden: true })

    it('opens from the palette, focuses the current theme, and makes the page behind inert', async () => {
      const user = userEvent.setup()
      renderPage()
      const palette = screen.getByRole('button', { name: 'Themes' })

      await user.click(palette)

      expect(palette).toHaveAttribute('aria-expanded', 'true')
      expect(panel().parentElement).toHaveAttribute('data-open', 'true')
      expect(within(panel()).getByRole('radio', { name: 'Default (Dark)' })).toHaveFocus()
      expect(screen.getByRole('main').closest('[inert]')).not.toBeNull()
    })

    it('lists light and dark themes, each with its swatch', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(screen.getByRole('button', { name: 'Themes' }))

      const [light, dark] = within(panel()).getAllByRole('group')
      expect(within(light as HTMLElement).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
        'default-light',
        'classic',
        'lemondrop',
      ])
      expect(within(dark as HTMLElement).getAllByRole('radio')).toHaveLength(3)
      expect(panel().querySelectorAll('label > span[aria-hidden="true"] > span')).toHaveLength(18)
    })

    it('applies a theme when chosen and stays open to compare the next', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(screen.getByRole('button', { name: 'Themes' }))

      await user.click(within(panel()).getByRole('radio', { name: 'Valentine' }))

      expect(document.documentElement.dataset.ggTheme).toBe('valentine')
      expect(within(panel()).getByRole('radio', { name: 'Valentine' })).toBeChecked()
      expect(panel().parentElement).toHaveAttribute('data-open', 'true')
    })

    it('closes on Escape and returns focus to the palette', async () => {
      const user = userEvent.setup()
      renderPage()
      const palette = screen.getByRole('button', { name: 'Themes' })
      await user.click(palette)

      await user.keyboard('{Escape}')

      expect(panel().parentElement).toHaveAttribute('data-open', 'false')
      expect(panel().parentElement).toHaveAttribute('inert')
      expect(palette).toHaveFocus()
      expect(screen.getByRole('main').closest('[inert]')).toBeNull()
    })

    it('closes on a click outside it', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(screen.getByRole('button', { name: 'Themes' }))

      fireEvent.mouseDown(panel().previousElementSibling as Element)

      expect(panel().parentElement).toHaveAttribute('data-open', 'false')
    })

    it('closes from its close button', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(screen.getByRole('button', { name: 'Themes' }))

      await user.click(within(panel()).getByRole('button', { name: 'Close themes' }))

      expect(panel().parentElement).toHaveAttribute('data-open', 'false')
    })
  })
})
