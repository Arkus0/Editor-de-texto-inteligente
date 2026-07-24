"use client"

import * as React from "react"
import { History, Settings } from "lucide-react"
import { toast } from "sonner"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Image from "@tiptap/extension-image"
import { TableKit } from "@tiptap/extension-table"
import { TextStyleKit } from "@tiptap/extension-text-style"
import Highlight from "@tiptap/extension-highlight"
import Placeholder from "@tiptap/extension-placeholder"

import { Button } from "@/components/ui/button"
import { PromptPanel } from "@/components/left-panel/prompt-panel"
import { ResponseCanvas } from "@/components/canvas/response-canvas"
import { SettingsDrawer } from "@/components/settings/settings-drawer"
import { HistorySidebar } from "@/components/history/history-sidebar"
import { extractTextFromFile } from "@/lib/file-extract"
import { chatAboutDocumentStream, generateModelAnswerStream, type ChatTurn } from "@/lib/gemini"
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdown"
import { useSettingsStore } from "@/store/useSettingsStore"
import { useHistoryStore, type HistoryEntry } from "@/store/useHistoryStore"
import { useSystemPromptStore } from "@/store/useSystemPromptStore"

export type GenerationStatus = "idle" | "streaming" | "done" | "error"

export interface Attachment {
  id: string
  name: string
  size: number
  status: "extracting" | "ready" | "error"
  text: string
}

export interface ChatMessage {
  id: string
  role: "user" | "model"
  content: string
  quotedFragment?: string
  quotedRange?: { from: number; to: number }
  status: "streaming" | "done" | "error"
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

  const [chatOpen, setChatOpen] = React.useState(false)
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([])
  const [pendingFragment, setPendingFragment] = React.useState<string | null>(null)
  const [pendingRange, setPendingRange] = React.useState<{ from: number; to: number } | null>(null)
  const [isChatSending, setIsChatSending] = React.useState(false)

  const settings = useSettingsStore()
  const addHistoryEntry = useHistoryStore((s) => s.add)
  const addRecentSystemPrompt = useSystemPromptStore((s) => s.addRecent)

