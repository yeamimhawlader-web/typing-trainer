/**
 * Test environment setup, applied to every test file.
 *
 * Vitest globals are deliberately off: tests import `describe`/`it`/`expect`
 * explicitly, which keeps test files honest about their dependencies and means
 * no ambient types leak into application code.
 */

import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
