/**
 * Test environment setup, applied to every test file.
 *
 * Vitest globals are deliberately off: tests import `describe`/`it`/`expect`
 * explicitly, which keeps test files honest about their dependencies and means
 * no ambient types leak into application code.
 */

import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * How long `findBy…` and `waitFor` keep looking before they give up.
 *
 * The default second was a deadline, not a wait: the integration tests render a
 * whole screen, type a text through the real engine and wait on storage, and on
 * a machine running several test files at once a second of that is ordinary.
 * Tests that passed alone failed in the full run, which says nothing about the
 * application.
 *
 * Nothing waits longer than it needs to — a condition that holds resolves at
 * once — so this costs nothing while tests pass. It only moves the point at
 * which a genuinely broken wait is reported.
 *
 * A test that asserts something never appears must pass its own short timeout,
 * since otherwise it would sit here for the whole five seconds.
 */
configure({ asyncUtilTimeout: 5_000 })

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
