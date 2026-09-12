/**
 * History state.
 *
 * A thin layer over the session service: load, delete, clear, undo. It holds no
 * knowledge of how sessions are stored — it calls the services and keeps what
 * comes back.
 *
 * Like the settings store, it is created by a factory taking its dependencies,
 * so tests drive it with in-memory services and no mocks.
 */

import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

import { createHistoryDeletion, type DeletedHistory, type HistoryDeletion } from '@core/history'
import { sessionService, type SessionService, type TypingSession } from '@core/sessions'
import { telemetryService, type TelemetryService } from '@core/telemetry'
import type { SessionId } from '@core/types'

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface HistoryState {
  readonly sessions: readonly TypingSession[]
  /**
   * How many sessions are stored in total. The list shows the most recent
   * ones; this is what lets the page say so instead of calling the list the
   * whole history.
   */
  readonly total: number
  readonly status: HistoryStatus
  /**
   * What the most recent deletion removed, until it is undone or replaced.
   *
   * Held in memory only, so it lasts for the life of the page — the window in
   * which "I didn't mean that" is actually said — and never outlives the tab.
   */
  readonly lastDeleted: DeletedHistory | null
  readonly load: () => Promise<void>
  readonly remove: (id: SessionId) => Promise<void>
  readonly clear: () => Promise<void>
  readonly undo: () => Promise<void>
  readonly dismissUndo: () => void
}

/**
 * Every deletion goes through `HistoryDeletion`, which removes a session and its
 * keystroke detail together. The session detail page used to remove only the
 * record, leaving what someone typed in storage after they had asked for it to
 * be gone; there is now no second path for that to happen on.
 */
export const createHistoryStore = (
  service: SessionService,
  telemetry: TelemetryService = telemetryService,
  deletion: HistoryDeletion = createHistoryDeletion(service, telemetry),
): StoreApi<HistoryState> =>
  createStore<HistoryState>()((set, get) => {
    /**
     * Re-reads the list without passing through "loading".
     *
     * After a deletion the page should not flash a loading message, but the list
     * shows a limited number of sessions, so the gap a deletion leaves has to be
     * filled from storage rather than simply closed up.
     */
    const refresh = async (): Promise<void> => {
      try {
        const [sessions, total] = await Promise.all([service.getRecent(), service.count()])
        set({ sessions, total, status: 'ready' })
      } catch (error) {
        console.warn('[history] failed to refresh sessions', error)
      }
    }

    return {
      sessions: [],
      total: 0,
      status: 'idle',
      lastDeleted: null,

      load: async () => {
        if (get().status === 'loading') return
        set({ status: 'loading' })

        try {
          const [sessions, total] = await Promise.all([service.getRecent(), service.count()])
          set({ sessions, total, status: 'ready' })
        } catch (error) {
          // A history page that cannot load is a broken page, not a broken app.
          console.warn('[history] failed to load sessions', error)
          set({ sessions: [], total: 0, status: 'failed' })
        }
      },

      remove: async (id) => {
        // Removed from view first: waiting on the write to redraw makes deleting
        // feel slow for something that cannot meaningfully fail.
        set({ sessions: get().sessions.filter((session) => session.id !== id) })

        try {
          const deleted = await deletion.deleteSession(id)
          set({ lastDeleted: deleted.sessions.length > 0 ? deleted : null })
          await refresh()
        } catch (error) {
          console.warn('[history] failed to delete a session', error)
          await get().load()
        }
      },

      clear: async () => {
        set({ sessions: [], total: 0 })

        try {
          const deleted = await deletion.clearAll()
          set({ lastDeleted: deleted.sessions.length > 0 ? deleted : null })
        } catch (error) {
          console.warn('[history] failed to clear history', error)
          await get().load()
        }
      },

      undo: async () => {
        const deleted = get().lastDeleted
        if (deleted === null) return

        set({ lastDeleted: null })

        try {
          await deletion.restore(deleted)
        } catch (error) {
          console.warn('[history] failed to restore deleted sessions', error)
        }

        await refresh()
      },

      dismissUndo: () => set({ lastDeleted: null }),
    }
  })

export const historyStore = createHistoryStore(sessionService)

export const useHistoryStore = <T>(selector: (state: HistoryState) => T): T =>
  useStore(historyStore, selector)
