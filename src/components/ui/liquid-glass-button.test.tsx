/**
 * The liquid glass button: its layers around its label, and — as a link — the
 * same layers inside the link, which the copy as published could not do.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { LiquidButton } from './liquid-glass-button.tsx'

describe('LiquidButton', () => {
  it('is a button named by its label, with its glass behind the label', () => {
    const press = vi.fn()
    render(<LiquidButton onClick={press}>Liquid Glass</LiquidButton>)

    const button = screen.getByRole('button', { name: 'Liquid Glass' })
    button.click()

    expect(press).toHaveBeenCalledOnce()
    expect(button).toHaveAttribute('data-slot', 'button')
    expect(button.querySelector('filter#container-glass')).not.toBeNull()
  })

  it('becomes its child when asked — one link, the glass inside it, the link still leading where it did', () => {
    render(
      <MemoryRouter>
        <LiquidButton asChild>
          <Link to="/gg">Start practising</Link>
        </LiquidButton>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Start practising' })

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/gg')
    expect(link).toHaveAttribute('data-slot', 'button')
    expect(link.querySelector('filter#container-glass')).not.toBeNull()
  })
})
