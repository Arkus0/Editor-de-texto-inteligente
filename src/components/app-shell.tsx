"use client"

import * as React from "react"
import { toast } from "sonner"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Image from "@tiptap/extension-image"
import { TableKit } from "@tiptap/extension-table"
import { TextStyleKit } from "@tiptap/extension-text-style"
import Highlight from "@tiptap/extension-highlight"
import Placeholder from "@tiptap/extension-placeholder"

import { TitleBar, type ExportFormat } from "@/components/chrome/title-bar"
import { StatusBar } from "@/components/chrome/status-bar"
import { EditorToolbar } from "@/components/canvas/editor-toolbar"
import { DocumentCanvas } from "@/components/canvas/document-canvas"
import { AiSidePanel } from "@/components/canvas/ai-side-panel"
import { GeminiPanel } from "@/components/canvas/gemini-panel"
import { SettingsDrawer } from "@/components/settings/settings-drawer"
import { HistorySidebar } from "@/components/history/history-sidebar"
import { extractTextFromFile } from "@/lib/file-extract"
import { chatAboutDocumentStream, generateModelAnswerStream, AVAILABLE_MODELS, type ChatTurn } from "@/lib/gemini"
import { DOCUMENT_ACTIONS, SELECTION_ACTIONS } from "@/lib/ai-actions"
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdown"
import { buildDocumentAst } from "@/lib/export/document-ast"
import { downloadBlob } from "@/lib/export/download"
import { useSettingsStore } from "@/store/useSettingsStore"
import { useHistoryStore, type HistoryEntry } from "@/store/useHistoryStore"
import { useSystemPromptStore } from "@/store/useSystemPromptStore"

export type GenerationStatus = "idle" | "streaming" | "done" | "error"
export type EditorMode = "welcome" | "streaming" | "editing"
export type MessageKind = "chat" | "selection" | "document"

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
  kind?: MessageKind
  quotedFragment?: string
  quotedRange?: { from: number; to: number }
  status: "streaming" | "done" | "error"
}

const emptySubscribe = () => () => {}

function useIsClient() {
  return React.useSyncExternalStore(emptySubscribe, () => true, () => false)
}

function slugifyFilename(name: string): string {
  const clean = name.trim().replace(/\.[^.]+$/, "") || "documento"
  return clean.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "documento"
}

