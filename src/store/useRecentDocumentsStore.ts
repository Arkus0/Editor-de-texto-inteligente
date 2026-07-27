import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface RecentDocumentEntry {
  path: string
  title: string
  lastOpenedAt: number
}

interface RecentDocumentsState {
  entries: RecentDocumentEntry[]
  record: (entry: { path: string; title: string }) => void
  remove: (path: string) => void
  clear: () => void
}

const MAX_RECENT_DOCUMENTS = 8

export const useRecentDocumentsStore = create<RecentDocumentsState>()(
  persist(
    (set, get) => ({
      entries: [],
      record: ({ path, title }) => {
        if (!path) return
        const withoutExisting = get().entries.filter(
          (entry) => entry.path !== path
        )
        set({
          entries: [
            { path, title, lastOpenedAt: Date.now() },
            ...withoutExisting,
          ].slice(0, MAX_RECENT_DOCUMENTS),
        })
      },
      remove: (path) =>
        set({ entries: get().entries.filter((entry) => entry.path !== path) }),
      clear: () => set({ entries: [] }),
    }),
    { name: "eti-recent-documents" }
  )
)
