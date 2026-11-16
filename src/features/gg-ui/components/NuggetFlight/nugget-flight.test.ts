/**
 * The arc a kept word travels on its way to Golden Nuggets.
 *
 * Only the arithmetic is tested here. The flight itself is the Web Animations
 * API, which jsdom does not implement, so what a browser does with these
 * numbers is checked in a browser.
 */

import { describe, expect, it } from 'vitest'

import { NUGGET_FLIGHT, riseFor } from './nugget-flight.ts'

const { riseAtLeast, riseAtMost, riseOfDistance } = NUGGET_FLIGHT

describe('the height of a nugget flight', () => {
  it('rises with the distance travelled, so a long throw is not a flat slide', () => {
    const near = riseFor(400, 160)
    const far = riseFor(800, 320)

    expect(far).toBeGreaterThan(near)
    expect(near).toBeCloseTo(Math.hypot(400, 160) * riseOfDistance, 5)
  })

  it('still arcs over a hop too short to earn one', () => {
    expect(riseFor(40, 10)).toBe(riseAtLeast)
    expect(riseFor(0, 0)).toBe(riseAtLeast)
  })

  it('stops climbing before it would leave the page', () => {
    expect(riseFor(4_000, 2_000)).toBe(riseAtMost)
  })

  it('measures the way travelled, not the way across: a word above the link arcs too', () => {
    expect(riseFor(0, 600)).toBeCloseTo(600 * riseOfDistance, 5)
  })

  /*
   * The arc's top is written as `min(-rise, dy - rise)`: `rise` above whichever
   * end is higher. Without the second term a flight that climbs — a word below
   * its destination — would peak below where it finishes and fall upwards.
   */
  it('peaks above both ends, whichever way the flight goes', () => {
    const peakFor = (dy: number) => Math.min(-riseFor(600, dy), dy - riseFor(600, dy))

    expect(peakFor(300)).toBeLessThan(0)
    expect(peakFor(-300)).toBeLessThan(-300)
  })
})
