import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  type GeminiModelId,
} from "@/lib/gemini";

interface SettingsState {
  apiKey: string;
  model: GeminiModelId;
  temperature: number;
  topP: number;
  unrestrictedMode: boolean;
  systemPrompt: string;
  setApiKey: (apiKey: string) => void;
  setModel: (model: GeminiModelId) => void;
  setTemperature: (temperature: number) => void;
  setTopP: (topP: number) => void;
  setUnrestrictedMode: (unrestrictedMode: boolean) => void;
  setSystemPrompt: (systemPrompt: string) => void;
  resetSystemPrompt: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      topP: DEFAULT_TOP_P,
      unrestrictedMode: true,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setTemperature: (temperature) => set({ temperature }),
      setTopP: (topP) => set({ topP }),
      setUnrestrictedMode: (unrestrictedMode) => set({ unrestrictedMode }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      resetSystemPrompt: () => set({ systemPrompt: DEFAULT_SYSTEM_PROMPT }),
    }),
    { name: "eti-settings" }
  )
);
