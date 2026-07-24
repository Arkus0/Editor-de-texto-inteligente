import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface HistoryEntry {
  id: string;
  title: string;
  prompt: string;
  attachmentNames: string[];
  response: string;
  model: string;
  createdAt: number;
}

interface HistoryState {
  entries: HistoryEntry[];
  add: (entry: Omit<HistoryEntry, "id" | "createdAt">) => HistoryEntry;
  remove: (id: string) => void;
  rename: (id: string, title: string) => void;
}

function deriveTitle(prompt: string): string {
  const firstLine = prompt.trim().split("\n")[0] ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine || "Respuesta sin título";
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (entry) => {
        const newEntry: HistoryEntry = {
          ...entry,
          id: crypto.randomUUID(),
          title: entry.title || deriveTitle(entry.prompt),
          createdAt: Date.now(),
        };
        set({ entries: [newEntry, ...get().entries] });
        return newEntry;
      },
      remove: (id) => set({ entries: get().entries.filter((e) => e.id !== id) }),
      rename: (id, title) =>
        set({
          entries: get().entries.map((e) => (e.id === id ? { ...e, title } : e)),
        }),
    }),
    { name: "eti-history" }
  )
);

export { deriveTitle };
