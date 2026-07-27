import { create } from "zustand"
import { persist } from "zustand/middleware"

import { DEFAULT_SYSTEM_PROMPT, PROSE_STYLE_RULES } from "@/lib/gemini"
import type {
  GenerationPreset,
  ProfessionalGenerationSettings,
  WorkspaceMode,
} from "@/types/academic"

export const QUICK_GENERATION_SETTINGS: ProfessionalGenerationSettings = {
  model: "gemini-3.1-pro-preview",
  thinkingLevel: "high",
  temperature: 1,
  topP: 0.95,
  lengthPreset: "auto",
  customWordCount: 1200,
  reviewPasses: 2,
  safetyPreset: "academic",
  sourcePolicy: "material-knowledge",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
}

export const DEFAULT_PROFESSIONAL_SETTINGS: ProfessionalGenerationSettings = {
  ...QUICK_GENERATION_SETTINGS,
}

const BUILT_IN_PRESETS: GenerationPreset[] = [
  {
    id: "maximum-quality",
    name: "Máxima calidad",
    settings: { ...DEFAULT_PROFESSIONAL_SETTINGS },
    builtIn: true,
    createdAt: 0,
  },
  {
    id: "text-commentary",
    name: "Informe profesional",
    settings: {
      ...DEFAULT_PROFESSIONAL_SETTINGS,
      lengthPreset: "long",
      systemPrompt: `${DEFAULT_SYSTEM_PROMPT}

En informes profesionales identifica con precisión el objetivo, los destinatarios, los hallazgos, sus implicaciones, los riesgos y las recomendaciones accionables. Utiliza títulos informativos, tablas solo cuando aclaren datos y una estructura que permita lectura rápida y lectura profunda.`,
    },
    builtIn: true,
    createdAt: 0,
  },
  {
    id: "structured-exam",
    name: "Documento estructurado por requisitos",
    settings: {
      ...DEFAULT_PROFESSIONAL_SETTINGS,
      lengthPreset: "medium",
      systemPrompt: `${DEFAULT_SYSTEM_PROMPT}

Cuando las instrucciones contengan requisitos, preguntas o apartados numerados, conserva sus etiquetas y su orden. Responde cada punto de forma verificable y no combines ni omitas requisitos distintos.`,
    },
    builtIn: true,
    createdAt: 0,
  },
  {
    id: "careful-prose",
    name: "Prosa cuidada",
    settings: {
      ...DEFAULT_PROFESSIONAL_SETTINGS,
      systemPrompt: `${DEFAULT_SYSTEM_PROMPT}

${PROSE_STYLE_RULES}`,
    },
    builtIn: true,
    createdAt: 0,
  },
  {
    id: "materials-only",
    name: "Solo materiales aportados",
    settings: {
      ...DEFAULT_PROFESSIONAL_SETTINGS,
      sourcePolicy: "material-only",
    },
    builtIn: true,
    createdAt: 0,
  },
]

interface AcademicState {
  mode: WorkspaceMode
  professionalSettings: ProfessionalGenerationSettings
  presets: GenerationPreset[]
  activePresetId: string | null
  setMode: (mode: WorkspaceMode) => void
  updateProfessionalSettings: (
    patch: Partial<ProfessionalGenerationSettings>
  ) => void
  applyPreset: (id: string) => void
  savePreset: (name: string) => string
  duplicatePreset: (id: string) => string | null
  renamePreset: (id: string, name: string) => void
  removePreset: (id: string) => void
  resetProfessionalSettings: () => void
}

function createPresetId() {
  return globalThis.crypto?.randomUUID?.() ?? `preset-${Date.now()}`
}

export const useAcademicStore = create<AcademicState>()(
  persist(
    (set, get) => ({
      mode: "quick",
      professionalSettings: { ...DEFAULT_PROFESSIONAL_SETTINGS },
      presets: BUILT_IN_PRESETS,
      activePresetId: "maximum-quality",
      setMode: (mode) => set({ mode }),
      updateProfessionalSettings: (patch) =>
        set((state) => ({
          professionalSettings: { ...state.professionalSettings, ...patch },
          activePresetId: null,
        })),
      applyPreset: (id) => {
        const preset = get().presets.find((item) => item.id === id)
        if (!preset) return
        set({
          professionalSettings: { ...preset.settings },
          activePresetId: preset.id,
        })
      },
      savePreset: (name) => {
        const id = createPresetId()
        const preset: GenerationPreset = {
          id,
          name: name.trim() || "Perfil sin nombre",
          settings: { ...get().professionalSettings },
          createdAt: Date.now(),
        }
        set((state) => ({
          presets: [...state.presets, preset],
          activePresetId: id,
        }))
        return id
      },
      duplicatePreset: (id) => {
        const source = get().presets.find((item) => item.id === id)
        if (!source) return null
        const duplicateId = createPresetId()
        const duplicate: GenerationPreset = {
          ...source,
          id: duplicateId,
          name: `${source.name} (copia)`,
          settings: { ...source.settings },
          builtIn: false,
          createdAt: Date.now(),
        }
        set((state) => ({
          presets: [...state.presets, duplicate],
          activePresetId: duplicateId,
          professionalSettings: { ...duplicate.settings },
        }))
        return duplicateId
      },
      renamePreset: (id, name) =>
        set((state) => ({
          presets: state.presets.map((preset) =>
            preset.id === id && !preset.builtIn
              ? { ...preset, name: name.trim() || preset.name }
              : preset
          ),
        })),
      removePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter(
            (preset) => preset.id !== id || preset.builtIn
          ),
          activePresetId:
            state.activePresetId === id ? null : state.activePresetId,
        })),
      resetProfessionalSettings: () =>
        set({
          professionalSettings: { ...DEFAULT_PROFESSIONAL_SETTINGS },
          activePresetId: "maximum-quality",
        }),
    }),
    {
      name: "eti-academic-workspace",
      version: 1,
      partialize: (state) => ({
        mode: state.mode,
        professionalSettings: state.professionalSettings,
        presets: state.presets,
        activePresetId: state.activePresetId,
      }),
      merge: (persisted, current) => {
        const value = persisted as Partial<AcademicState>
        const customPresets = (value.presets ?? []).filter(
          (preset) => !preset.builtIn
        )
        return {
          ...current,
          ...value,
          professionalSettings: {
            ...DEFAULT_PROFESSIONAL_SETTINGS,
            ...(value.professionalSettings ?? {}),
          },
          presets: [...BUILT_IN_PRESETS, ...customPresets],
        }
      },
    }
  )
)
