/**
 * Confetti on a canvas of its own, for a moment worth celebrating.
 *
 * From the shadcn-style Confetti component (canvas-confetti underneath), kept
 * to the part this application uses: a canvas that owns one confetti instance
 * and hands out `fire`. The ConfettiButton and demos that came with it are left
 * out — nothing here fires confetti from a button.
 *
 * Someone who has asked their system for less motion gets none: canvas-confetti
 * reads `prefers-reduced-motion` itself through `disableForReducedMotion`.
 */

import type { ReactNode } from 'react'
import React, { createContext, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type {
  CreateTypes as ConfettiInstance,
  GlobalOptions as ConfettiGlobalOptions,
  Options as ConfettiOptions,
} from 'canvas-confetti'
import { create as createConfetti } from 'canvas-confetti'

type Api = {
  fire: (options?: ConfettiOptions) => void
}

type Props = React.ComponentPropsWithRef<'canvas'> & {
  options?: ConfettiOptions
  globalOptions?: ConfettiGlobalOptions
  manualstart?: boolean
  children?: ReactNode
}

export type ConfettiRef = Api | null

const ConfettiContext = createContext<Api>({} as Api)

const DEFAULT_GLOBAL_OPTIONS: ConfettiGlobalOptions = { resize: true, useWorker: true, disableForReducedMotion: true }

const Confetti = forwardRef<ConfettiRef, Props>((props, ref) => {
  const { options, globalOptions = DEFAULT_GLOBAL_OPTIONS, manualstart = false, children, ...rest } = props
  const instanceRef = useRef<ConfettiInstance | null>(null)

  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        // Mounted: one instance per canvas.
        if (instanceRef.current) return
        instanceRef.current = createConfetti(node, { ...globalOptions, resize: true })
      } else if (instanceRef.current) {
        // Unmounted: stop whatever is still falling.
        instanceRef.current.reset()
        instanceRef.current = null
      }
    },
    [globalOptions],
  )

  const fire = useCallback((opts: ConfettiOptions = {}) => {
    void instanceRef.current?.({ ...options, ...opts })
  }, [options])

  const api = useMemo(() => ({ fire }), [fire])

  useImperativeHandle(ref, () => api, [api])

  useEffect(() => {
    if (!manualstart) fire()
  }, [manualstart, fire])

  return (
    <ConfettiContext.Provider value={api}>
      <canvas ref={canvasRef} {...rest} />
      {children}
    </ConfettiContext.Provider>
  )
})

Confetti.displayName = 'Confetti'

let drawable: boolean | null = null

/**
 * Whether this browser can draw confetti at all. Asked of a throwaway canvas,
 * so the real one is still free to hand its drawing to a worker. False where
 * there is no 2D canvas — a test environment, or a locked-down browser.
 */
export const canDrawConfetti = (): boolean => {
  if (drawable === null) {
    try {
      drawable = typeof document !== 'undefined' && document.createElement('canvas').getContext('2d') !== null
    } catch {
      drawable = false
    }
  }
  return drawable
}

/**
 * A theme colour as canvas-confetti takes it: `#rrggbb`.
 *
 * The themes write colours in forms canvas-confetti cannot read (`oklch()`
 * among them), so the browser draws one pixel in the colour and the pixel is
 * read back. Null when the variable is unset or nothing can be drawn.
 */
export const themeColour = (variable: string, element: Element = document.documentElement): string | null => {
  const value = getComputedStyle(element).getPropertyValue(variable).trim()
  if (value === '') return null
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (context === null) return null
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The personal-best celebration: two cannons from the sides, then a burst of
 * stars from the middle. About two seconds in all.
 */
export const celebrate = (fire: Api['fire'], colors?: readonly string[]): (() => void) => {
  const palette = colors !== undefined && colors.length > 0 ? { colors: [...colors] } : {}
  const timers: number[] = []
  const end = performance.now() + 1200
  let frame = 0

  const cannons = (): void => {
    fire({ ...palette, particleCount: 3, angle: 60, spread: 55, startVelocity: 60, origin: { x: 0, y: 0.65 } })
    fire({ ...palette, particleCount: 3, angle: 120, spread: 55, startVelocity: 60, origin: { x: 1, y: 0.65 } })
    if (performance.now() < end) frame = requestAnimationFrame(cannons)
  }
  cannons()

  const stars = { ...palette, spread: 360, ticks: 60, gravity: 0, decay: 0.94, startVelocity: 26, origin: { x: 0.5, y: 0.4 } }
  for (const delay of [350, 450, 550]) {
    timers.push(
      window.setTimeout(() => {
        fire({ ...stars, particleCount: 30, scalar: 1.2, shapes: ['star'] })
        fire({ ...stars, particleCount: 10, scalar: 0.75, shapes: ['circle'] })
      }, delay),
    )
  }

  return () => {
    cancelAnimationFrame(frame)
    for (const timer of timers) clearTimeout(timer)
  }
}

export { Confetti }
