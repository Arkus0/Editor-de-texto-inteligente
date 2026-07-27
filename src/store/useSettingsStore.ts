import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  type GeminiModelId,
} from "@/lib/gemini";
import { OPENROUTER_FREE_MODEL_ID } from "@/lib/openrouter"

export type AiProvider = "gemini" | "openrouter"

const AVAILABLE_MODEL_IDS = new Set<string>(
  AVAILABLE_MODELS.map((model) => model.id)
)

interface SettingsState {
  provider: AiProvider
  apiKey: string;
  openRouterApiKey: string
  openRouterModel: string
  model: GeminiModelId;
  temperature: number;
  topP: number;
  unrestrictedMode: boolean;
  systemPrompt: string;
  setProvider: (provider: AiProvider) => void
  setApiKey: (apiKey: string) => void;
  setOpenRouterApiKey: (apiKey: string) => void
  setOpenRouterModel: (model: string) => void
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
      provider: "gemini",
      apiKey: "",
      openRouterApiKey: "",
      openRouterModel: OPENROUTER_FREE_MODEL_ID,
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      topP: DEFAULT_TOP_P,
      unrestrictedMode: true,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      setProvider: (provider) => set({ provider }),
      setApiKey: (apiKey) => set({ apiKey }),
      setOpenRouterApiKey: (openRouterApiKey) => set({ openRouterApiKey }),
      setOpenRouterModel: (openRouterModel) =>
        set({ openRouterModel }),
      setModel: (model) => set({ model }),
      setTemperature: (temperature) => set({ temperature }),
      setTopP: (topP) => set({ topP }),
      setUnrestrictedMode: (unrestrictedMode) => set({ unrestrictedMode }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      resetSystemPrompt: () => set({ systemPrompt: DEFAULT_SYSTEM_PROMPT }),
    }),
    {
      name: "eti-settings",
      version: 5,
      migrate: (persisted) => {
        const value = persisted as Partial<SettingsState>
        const persistedModel = value.model as string | undefined
        return {
          provider:
            value.provider === "openrouter" ? "openrouter" : "gemini",
          apiKey: value.apiKey ?? "",
          openRouterApiKey: value.openRouterApiKey ?? "",
          openRouterModel:
            value.openRouterModel?.trim() || OPENROUTER_FREE_MODEL_ID,
          model:
            !persistedModel ||
            persistedModel === "gemini-3.5-flash" ||
            !AVAILABLE_MODEL_IDS.has(persistedModel)
              ? DEFAULT_MODEL
              : (persistedModel as GeminiModelId),
          temperature: value.temperature ?? DEFAULT_TEMPERATURE,
          topP: value.topP ?? DEFAULT_TOP_P,
          unrestrictedMode: value.unrestrictedMode ?? true,
          systemPrompt: value.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        }
      },
      partialize: (state) => ({
        provider: state.provider,
        apiKey: state.apiKey,
        openRouterApiKey: state.openRouterApiKey,
        openRouterModel: state.openRouterModel,
        model: state.model,
        temperature: state.temperature,
        topP: state.topP,
        unrestrictedMode: state.unrestrictedMode,
        systemPrompt: state.systemPrompt,
      }),
    }
  )
);
