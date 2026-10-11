import { createMemoryRouter, type RouterNavigateOptions } from 'react-router'
import { describe, expect, it } from 'vitest'

import { crossfadesBetween, withPageCrossfade } from './page-crossfade.ts'

describe('which navigations crossfade', () => {
  it('crossfades from one page to another', () => {
    expect(crossfadesBetween('/gg', '/statistics', false)).toBe(true)
    expect(crossfadesBetween('/history', '/settings', false)).toBe(true)
    expect(crossfadesBetween('/statistics', '/gg/drill/th', false)).toBe(true)
    expect(crossfadesBetween('/', '/gg', false)).toBe(true)
  })

  it('leaves the typing screens to their own motion when the mode selector moves between them', () => {
    // Ordinary practice, Hover Mode and the Syllable Trainer are separate pages
    // that the mode selector unfolds and folds across; a crossfade over that
    // would show two copies of the branches, one fading out over the other.
    expect(crossfadesBetween('/gg', '/gg/hover', false)).toBe(false)
    expect(crossfadesBetween('/gg/hover', '/gg/syllables', false)).toBe(false)
    expect(crossfadesBetween('/gg/syllables', '/gg', false)).toBe(false)
    expect(crossfadesBetween('/gg/hover', '/gg/hover/nuggets', false)).toBe(false)
  })

  it('does not crossfade a page into itself', () => {
    expect(crossfadesBetween('/statistics', '/statistics', false)).toBe(false)
  })

  it('never crossfades for anyone who has asked for less motion', () => {
    expect(crossfadesBetween('/gg', '/statistics', true)).toBe(false)
  })
})

describe('the router, with the crossfade applied', () => {
  /** A router at `path`, and every set of options its own navigate is given. */
  const watched = (path: string) => {
    const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries: [path] })
    const given: unknown[] = []
    const navigate = router.navigate.bind(router)
    router.navigate = ((to: never, options?: never) => {
      given.push(options)
      return navigate(to, options)
    }) as typeof router.navigate
    return { router, given }
  }

  it('asks for the crossfade on a change of page, and only there, from every link at once', async () => {
    // Every link and every navigate() in the application goes through this one
    // method, so this is the one place the crossfade is decided.
    const { router, given } = watched('/gg')
    withPageCrossfade(router, () => false)

    await router.navigate('/statistics')
    await router.navigate('/gg')
    await router.navigate('/gg/hover')

    expect(given).toEqual([{ viewTransition: true }, { viewTransition: true }, undefined])
    expect(router.state.location.pathname).toBe('/gg/hover')
  })

  it('crossfades what a real <Link> sends, which names the option and leaves it undefined', async () => {
    // useLinkClickHandler passes every option it knows, set or not. Spread over
    // a default, an undefined that is present wins — and every link in the
    // application went on cutting while this file's own tests passed.
    const { router, given } = watched('/gg')
    withPageCrossfade(router, () => false)

    // Written as a link writes it, which the options' own type would refuse.
    const asALinkSendsIt = { fromRouteId: '0', replace: undefined, viewTransition: undefined }
    await router.navigate('/statistics', asALinkSendsIt as unknown as RouterNavigateOptions)

    expect(given).toEqual([{ fromRouteId: '0', replace: undefined, viewTransition: true }])
  })

  it('leaves a navigation that says otherwise, and going back, as they were', async () => {
    const { router, given } = watched('/gg')
    withPageCrossfade(router, () => false)

    await router.navigate('/statistics', { viewTransition: false })
    await router.navigate(-1)

    expect(given).toEqual([{ viewTransition: false }, undefined])
  })

  it('asks for nothing when the typist has asked for less motion', async () => {
    const { router, given } = watched('/gg')
    withPageCrossfade(router, () => true)

    await router.navigate('/statistics')

    expect(given).toEqual([undefined])
  })
})
