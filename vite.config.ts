import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

import { firstPaintScript } from './src/features/gg-ui/themes/first-paint.ts'

const resolveSrc = (segment: string) =>
  fileURLToPath(new URL(`./src/${segment}`, import.meta.url))

/**
 * Sets the saved theme's scheme before the first paint, so a fresh installation
 * never flashes dark on its way to Classic Milk. See first-paint.ts.
 */
const firstPaint = (): Plugin => ({
  name: 'gg-first-paint',
  transformIndexHtml: () => [{ tag: 'script', children: firstPaintScript(), injectTo: 'head-prepend' }],
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), firstPaint()],
  resolve: {
    alias: {
      // shadcn/ui's convention: components it adds, and ones written for it,
      // import each other as '@/components/ui/…' and '@/lib/utils'.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@app': resolveSrc('app'),
      '@config': resolveSrc('config'),
      '@core': resolveSrc('core'),
      '@features': resolveSrc('features'),
      '@shared': resolveSrc('shared'),
      '@styles': resolveSrc('styles'),
    },
  },
  test: {
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
    /**
     * Two environments, on purpose.
     *
     * The domain project runs with no DOM whatsoever. If a `document`,
     * `window` or React import ever reaches the typing engine, these tests
     * stop working immediately — the separation is verified on every run
     * rather than trusted. It is also faster, since there is no jsdom to build.
     *
     * The browser project gets jsdom for the code that genuinely needs it:
     * components, and the localStorage adapter.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          include: [
            'src/core/engine/**/*.test.ts',
            'src/core/types/**/*.test.ts',
            'src/core/text/**/*.test.ts',
            'src/core/syllables/**/*.test.ts',
            'src/core/statistics/**/*.test.ts',
            'src/core/telemetry/**/*.test.ts',
            'src/core/history/**/*.test.ts',
            // Design tokens: a stylesheet parsed as text and some colour
            // arithmetic. No DOM involved, so it belongs on the fast project.
            'src/styles/**/*.test.ts',
            'src/config/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: [
            'src/core/persistence/**/*.test.ts',
            'src/core/sessions/**/*.test.ts',
            'src/core/nuggets/**/*.test.ts',
            'src/core/library/**/*.test.ts',
            'src/core/accounts/**/*.test.ts',
            'src/app/**/*.test.{ts,tsx}',
            'src/features/**/*.test.{ts,tsx}',
            'src/shared/**/*.test.{ts,tsx}',
            'src/components/**/*.test.{ts,tsx}',
          ],
        },
      },
    ],
  },
})
