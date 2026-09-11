/**
 * Public entry point for configuration.
 * Import from '@config', never reach into the individual files.
 */

export { appConfig } from './app.config.ts'
export type { AppConfig, PersistenceConfig } from './app.config.ts'

export { env } from './env.ts'
export type { Env, Environment, PersistenceDriver } from './env.ts'

export { DEFAULT_PREFERENCES } from './defaults.ts'
