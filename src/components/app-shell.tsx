"use client"

import * as React from "react"
import { History, Settings } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { PromptPanel } from "@/components/left-panel/prompt-panel"
import { ResponseCanvas } from "@/components/canvas/response-canvas"
import { SettingsDrawer } from "@/components/settings/settings-drawer"
import { HistorySidebar } from "@/components/history/history-sidebar"
import { extractTextFromFile } from "@/lib/file-extract"
import { generateModelAnswerStream } from "@/lib/gemini"
import { useSettingsStore } from "@/store/useSettingsStore"
import { useHistoryStore, type HistoryEntry } from "@/store/useHistoryStore"

export type GenerationStatus = "idle" | "streaming" | "done" | "error"

export interface Attachment {
  id: string
  name: string
  size: number
  status: "extracting" | "ready" | "error"
  text: string
}

const emptySubscribe = () => () => {}

function useIsClient() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

export function AppShell() {
  const isClient = useIsClient()
  const [prompt, setPrompt] = React.useState("")
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const [status, setStatus] = React.useState<GenerationStatus>("idle")
  const [responseText, setResponseText] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)

  const settings = useSettingsStore()
  const addHistoryEntry = useHistoryStore((s) => s.add)

  const handleFilesSelected = (files: File[]) => {
    const pending: Attachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      status: "extracting",
      text: "",
    }))
    setAttachments((prev) => [...prev, ...pending])

    files.forEach((file, index) => {
      const attachmentId = pending[index].id
      extractTextFromFile(file)
        .then((text) => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachmentId ? { ...a, status: "ready", text } : a))
          )
        })
        .catch((error: Error) => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachmentId ? { ...a, status: "error" } : a))
          )
          toast.error(`No se pudo procesar "${file.name}"`, { description: error.message })
        })
    })
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleGenerate = async () => {
    if (!settings.apiKey.trim()) {
      toast.error("Falta la API Key de Google AI Studio", {
        description: "Configúrala en los ajustes de generación.",
      })
      setSettingsOpen(true)
      return
    }
    if (!prompt.trim()) return

    setStatus("streaming")
    setResponseText("")
    setErrorMessage(null)

    const contextText = attachments
      .filter((a) => a.status === "ready" && a.text.trim())
      .map((a) => `[Archivo: ${a.name}]\n${a.text}`)
      .join("\n\n---\n\n")

    try {
      const finalText = await generateModelAnswerStream(
        {
          apiKey: settings.apiKey,
          model: settings.model,
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          topP: settings.topP,
          unrestrictedMode: settings.unrestrictedMode,
          prompt,
          contextText,
        },
        (accumulated) => setResponseText(accumulated)
      )
      setStatus("done")
      addHistoryEntry({
        title: "",
        prompt,
        attachmentNames: attachments.map((a) => a.name),
        response: finalText,
        model: settings.model,
      })
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Error desconocido al generar la respuesta.")
      toast.error("Error al generar la respuesta")
    }
  }

  const handleLoadHistoryEntry = (entry: HistoryEntry) => {
    setPrompt(entry.prompt)
    setResponseText(entry.response)
    setStatus("done")
    setErrorMessage(null)
    setAttachments([])
    setHistoryOpen(false)
  }

  if (!isClient) return null

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Editor de Texto Inteligente</h1>
          <p className="text-xs text-muted-foreground">Redacción académica y respuestas modélicas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History />
            Historial
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings />
            Ajustes
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <div className="min-h-0 border-b border-border md:border-b-0 md:border-r">
          <PromptPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            attachments={attachments}
            onFilesSelected={handleFilesSelected}
            onRemoveAttachment={handleRemoveAttachment}
            status={status}
            onGenerate={handleGenerate}
          />
        </div>
        <div className="min-h-0">
          <ResponseCanvas status={status} responseText={responseText} errorMessage={errorMessage} />
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HistorySidebar open={historyOpen} onOpenChange={setHistoryOpen} onLoad={handleLoadHistoryEntry} />
    </div>
  )
}
