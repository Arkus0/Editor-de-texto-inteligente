"use client"

import * as React from "react"
import {
  Copy,
  Pencil,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  AVAILABLE_MODELS,
  type GeminiModelId,
  normalizeThinkingLevel,
  RECOMMENDED_TEMPERATURE,
  supportedThinkingLevels,
  supportsSamplingControls,
} from "@/lib/gemini"
import {
  OPENROUTER_FREE_MODEL_ID,
  OPENROUTER_MODELS,
  resolveOpenRouterFreeModel,
} from "@/lib/openrouter"
import { useAcademicStore } from "@/store/useAcademicStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import type {
  ProfessionalGenerationSettings,
  SafetyPreset,
} from "@/types/academic"

interface ProfessionalControlsProps {
  disabled?: boolean
}

export function ProfessionalControls({
  disabled = false,
}: ProfessionalControlsProps) {
  const {
    professionalSettings,
    presets,
    activePresetId,
    updateProfessionalSettings,
    applyPreset,
    savePreset,
    duplicatePreset,
    renamePreset,
    removePreset,
    resetProfessionalSettings,
  } = useAcademicStore()
  const {
    provider,
    setProvider,
    model: geminiModel,
    setModel: setGeminiModel,
    openRouterModel,
    setOpenRouterModel,
  } = useSettingsStore()
  const [newPresetName, setNewPresetName] = React.useState("")
  const selectedModel =
    provider === "openrouter" ? openRouterModel : geminiModel

  const update = (patch: Partial<ProfessionalGenerationSettings>) =>
    updateProfessionalSettings(patch)
  const samplingSupported =
    provider === "openrouter" || supportsSamplingControls(selectedModel)
  const thinkingLevels = supportedThinkingLevels(selectedModel)
  const activeThinkingLevel = normalizeThinkingLevel(
    selectedModel,
    professionalSettings.thinkingLevel
  )

  const handleModelChange = (model: string) => {
    if (provider === "openrouter") setOpenRouterModel(model)
    else setGeminiModel(model as GeminiModelId)
    update({
      model,
      thinkingLevel: normalizeThinkingLevel(
        model,
        professionalSettings.thinkingLevel
      ),
    })
  }

  return (
    <aside className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4 text-primary" />
            Configuración profesional
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Una llamada estable con control real de modelo y prosa.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={resetProfessionalSettings}
          disabled={disabled}
          aria-label="Restaurar configuración profesional"
          title="Restaurar valores de máxima calidad"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="academic-preset">Perfil reutilizable</Label>
          <div className="flex gap-2">
            <select
              id="academic-preset"
              value={activePresetId ?? ""}
              onChange={(event) => applyPreset(event.target.value)}
              disabled={disabled}
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Configuración modificada</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || !activePresetId}
              onClick={() => activePresetId && duplicatePreset(activePresetId)}
              aria-label="Duplicar perfil"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={
                disabled ||
                !activePresetId ||
                presets.find((preset) => preset.id === activePresetId)?.builtIn
              }
              onClick={() => {
                if (!activePresetId) return
                const current = presets.find(
                  (preset) => preset.id === activePresetId
                )
                const name = window.prompt(
                  "Nuevo nombre del perfil:",
                  current?.name ?? ""
                )
                if (name?.trim()) renamePreset(activePresetId, name)
              }}
              aria-label="Renombrar perfil"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={
                disabled ||
                !activePresetId ||
                presets.find((preset) => preset.id === activePresetId)?.builtIn
              }
              onClick={() => activePresetId && removePreset(activePresetId)}
              aria-label="Eliminar perfil"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              value={newPresetName}
              onChange={(event) => setNewPresetName(event.target.value)}
              placeholder="Guardar configuración como…"
              disabled={disabled}
              className="h-9"
            />
            <Button
              type="button"
              size="sm"
              disabled={disabled || !newPresetName.trim()}
              onClick={() => {
                savePreset(newPresetName)
                setNewPresetName("")
              }}
            >
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-provider">Proveedor</Label>
          <select
            id="ai-provider"
            value={provider}
            onChange={(event) =>
              setProvider(event.target.value as "gemini" | "openrouter")
            }
            disabled={disabled}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter · modelos gratuitos</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="academic-model">Modelo</Label>
          {provider === "openrouter" ? (
            <>
              <select
                id="academic-model"
                value={
                  OPENROUTER_MODELS.some(
                    (model) => model.id === openRouterModel
                  )
                    ? openRouterModel
                    : "custom"
                }
                onChange={(event) =>
                  handleModelChange(
                    event.target.value === "custom"
                      ? openRouterModel
                      : event.target.value
                  )
                }
                disabled={disabled}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {OPENROUTER_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
                {!OPENROUTER_MODELS.some(
                  (model) => model.id === openRouterModel
                ) && <option value="custom">Modelo específico</option>}
              </select>
              <Input
                value={openRouterModel}
                onChange={(event) => handleModelChange(event.target.value)}
                onBlur={() => {
                  if (!openRouterModel.trim()) {
                    handleModelChange(OPENROUTER_FREE_MODEL_ID)
                  }
                }}
                placeholder="openrouter/free o autor/modelo:free"
                disabled={disabled}
                aria-label="Identificador de modelo de OpenRouter"
              />
              <p className="text-xs text-muted-foreground">
                La selección automática usa los modelos gratuitos disponibles.
                También puedes pegar un identificador terminado en{" "}
                <code>:free</code>.
              </p>
              {resolveOpenRouterFreeModel(openRouterModel) !==
                openRouterModel.trim() && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Para evitar cargos accidentales, cualquier identificador que
                  no termine en <code>:free</code> se sustituirá por{" "}
                  <code>openrouter/free</code>.
                </p>
              )}
            </>
          ) : (
            <select
              id="academic-model"
              value={geminiModel}
              onChange={(event) => handleModelChange(event.target.value)}
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {thinkingLevels.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="academic-thinking-level">
              Profundidad de razonamiento
            </Label>
            <select
              id="academic-thinking-level"
              value={activeThinkingLevel}
              onChange={(event) =>
                update({
                  thinkingLevel: event.target
                    .value as ProfessionalGenerationSettings["thinkingLevel"],
                })
              }
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {thinkingLevels.map((level) => (
                <option key={level} value={level}>
                  {
                    {
                      minimal: "Mínimo · máxima rapidez",
                      low: "Bajo",
                      medium: "Medio · equilibrado",
                      high: "Alto · máxima profundidad",
                    }[level]
                  }
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Controla cuánto razonará Gemini antes de redactar la respuesta.
            </p>
          </div>
        )}

        {samplingSupported && (
          <div className="space-y-4 rounded-xl border border-border/80 p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="academic-temperature">Temperatura</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {professionalSettings.temperature.toFixed(2)}
                  {professionalSettings.temperature === RECOMMENDED_TEMPERATURE
                    ? " · recomendada"
                    : ""}
                </span>
              </div>
              <Slider
                id="academic-temperature"
                min={0}
                max={2}
                step={0.05}
                value={[professionalSettings.temperature]}
                onValueChange={([temperature]) => update({ temperature })}
                disabled={disabled}
              />
              {professionalSettings.temperature < RECOMMENDED_TEMPERATURE && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Google recomienda mantener 1.00 en Gemini 3. Por debajo de ese
                  valor la respuesta puede repetirse en bucle o perder calidad,
                  también en la redacción.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="academic-top-p">Top-P</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {professionalSettings.topP.toFixed(2)}
                </span>
              </div>
              <Slider
                id="academic-top-p"
                min={0}
                max={1}
                step={0.05}
                value={[professionalSettings.topP]}
                onValueChange={([topP]) => update({ topP })}
                disabled={disabled}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="academic-length">Longitud del borrador</Label>
          <select
            id="academic-length"
            value={professionalSettings.lengthPreset}
            onChange={(event) =>
              update({
                lengthPreset:
                  event.target
                    .value as ProfessionalGenerationSettings["lengthPreset"],
              })
            }
            disabled={disabled}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="auto">Automática</option>
            <option value="short">Breve · 200–400 palabras</option>
            <option value="medium">Media · 600–1.000</option>
            <option value="long">Larga · 1.500–3.000</option>
            <option value="very-long">Muy larga · 3.000–6.000</option>
            <option value="custom">Número personalizado</option>
          </select>
          {professionalSettings.lengthPreset === "custom" && (
            <Input
              type="number"
              min={100}
              max={12000}
              value={professionalSettings.customWordCount}
              onChange={(event) =>
                update({
                  customWordCount: Math.min(
                    12000,
                    Math.max(100, Number(event.target.value) || 100)
                  ),
                })
              }
              disabled={disabled}
              aria-label="Número aproximado de palabras"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Es una instrucción de escritura, no un corte de tokens.
          </p>
        </div>

        {provider === "gemini" && (
          <div className="space-y-2">
            <Label htmlFor="safety-preset">Filtros del modelo</Label>
            <select
              id="safety-preset"
              value={
                professionalSettings.safetyPreset === "academic"
                  ? "academic"
                  : "standard"
              }
              onChange={(event) =>
                update({
                  safetyPreset: event.target.value as SafetyPreset,
                })
              }
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="academic">Contexto profesional ampliado</option>
              <option value="standard">Estándar de Google</option>
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="academic-system-prompt">Prompt maestro</Label>
          <Textarea
            id="academic-system-prompt"
            value={professionalSettings.systemPrompt}
            onChange={(event) => update({ systemPrompt: event.target.value })}
            disabled={disabled}
            className="min-h-40 font-mono text-xs leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Se aplica tanto al borrador como al asistente que modifica el texto.
          </p>
        </div>
      </div>
    </aside>
  )
}
