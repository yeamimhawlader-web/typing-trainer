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

export { Confetti }
