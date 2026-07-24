"use client"

import { RotateCcw } from "lucide-react"

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
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
