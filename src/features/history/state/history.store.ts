/**
 * History state.
 *
 * A thin layer over the session service: load, delete, clear. It holds no
 * knowledge of how sessions are stored — it calls the service and keeps what
 * comes back.
 *
 * Like the settings store, it is created by a factory taking its dependency, so
 * tests drive it with an in-memory service and no mocks.
 */

import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

import { sessionService, type SessionService, type TypingSession } from '@core/sessions'
import { telemetryService, type TelemetryService } from '@core/telemetry'
import type { SessionId } from '@core/types'

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface HistoryState {
  readonly sessions: readonly TypingSession[]
  readonly status: HistoryStatus
  readonly load: () => Promise<void>
  readonly remove: (id: SessionId) => Promise<void>
  readonly clear: () => Promise<void>
}

/**
 * Deleting a session deletes its keystroke detail too.
 *
 * Telemetry is stored apart from sessions, so nothing removes it automatically.
 * Leaving it behind would keep a record of what someone typed after they asked
 * for it to be gone — and orphan it, since nothing could ever reach it again.
 */
export const createHistoryStore = (
  service: SessionService,
  telemetry: TelemetryService = telemetryService,
): StoreApi<HistoryState> =>
  createStore<HistoryState>()((set, get) => ({
    sessions: [],
    status: 'idle',

    load: async () => {
      if (get().status === 'loading') return
      set({ status: 'loading' })

      try {
        set({ sessions: await service.getRecent(), status: 'ready' })
      } catch (error) {
        // A history page that cannot load is a broken page, not a broken app.
        console.warn('[history] failed to load sessions', error)
        set({ sessions: [], status: 'failed' })
      }
    },

    remove: async (id) => {
      // Removed from view first: waiting on the write to redraw makes deleting
      // feel slow for something that cannot meaningfully fail.
      set({ sessions: get().sessions.filter((session) => session.id !== id) })

      try {
        await service.remove(id)
        await telemetry.remove(id)
      } catch (error) {
        console.warn('[history] failed to delete a session', error)
        await get().load()
      }
    },

    clear: async () => {
      set({ sessions: [] })

      try {
        await service.clear()
        await telemetry.clear()
      } catch (error) {
        console.warn('[history] failed to clear history', error)
        await get().load()
      }
    },
  }))

export const historyStore = createHistoryStore(sessionService)

/** React binding. Always pass a selector so components re-render narrowly. */
export const useHistoryStore = <T>(selector: (state: HistoryState) => T): T =>
  useStore(historyStore, selector)