export function AppShell() {
  const isClient = useIsClient()
  const [prompt, setPrompt] = React.useState("")
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const [status, setStatus] = React.useState<GenerationStatus>("idle")
  const [mode, setMode] = React.useState<EditorMode>("welcome")
  const [responseText, setResponseText] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [docName, setDocName] = React.useState("Documento sin título")
  const [isExporting, setIsExporting] = React.useState(false)

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

  const modelLabel = AVAILABLE_MODELS.find((m) => m.id === settings.model)?.label ?? settings.model

  const markdownSyncTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    content: "",
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: true }),
      TableKit.configure({ table: { resizable: false } }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Escribe aquí o pídele a Gemini que redacte por ti…" }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-slate dark:prose-invert max-w-none font-serif text-[1.05rem] leading-[1.9] prose-p:my-4 prose-headings:font-sans focus:outline-none",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      if (markdownSyncTimeout.current) clearTimeout(markdownSyncTimeout.current)
      markdownSyncTimeout.current = setTimeout(() => {
        setResponseText(htmlToMarkdown(updatedEditor.getHTML()))
      }, 400)
    },
  })

  // Atajo de teclado: Ctrl/⌘ + J alterna el panel de Gemini.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setChatOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

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
  }

  const requireApiKey = () => {
    if (!settings.apiKey.trim()) {
      toast.error("Falta la API Key de Google AI Studio", {
        description: "Configúrala en los ajustes de generación.",
      })
      setSettingsOpen(true)
      return false
    }
    return true
  }

  const handleGenerate = async () => {
    if (!requireApiKey()) return
    if (!prompt.trim() && !hasReadyAttachment) return

    setStatus("streaming")
    setMode("streaming")
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
      setMode("editing")
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
      setMode("welcome")
      setErrorMessage(error instanceof Error ? error.message : "Error desconocido al generar la respuesta.")
      toast.error("Error al generar la respuesta")
    }
  }

  const handleStartBlank = () => {
    setStatus("idle")
    setErrorMessage(null)
    setMode("editing")
    editor?.commands.setContent("", { emitUpdate: false })
    setResponseText("")
    requestAnimationFrame(() => editor?.commands.focus("start"))
  }

  const handleLoadHistoryEntry = (entry: HistoryEntry) => {
    setPrompt(entry.prompt)
    setResponseText(entry.response)
    setStatus("done")
    setMode("editing")
    setErrorMessage(null)
    setAttachments([])
    resetChat()
    setHistoryOpen(false)
    setDocName(entry.title?.trim() || "Documento sin título")
    editor?.commands.setContent(markdownToHtml(entry.response), { emitUpdate: false })
  }

  const openPanelWithFragment = (fragment: string, range: { from: number; to: number }) => {
    setPendingFragment(fragment)
    setPendingRange(range)
    setChatOpen(true)
  }

  const handleSelectFragment = (fragment: string, range: { from: number; to: number }) => {
    openPanelWithFragment(fragment, range)
  }

  // Núcleo común: añade el turno de usuario + placeholder del modelo y transmite la respuesta.
  const streamChatTurn = async (
    userMessage: string,
    quotedFragment: string | undefined,
    range: { from: number; to: number } | undefined,
    kind: MessageKind
  ) => {
    if (!requireApiKey()) return

    const history: ChatTurn[] = chatMessages
      .filter((m) => m.status === "done")
      .map((m) => ({ role: m.role, content: m.content }))

    const userChatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      kind,
      quotedFragment,
      quotedRange: range,
      status: "done",
    }
    const modelMessageId = crypto.randomUUID()
    setChatMessages((prev) => [
      ...prev,
      userChatMessage,
      { id: modelMessageId, role: "model", content: "", kind, quotedFragment, quotedRange: range, status: "streaming" },
    ])
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
            ? { ...m, content: error instanceof Error ? error.message : "Error al obtener la respuesta.", status: "error" }
            : m
        )
      )
      toast.error("Error en la conversación con Gemini")
    } finally {
      setIsChatSending(false)
    }
  }

  // Envío desde el panel: para acciones de selección usa el rango pendiente y lo limpia.
  const handleSendChatMessage = (
    userMessage: string,
    quotedFragment: string | undefined,
    kind: MessageKind
  ) => {
    const range = quotedFragment ? pendingRange ?? undefined : undefined
    if (quotedFragment) {
      setPendingFragment(null)
      setPendingRange(null)
    }
    void streamChatTurn(userMessage, quotedFragment, range, kind)
  }

  // Acción rápida desde la burbuja de selección: cita el fragmento con su rango y dispara la instrucción.
  const handleFragmentAction = (
    fragment: string,
    range: { from: number; to: number },
    instruction: string
  ) => {
    setChatOpen(true)
    void streamChatTurn(instruction, fragment, range, "selection")
  }

  // Acciones IA desde la cinta (ribbon).
  const handleRibbonAiAction = (actionId: string) => {
    setChatOpen(true)
    if (actionId === "rewrite") {
      if (!editor) return
      const { from, to, empty } = editor.state.selection
      if (empty) {
        toast.info("Selecciona primero el texto que quieres reescribir")
        return
      }
      const text = editor.state.doc.textBetween(from, to, " ").trim()
      if (!text) return
      const instruction = SELECTION_ACTIONS.find((a) => a.id === "rewrite")!.instruction()
      void streamChatTurn(instruction, text, { from, to }, "selection")
      return
    }
    const docAction = DOCUMENT_ACTIONS.find((a) => a.id === actionId)
    if (docAction) {
      void streamChatTurn(docAction.instruction(), undefined, undefined, "document")
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

  const handleInsert = (text: string) => {
    if (!editor) return
    const html = markdownToHtml(text.trim())
    editor.chain().focus().insertContentAt(editor.state.doc.content.size, html).run()
    toast.success("Insertado en el documento")
  }

  const handleReplaceAll = (text: string) => {
    if (!editor) return
    editor.commands.setContent(markdownToHtml(text.trim()))
    editor.commands.focus("start")
    toast.success("Documento reemplazado")
  }

  const handleExport = async (format: ExportFormat) => {
    if (!editor) return
    const base = slugifyFilename(docName)

    if (format === "md" || format === "txt") {
      downloadBlob(`${base}.${format}`, new Blob([responseText], { type: "text/plain;charset=utf-8" }))
      return
    }

    setIsExporting(true)
    try {
      const ast = buildDocumentAst(editor.getJSON())
      if (format === "pdf") {
        const { exportDocumentToPdf } = await import("@/lib/export/exportPdf")
        await exportDocumentToPdf(ast, `${base}.pdf`)
      } else {
        const { exportDocumentToDocx } = await import("@/lib/export/exportDocx")
        await exportDocumentToDocx(ast, `${base}.docx`)
      }
    } catch (error) {
      console.error(error)
      toast.error(format === "pdf" ? "No se pudo generar el PDF" : "No se pudo generar el documento Word")
    } finally {
      setIsExporting(false)
    }
  }

  if (!isClient) return null

  const canExport = mode === "editing" && responseText.trim().length > 0

  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar
        docName={docName}
        onDocNameChange={setDocName}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleAi={() => setChatOpen((v) => !v)}
        aiOpen={chatOpen}
        onExport={handleExport}
        canExport={canExport}
        isExporting={isExporting}
      />

      {mode === "editing" && (
        <EditorToolbar editor={editor} onAiOpen={() => setChatOpen(true)} onAiAction={handleRibbonAiAction} />
      )}

      <div className="flex min-h-0 flex-1">
        <DocumentCanvas
          editor={editor}
          mode={mode}
          responseText={responseText}
          starter={{
            prompt,
            onPromptChange: setPrompt,
            attachments,
            onFilesSelected: handleFilesSelected,
            onRemoveAttachment: handleRemoveAttachment,
            onGenerate: handleGenerate,
            onStartBlank: handleStartBlank,
            isGenerating: status === "streaming",
            canGenerate: prompt.trim().length > 0 || hasReadyAttachment,
            errorMessage,
          }}
          onSelectFragment={handleSelectFragment}
          onFragmentAction={handleFragmentAction}
        />

        <AiSidePanel expanded={chatOpen} onToggle={() => setChatOpen((v) => !v)} modelLabel={modelLabel}>
          <GeminiPanel
            messages={chatMessages}
            pendingFragment={pendingFragment}
            onClearPendingFragment={() => {
              setPendingFragment(null)
              setPendingRange(null)
            }}
            onSend={handleSendChatMessage}
            onApplyEdit={handleApplyEdit}
            onInsert={handleInsert}
            onReplaceAll={handleReplaceAll}
            isSending={isChatSending}
          />
        </AiSidePanel>
      </div>

      <StatusBar editor={editor} status={status} modelLabel={modelLabel} />

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HistorySidebar open={historyOpen} onOpenChange={setHistoryOpen} onLoad={handleLoadHistoryEntry} />
    </div>
  )
}