  const markdownSyncTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    content: "",
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: true }),
      TableKit.configure({ table: { resizable: false } }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "El documento generado aparecerá aquí…" }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none font-serif text-[1.05rem] leading-[1.9] prose-p:my-4 prose-headings:font-sans focus:outline-none min-h-[50vh]",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      if (markdownSyncTimeout.current) clearTimeout(markdownSyncTimeout.current)
      markdownSyncTimeout.current = setTimeout(() => {
        setResponseText(htmlToMarkdown(updatedEditor.getHTML()))
      }, 400)
    },
  })

  React.useEffect(() => {
    editor?.setEditable(status === "done")
  }, [editor, status])

  const hasReadyAttachment = attachments.some((a) => a.status === "ready")

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

  const resetChat = () => {
    setChatMessages([])
    setPendingFragment(null)
    setPendingRange(null)
    setChatOpen(false)
  }

  const handleGenerate = async () => {
    if (!settings.apiKey.trim()) {
      toast.error("Falta la API Key de Google AI Studio", {
        description: "Configúrala en los ajustes de generación.",
      })
      setSettingsOpen(true)
      return
    }
    if (!prompt.trim() && !hasReadyAttachment) return

    setStatus("streaming")
    setResponseText("")
    setErrorMessage(null)
    resetChat()

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
      editor?.commands.setContent(markdownToHtml(finalText), { emitUpdate: false })
      addHistoryEntry({
        title: "",
        prompt,
        attachmentNames: attachments.map((a) => a.name),
        response: finalText,
        model: settings.model,
      })
      addRecentSystemPrompt(settings.systemPrompt)
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
    resetChat()
    setHistoryOpen(false)
    editor?.commands.setContent(markdownToHtml(entry.response), { emitUpdate: false })
  }

  const handleSelectFragment = (fragment: string, range: { from: number; to: number }) => {
    setPendingFragment(fragment)
    setPendingRange(range)
    setChatOpen(true)
  }

  const handleSendChatMessage = async (userMessage: string, quotedFragment?: string) => {
    if (!settings.apiKey.trim()) {
      toast.error("Falta la API Key de Google AI Studio", {
        description: "Configúrala en los ajustes de generación.",
      })
      setSettingsOpen(true)
      return
    }

    const history: ChatTurn[] = chatMessages
      .filter((m) => m.status === "done")
      .map((m) => ({ role: m.role, content: m.content }))

    const activeRange = quotedFragment ? pendingRange ?? undefined : undefined

    const userChatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      quotedFragment,
      quotedRange: activeRange,
      status: "done",
    }
    const modelMessageId = crypto.randomUUID()
    const modelChatMessage: ChatMessage = {
      id: modelMessageId,
      role: "model",
      content: "",
      quotedFragment,
      quotedRange: activeRange,
      status: "streaming",
    }

    setChatMessages((prev) => [...prev, userChatMessage, modelChatMessage])
    setPendingFragment(null)
    setPendingRange(null)
    setIsChatSending(true)

    try {
      const finalText = await chatAboutDocumentStream(
        {
          apiKey: settings.apiKey,
          model: settings.model,
          temperature: settings.temperature,
          topP: settings.topP,
          unrestrictedMode: settings.unrestrictedMode,
          documentText: responseText,
          history,
          userMessage,
          quotedFragment,
        },
        (accumulated) => {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === modelMessageId ? { ...m, content: accumulated } : m))
          )
        }
      )
      setChatMessages((prev) =>
        prev.map((m) => (m.id === modelMessageId ? { ...m, content: finalText, status: "done" } : m))
      )
    } catch (error) {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                content: error instanceof Error ? error.message : "Error al obtener la respuesta.",
                status: "error",
              }
            : m
        )
      )
      toast.error("Error en la conversación con Gemini")
    } finally {
      setIsChatSending(false)
    }
  }

  const handleApplyEdit = (
    quotedFragment: string,
    replacement: string,
    quotedRange?: { from: number; to: number }
  ) => {
    if (!editor) return
    const replacementHtml = markdownToHtml(replacement.trim())

    const docSize = editor.state.doc.content.size
    if (
      quotedRange &&
      quotedRange.to <= docSize &&
      editor.state.doc.textBetween(quotedRange.from, quotedRange.to, " ") === quotedFragment
    ) {
      editor.chain().focus().insertContentAt(quotedRange, replacementHtml).run()
      toast.success("Fragmento actualizado en el documento")
      return
    }

    let found: { from: number; to: number } | null = null
    editor.state.doc.descendants((node, pos) => {
      if (found || !node.isText || !node.text) return true
      const idx = node.text.indexOf(quotedFragment)
      if (idx !== -1) {
        found = { from: pos + idx, to: pos + idx + quotedFragment.length }
        return false
      }
      return true
    })

    if (found) {
      editor.chain().focus().insertContentAt(found, replacementHtml).run()
      toast.success("Fragmento actualizado en el documento")
    } else {
      toast.error("No se pudo localizar el fragmento en el documento", {
        description: "El texto pudo cambiar desde que lo seleccionaste. Cópialo manualmente.",
      })
    }
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
            hasReadyAttachment={hasReadyAttachment}
          />
        </div>
        <div className="min-h-0">
          <ResponseCanvas
            editor={editor}
            status={status}
            responseText={responseText}
            errorMessage={errorMessage}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((v) => !v)}
            chatMessages={chatMessages}
            pendingFragment={pendingFragment}
            onSelectFragment={handleSelectFragment}
            onClearPendingFragment={() => {
              setPendingFragment(null)
              setPendingRange(null)
            }}
            onSendChatMessage={handleSendChatMessage}
            onApplyEdit={handleApplyEdit}
            isChatSending={isChatSending}
          />
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HistorySidebar open={historyOpen} onOpenChange={setHistoryOpen} onLoad={handleLoadHistoryEntry} />
    </div>
  )
}
