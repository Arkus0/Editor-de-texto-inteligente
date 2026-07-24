import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedSystemPrompt {
  id: string;
  name: string | null;
  prompt: string;
  createdAt: number;
  pinned: boolean;
}

const MAX_RECENT = 8;

interface SystemPromptState {
  prompts: SavedSystemPrompt[];
  addRecent: (prompt: string) => void;
  save: (name: string, prompt: string) => void;
  promote: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export const useSystemPromptStore = create<SystemPromptState>()(
  persist(
    (set, get) => ({
      prompts: [],
      addRecent: (prompt) => {
        const trimmed = prompt.trim();
        if (!trimmed) return;
        const existing = get().prompts;
        if (existing.some((p) => p.prompt === trimmed)) return;

        const recentOnly = existing.filter((p) => !p.pinned);
        const pinnedOnly = existing.filter((p) => p.pinned);
        const nextRecent = [
          { id: crypto.randomUUID(), name: null, prompt: trimmed, createdAt: Date.now(), pinned: false },
          ...recentOnly,
        ].slice(0, MAX_RECENT);

        set({ prompts: [...pinnedOnly, ...nextRecent] });
      },
      save: (name, prompt) => {
        const trimmed = prompt.trim();
        if (!trimmed || !name.trim()) return;
        const existing = get().prompts;
        const already = existing.find((p) => p.prompt === trimmed);
        if (already) {
          set({
            prompts: existing.map((p) =>
              p.id === already.id ? { ...p, pinned: true, name: name.trim() } : p
            ),
          });
          return;
        }
        set({
          prompts: [
            { id: crypto.randomUUID(), name: name.trim(), prompt: trimmed, createdAt: Date.now(), pinned: true },
            ...existing,
          ],
        });
      },
      promote: (id, name) => {
        set({
          prompts: get().prompts.map((p) => (p.id === id ? { ...p, pinned: true, name: name.trim() || p.name } : p)),
        });
      },
      remove: (id) => set({ prompts: get().prompts.filter((p) => p.id !== id) }),
    }),
    { name: "eti-system-prompts" }
  )
);
