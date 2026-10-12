import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { wpm } from '@core/types'

import { PersonalBestCelebration } from './PersonalBestCelebration.tsx'

describe('a new personal best on the result', () => {
  it('says so, with the speed it beat', () => {
    render(<PersonalBestCelebration best={{ previousWpm: wpm(71.6) }} wpm={84.2} />)

    expect(screen.getByText('New personal best')).toBeInTheDocument()
    expect(screen.getByText('84 wpm, up from 72')).toBeInTheDocument()
  })

  it('leaves the confetti out where nothing can be drawn, rather than failing', () => {
    // jsdom has no 2D canvas: the words stay, the canvas does not appear.
    const { container } = render(<PersonalBestCelebration best={{ previousWpm: wpm(60) }} wpm={70} />)

    expect(container.querySelector('canvas')).toBeNull()
  })
})
