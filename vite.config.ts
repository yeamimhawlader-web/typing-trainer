import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const resolveSrc = (segment: string) =>
  fileURLToPath(new URL(`./src/${segment}`, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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
            'src/app/**/*.test.{ts,tsx}',
            'src/features/**/*.test.{ts,tsx}',
            'src/shared/**/*.test.{ts,tsx}',
          ],
        },
      },
    ],
  },
})
