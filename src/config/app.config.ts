/**
 * The resolved application configuration.
 *
 * Build-time and environment-derived settings only. Anything the typist can
 * change at runtime is a user preference instead — see @core/types/preferences.
 */

import { env, type Environment, type PersistenceDriver } from './env.ts'

export interface PersistenceConfig {
  readonly driver: PersistenceDriver
  /** Prefix applied to every storage key, so the origin can host other data. */
  readonly namespace: string
  /**
   * Version of the persisted data shape. Bump this when a stored structure
   * changes incompatibly; the migration step reads it to decide what to do.
   */
  readonly schemaVersion: number
}

export interface AppConfig {
  /**
   * The name a typist sees: the top bars, every tab title. Code keeps its own
   * names — `gg` for the typing shell, `typing-trainer` for storage keys, which
   * stay as they are so nothing saved is lost.
   */
  readonly appName: string
  readonly environment: Environment
  readonly persistence: PersistenceConfig
}

export const appConfig: AppConfig = {
  appName: 'Hover Typing',
  environment: env.environment,
  persistence: {
    driver: env.persistenceDriver,
    namespace: 'typing-trainer',
    schemaVersion: 1,
  },
}
