"use client"

import * as React from "react"
import {
  BookOpenText,
  Bot,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  Route,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/gemini"
import {
  friendlyOpenRouterErrorMessage,
  testOpenRouterApiKey,
} from "@/lib/openrouter"
import { useAcademicStore } from "@/store/useAcademicStore"
import { useSettingsStore } from "@/store/useSettingsStore"

interface SettingsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDrawer({
  open,
  onOpenChange,
}: SettingsDrawerProps) {
  const {
    provider,
    setProvider,
    apiKey,
    setApiKey,
    openRouterApiKey,
    setOpenRouterApiKey,
    systemPrompt,
    setSystemPrompt,
    resetSystemPrompt,
  } = useSettingsStore()
  const activeProviderName =
    provider === "openrouter" ? "OpenRouter" : "Gemini"
  const activeApiKey =
    provider === "openrouter" ? openRouterApiKey : apiKey
  const workspaceMode = useAcademicStore((state) => state.mode)
  const professionalSystemPrompt = useAcademicStore(
    (state) => state.professionalSettings.systemPrompt
  )
  const updateProfessionalSettings = useAcademicStore(
    (state) => state.updateProfessionalSettings
  )
  const activeSystemPrompt =
    workspaceMode === "professional" ? professionalSystemPrompt : systemPrompt
  const setActiveSystemPrompt = (value: string) => {
    if (workspaceMode === "professional") {
      updateProfessionalSettings({ systemPrompt: value })
    } else {
      setSystemPrompt(value)
    }
  }
  const resetActiveSystemPrompt = () => {
    if (workspaceMode === "professional") {
      updateProfessionalSettings({ systemPrompt: DEFAULT_SYSTEM_PROMPT })
    } else {
      resetSystemPrompt()
    }
  }
  const apiKeyConfigured = Boolean(activeApiKey.trim())
  const [apiKeyDraft, setApiKeyDraft] = React.useState("")
  const [savingKey, setSavingKey] = React.useState(false)
  const [keyStatus, setKeyStatus] = React.useState<
    "idle" | "testing" | "success" | "error"
  >(apiKeyConfigured ? "success" : "idle")
  const [keyMessage, setKeyMessage] = React.useState("")

  const handleSaveApiKey = async () => {
    const nextKey = apiKeyDraft.trim()
    if (!nextKey) return
    setSavingKey(true)
    setKeyStatus("testing")
    setKeyMessage(
      `Guardando y comprobando la conexión con ${activeProviderName}…`
    )
    try {
      if (provider === "openrouter") {
        const result = await testOpenRouterApiKey(nextKey)
        setOpenRouterApiKey(nextKey)
        setKeyMessage(
          result.is_free_tier
            ? "Conexión correcta. La cuenta está en el nivel gratuito."
            : "Conexión correcta. Puedes usar el enrutador gratuito o cualquier modelo habilitado."
        )
      } else if (window.editorDesktop) {
        const result = await window.editorDesktop.ai.testKey(nextKey)
        setApiKey(nextKey)
        setKeyMessage(`Conexión correcta. Modelo comprobado: ${result.model}.`)
      } else {
        setApiKey(nextKey)
        setKeyMessage("Clave guardada en el almacenamiento local de esta aplicación.")
      }
      setKeyStatus("success")
      setApiKeyDraft("")
    } catch (error) {
      setKeyStatus("error")
      setKeyMessage(
        provider === "openrouter"
          ? friendlyOpenRouterErrorMessage(error)
          : error instanceof Error
            ? error.message
          : `${activeProviderName} no aceptó la clave. Revisa que esté completa y vuelve a intentarlo.`
      )
    } finally {
      setSavingKey(false)
    }
  }

  const handleClearApiKey = () => {
    if (provider === "openrouter") setOpenRouterApiKey("")
    else setApiKey("")
    setApiKeyDraft("")
    setKeyStatus("idle")
    setKeyMessage("")
  }

  const openApiKeyPage = () => {
    const url =
      provider === "openrouter"
        ? "https://openrouter.ai/settings/keys"
        : "https://aistudio.google.com/apikey"
    if (window.editorDesktop) {
      void window.editorDesktop.windows.openExternal(url)
    } else {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Ajustes de IA</SheetTitle>
          <SheetDescription>
            Elige proveedor, configura su clave y controla las instrucciones
            que guían la redacción.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-6 mt-4 flex-1 px-6">
          <div className="space-y-5 pb-8">
            <div
              className="grid grid-cols-2 gap-2 rounded-xl border border-border p-1"
              role="group"
              aria-label="Proveedor de IA activo"
            >
              <Button
                type="button"
                variant={provider === "gemini" ? "default" : "ghost"}
                aria-pressed={provider === "gemini"}
                onClick={() => {
                  setProvider("gemini")
                  setKeyStatus(apiKey.trim() ? "success" : "idle")
                  setKeyMessage("")
                  setApiKeyDraft("")
                }}
              >
                <Bot />
                Gemini
              </Button>
              <Button
                type="button"
                variant={provider === "openrouter" ? "default" : "ghost"}
                aria-pressed={provider === "openrouter"}
                onClick={() => {
                  setProvider("openrouter")
                  setKeyStatus(
                    openRouterApiKey.trim() ? "success" : "idle"
                  )
                  setKeyMessage("")
                  setApiKeyDraft("")
                }}
              >
                <Route />
                OpenRouter gratis
              </Button>
            </div>

            <div className="space-y-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 font-semibold">
                  <KeyRound className="h-4 w-4" />
                  Activar {activeProviderName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {typeof window !== "undefined" && window.editorDesktop
                    ? "La clave se guarda en el perfil local de esta aplicación."
                    : "La clave se guarda en el almacenamiento local de este navegador."}
                </p>
              </div>

              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </span>
                  <div className="space-y-2">
                    <p>
                      Crea una API Key en{" "}
                      {provider === "openrouter"
                        ? "OpenRouter"
                        : "Google AI Studio"}
                      .
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openApiKeyPage}
                    >
                      <ExternalLink />
                      Abrir{" "}
                      {provider === "openrouter"
                        ? "OpenRouter"
                        : "Google AI Studio"}
                    </Button>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    2
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="api-key">Pega aquí la API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      autoComplete="off"
                      value={apiKeyDraft}
                      onChange={(event) => {
                        setApiKeyDraft(event.target.value)
                        if (keyStatus === "error") setKeyStatus("idle")
                      }}
                      onKeyDown={(event) =>
                        event.key === "Enter" && void handleSaveApiKey()
                      }
                      placeholder={
                        apiKeyConfigured
                          ? "Clave configurada; pega otra para reemplazarla"
                          : provider === "openrouter"
                            ? "sk-or-v1-…"
                            : "AIza…"
                      }
                    />
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    3
                  </span>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => void handleSaveApiKey()}
                    disabled={!apiKeyDraft.trim() || savingKey}
                  >
                    {savingKey ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <CheckCircle2 />
                    )}
                    Guardar y comprobar
                  </Button>
                </li>
              </ol>

              {keyStatus !== "idle" && (
                <div
                  role="status"
                  className={
                    keyStatus === "error"
                      ? "flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                      : keyStatus === "success"
                        ? "flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300"
                        : "flex gap-2 rounded-lg border p-3 text-xs text-muted-foreground"
                  }
                >
                  {keyStatus === "testing" ? (
                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                  ) : keyStatus === "error" ? (
                    <CircleAlert className="h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {keyMessage ||
                      (apiKeyConfigured
                        ? `Clave de ${activeProviderName} configurada.`
                        : "Introduce una clave para continuar.")}
                  </span>
                </div>
              )}

              {apiKeyConfigured && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="text-left text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                >
                  Eliminar la clave guardada
                </button>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <BookOpenText className="h-4 w-4 text-primary" />
                    Prompt maestro activo
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se usa en el modo{" "}
                    {workspaceMode === "professional"
                      ? "Profesional"
                      : "Rápido"}{" "}
                    para el borrador y para las modificaciones del asistente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={resetActiveSystemPrompt}
                  aria-label="Restaurar prompt maestro"
                  title="Restaurar prompt maestro"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <Label htmlFor="active-system-prompt" className="sr-only">
                Prompt maestro activo
              </Label>
              <Textarea
                id="active-system-prompt"
                value={activeSystemPrompt}
                onChange={(event) => setActiveSystemPrompt(event.target.value)}
                className="min-h-48 font-mono text-xs leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Los perfiles profesionales pueden guardar prompts diferentes.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Control y privacidad
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                El documento y los materiales solo se envían al proveedor
                activo cuando generas contenido o escribes al asistente. El
                núcleo estable usa una sola solicitud por acción, sin
                reintentos automáticos. OpenRouter reenvía la solicitud al
                proveedor del modelo que seleccione; sus límites gratuitos,
                privacidad y disponibilidad pueden variar. Los controles solo
                aparecen cuando el modelo admite realmente esos parámetros.
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
