"use client"

import * as React from "react"
import { PinOff, RotateCcw, Save, Trash2 } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AVAILABLE_MODELS } from "@/lib/gemini"
import { useSettingsStore } from "@/store/useSettingsStore"
import { useSystemPromptStore } from "@/store/useSystemPromptStore"

interface SettingsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const {
    apiKey,
    model,
    temperature,
    topP,
    unrestrictedMode,
    systemPrompt,
    setApiKey,
    setModel,
    setTemperature,
    setTopP,
    setUnrestrictedMode,
    setSystemPrompt,
    resetSystemPrompt,
  } = useSettingsStore()

  const { prompts, save: saveSystemPrompt, promote, remove: removeSystemPrompt } = useSystemPromptStore()
  const [newPromptName, setNewPromptName] = React.useState("")

  const pinnedPrompts = prompts.filter((p) => p.pinned)
  const recentPrompts = prompts.filter((p) => !p.pinned)

  const handleSaveCurrent = () => {
    if (!newPromptName.trim()) return
    saveSystemPrompt(newPromptName, systemPrompt)
    setNewPromptName("")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajustes de generación</SheetTitle>
          <SheetDescription>
            Configura el acceso a la API de Gemini y el comportamiento del modelo.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-6 mt-4 flex-1 px-6">
          <div className="space-y-6 pb-8">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key de Google AI Studio</Label>
              <Input
                id="api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza…"
              />
              <p className="text-xs text-muted-foreground">
                Se guarda únicamente en el almacenamiento local de tu navegador.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Tabs value={model} onValueChange={(value) => setModel(value as typeof model)}>
                <TabsList className="grid h-auto w-full grid-cols-1 gap-1">
                  {AVAILABLE_MODELS.map((m) => (
                    <TabsTrigger key={m.id} value={m.id} className="justify-start px-3 py-2 text-left">
                      {m.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperatura</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {temperature.toFixed(2)}
                </span>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.01}
                value={[temperature]}
                onValueChange={([value]) => setTemperature(value)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="top-p">Top-P</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {topP.toFixed(2)}
                </span>
              </div>
              <Slider
                id="top-p"
                min={0}
                max={1}
                step={0.01}
                value={[topP]}
                onValueChange={([value]) => setTopP(value)}
              />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <Label htmlFor="unrestricted">Modo Académico Sin Restricciones</Label>
                <p className="text-xs text-muted-foreground">
                  Desactiva los filtros de seguridad del modelo (BLOCK_NONE) para evitar falsos
                  positivos en temas académicos complejos.
                </p>
              </div>
              <Switch
                id="unrestricted"
                checked={unrestrictedMode}
                onCheckedChange={setUnrestrictedMode}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Button variant="ghost" size="sm" onClick={resetSystemPrompt}>
                  <RotateCcw />
                  Restaurar
                </Button>
              </div>
              <Textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[280px] font-mono text-xs leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <Label>Guardar prompt actual</Label>
              <div className="flex gap-2">
                <Input
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveCurrent()}
                  placeholder="Nombre, p. ej. «Tono ensayístico duro»"
                  className="h-9 text-sm"
                />
                <Button size="sm" onClick={handleSaveCurrent} disabled={!newPromptName.trim()}>
                  <Save className="h-3.5 w-3.5" />
                  Guardar
                </Button>
              </div>

              {(pinnedPrompts.length > 0 || recentPrompts.length > 0) && (
                <div className="space-y-1.5 pt-1">
                  {pinnedPrompts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => setSystemPrompt(p.prompt)}
                        className="flex-1 truncate text-left font-medium hover:underline"
                        title={p.prompt}
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSystemPrompt(p.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label={`Eliminar «${p.name}»`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {recentPrompts.length > 0 && (
                    <>
                      <p className="pt-2 text-xs font-medium text-muted-foreground">
                        Usados recientemente
                      </p>
                      {recentPrompts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => setSystemPrompt(p.prompt)}
                            className="flex-1 truncate text-left text-muted-foreground hover:underline"
                            title={p.prompt}
                          >
                            {p.prompt.slice(0, 60)}
                            {p.prompt.length > 60 ? "…" : ""}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const name = window.prompt("Nombre para este system prompt:")
                              if (name?.trim()) promote(p.id, name)
                            }}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Guardar en favoritos"
                          >
                            <PinOff className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSystemPrompt(p.id)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                            aria-label="Eliminar del historial"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
