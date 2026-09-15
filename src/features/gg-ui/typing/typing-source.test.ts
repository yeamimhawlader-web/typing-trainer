import { describe, expect, it, vi } from 'vitest'

import { createStubTypingSource } from './typing-source.ts'

describe('the stub typing source', () => {
  it('joins the words with single spaces, which is what positions index into', () => {
    const source = createStubTypingSource(['ab', 'cd'])

    expect(source.words).toEqual(['ab', 'cd'])
    expect(source.text).toBe('ab cd')
    expect(source.getCurrentIndex()).toBe(0)
    expect(source.getMark(0)).toBe('pending')
  })

  it('marks a key right or wrong against the character at the cursor, and moves on', () => {
    const source = createStubTypingSource(['ab', 'cd'])

    source.onKeyPress('a')
    source.onKeyPress('x')

    expect(source.getMark(0)).toBe('correct')
    expect(source.getMark(1)).toBe('incorrect')
    expect(source.getCurrentIndex()).toBe(2)
  })

  it('steps back on Backspace and forgets the mark', () => {
    const source = createStubTypingSource(['ab'])
    source.onKeyPress('x')

    source.onKeyPress('Backspace')

    expect(source.getCurrentIndex()).toBe(0)
    expect(source.getMark(0)).toBe('pending')
  })

  it('ignores Backspace at the start and keys past the end', () => {
    const source = createStubTypingSource(['a'])
    const listener = vi.fn()
    source.subscribe(listener)

    source.onKeyPress('Backspace')
    source.onKeyPress('a')
    source.onKeyPress('b')

    expect(source.getCurrentIndex()).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores anything that is not one character', () => {
    const source = createStubTypingSource(['ab'])

    source.onKeyPress('Shift')
    source.onKeyPress('')

    expect(source.getCurrentIndex()).toBe(0)
  })

  it('tells subscribers once per keystroke, and stops when unsubscribed', () => {
    const source = createStubTypingSource(['ab'])
    const listener = vi.fn()
    const unsubscribe = source.subscribe(listener)

    source.onKeyPress('a')
    unsubscribe()
    source.onKeyPress('b')

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
