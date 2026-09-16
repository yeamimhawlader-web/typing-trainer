/**
 * The shell's sound engine, shared by everything inside it.
 *
 * One audio context for the application, not one per screen: the typing screen,
 * Hover Mode and the mode selector all play through the same engine, and it
 * lives as long as the shell does. Components take it from here rather than
 * creating their own, and anything rendered without a provider — a component
 * test, a page that makes no sound — gets silence.
 */

import { createContext, useContext } from 'react'

import type { SoundEngine } from './sound-engine.ts'

export const SoundContext = createContext<SoundEngine | null>(null)

export const useSound = (): SoundEngine | null => useContext(SoundContext)
