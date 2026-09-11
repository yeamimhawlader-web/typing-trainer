/**
 * Environment access, validated once at module load.
 *
 * The rule: `import.meta.env` is read in this file and nowhere else. Everything
 * downstream consumes the typed, validated result. That keeps environment
 * mistakes to a single failure point that shouts at startup, instead of an
 * `undefined` surfacing three layers deep at runtime.
 *
 * Validation is hand-rolled rather than schema-library-driven. There are two
 * variables; a dependency would cost more than it saves. If this grows past a
 * handful, switch to a schema library and delete the helpers below.
 */

export type Environment = 'development' | 'production' | 'test'

export type PersistenceDriver = 'local' | 'memory'

const PERSISTENCE_DRIVERS: readonly PersistenceDriver[] = ['local', 'memory']

/** Parses a value that must be one of a fixed set, falling back to a default. */
const parseEnum = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
  variableName: string,
): T => {
  if (raw === undefined || raw === '') return fallback
  if ((allowed as readonly string[]).includes(raw)) return raw as T
  throw new Error(
    `${variableName} must be one of ${allowed.join(' | ')}, received "${raw}"`,
  )
}

const resolveEnvironment = (): Environment => {
  if (import.meta.env.MODE === 'test') return 'test'
  return import.meta.env.PROD ? 'production' : 'development'
}

export interface Env {
  readonly environment: Environment
  readonly isDevelopment: boolean
  readonly isProduction: boolean
  readonly isTest: boolean
  readonly persistenceDriver: PersistenceDriver
}

const environment = resolveEnvironment()

export const env: Env = {
  environment,
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',
  isTest: environment === 'test',
  persistenceDriver: parseEnum(
    import.meta.env.VITE_PERSISTENCE_DRIVER,
    PERSISTENCE_DRIVERS,
    // Tests must never touch real browser storage, so they default to memory.
    environment === 'test' ? 'memory' : 'local',
    'VITE_PERSISTENCE_DRIVER',
  ),
}
