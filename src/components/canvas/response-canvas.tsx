"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { EditorContent, posToDOMRect, type Editor } from "@tiptap/react"
import { Check, ChevronDown, Copy, Download, FileText, MessageSquareText, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ResponseChat } from "@/components/canvas/response-chat"
import { EditorToolbar } from "@/components/canvas/editor-toolbar"
import { AiSidePanel } from "@/components/canvas/ai-side-panel"
import { buildDocumentAst } from "@/lib/export/document-ast"
import { downloadBlob } from "@/lib/export/download"
import { cn } from "@/lib/utils"
import type { ChatMessage, GenerationStatus } from "@/components/app-shell"

interface ResponseCanvasProps {
  editor: Editor | null
  status: GenerationStatus
  responseText: string
  errorMessage: string | null
  chatOpen: boolean
  onToggleChat: () => void
  chatMessages: ChatMessage[]
  pendingFragment: string | null
  onSelectFragment: (fragment: string, range: { from: number; to: number }) => void
  onClearPendingFragment: () => void
  onSendChatMessage: (message: string, quotedFragment?: string) => void
  onApplyEdit: (quotedFragment: string, replacement: string, quotedRange?: { from: number; to: number }) => void
  isChatSending: boolean
}

const STATUS_LABEL: Record<GenerationStatus, string> = {
  idle: "Listo para generar",
  streaming: "Generando…",
  done: "Completado",
  error: "Error",
}

function downloadTextFile(filename: string, content: string) {
  downloadBlob(filename, new Blob([content], { type: "text/plain;charset=utf-8" }))
}

interface FloatingSelection {
  text: string
  top: number
  left: number
  from: number
  to: number
}

export function ResponseCanvas({
  editor,
  status,
  responseText,
  errorMessage,
  chatOpen,
  onToggleChat,
  chatMessages,
  pendingFragment,
  onSelectFragment,
  onClearPendingFragment,
  onSendChatMessage,
  onApplyEdit,
  isChatSending,
}: ResponseCanvasProps) {
  const [copied, setCopied] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [floatingSelection, setFloatingSelection] = React.useState<FloatingSelection | null>(null)
  const floatingButtonRef = React.useRef<HTMLButtonElement>(null)

  const handleCopy = async () => {
    if (!responseText) return
    await navigator.clipboard.writeText(responseText)
    setCopied(true)
    toast.success("Copiado al portapapeles")
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExportText = (extension: "md" | "txt") => {
    if (!responseText) return
    downloadTextFile(`respuesta-modelica.${extension}`, responseText)
  }

  const handleExportPdf = async () => {
    if (!editor) return
    setIsExporting(true)
    try {
      const { exportDocumentToPdf } = await import("@/lib/export/exportPdf")
      const ast = buildDocumentAst(editor.getJSON())
      await exportDocumentToPdf(ast, "respuesta-modelica.pdf")
    } catch (error) {
      console.error(error)
      toast.error("No se pudo generar el PDF")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportDocx = async () => {
    if (!editor) return
    setIsExporting(true)
    try {
      const { exportDocumentToDocx } = await import("@/lib/export/exportDocx")
      const ast = buildDocumentAst(editor.getJSON())
      await exportDocumentToDocx(ast, "respuesta-modelica.docx")
    } catch (error) {
      console.error(error)
      toast.error("No se pudo generar el documento Word")
    } finally {
      setIsExporting(false)
    }
  }

  React.useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const { from, to, empty } = editor.state.selection
      if (empty || status !== "done") {
        setFloatingSelection(null)
        return
      }
      const text = editor.state.doc.textBetween(from, to, " ").trim()
      if (!text) {
        setFloatingSelection(null)
        return
      }
      const rect = posToDOMRect(editor.view, from, to)
      setFloatingSelection({ text, top: rect.top, left: rect.left + rect.width / 2, from, to })
    }

    editor.on("selectionUpdate", updateSelection)
    return () => {
      editor.off("selectionUpdate", updateSelection)
    }
  }, [editor, status])

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (floatingButtonRef.current?.contains(event.target as Node)) return
      setFloatingSelection(null)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const handleAskAboutSelection = () => {
    if (!floatingSelection) return
    onSelectFragment(floatingSelection.text, { from: floatingSelection.from, to: floatingSelection.to })
    editor?.commands.setTextSelection(floatingSelection.to)
    setFloatingSelection(null)
  }

  const hasContent = responseText.trim().length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              status === "idle" && "bg-muted-foreground/40",
              status === "streaming" && "animate-pulse bg-blue-500",
              status === "done" && "bg-emerald-500",
              status === "error" && "bg-destructive"
            )}
          />
          <span className="text-sm text-muted-foreground">{STATUS_LABEL[status]}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={chatOpen ? "secondary" : "outline"} size="sm" onClick={onToggleChat} disabled={!hasContent}>
            <MessageSquareText />
            Chat
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!hasContent}>
            {copied ? <Check /> : <Copy />}
            Copiar
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={!hasContent || isExporting}>
                <Download />
                Exportar
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <button
                onClick={handleExportPdf}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> PDF (.pdf)
              </button>
              <button
                onClick={handleExportDocx}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> Word (.docx)
              </button>
              <button
                onClick={() => handleExportText("md")}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> Markdown (.md)
              </button>
              <button
                onClick={() => handleExportText("txt")}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> Texto (.txt)
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          {status === "done" && hasContent && <EditorToolbar editor={editor} />}

          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto max-w-[70ch] px-8 py-12">
              {status === "error" ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : status === "done" && hasContent ? (
                <EditorContent editor={editor} />
              ) : hasContent ? (
                <div className="prose prose-slate max-w-none font-serif text-[1.05rem] leading-[1.9] prose-p:my-4 prose-headings:font-sans">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseText}</ReactMarkdown>
                  <span className="ml-0.5 inline-block h-5 w-2 animate-pulse bg-foreground/60 align-text-bottom" />
                </div>
              ) : (
                <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 opacity-40" />
                  <p className="text-sm">La respuesta modélica aparecerá aquí.</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {floatingSelection && (
            <button
              ref={floatingButtonRef}
              onClick={handleAskAboutSelection}
              style={{
                position: "fixed",
                top: Math.max(floatingSelection.top - 42, 8),
                left: floatingSelection.left,
                transform: "translateX(-50%)",
              }}
              className="z-40 flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg transition-transform hover:scale-105"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Preguntar a Gemini
            </button>
          )}
        </div>

        <AiSidePanel expanded={chatOpen} onToggle={onToggleChat} hasContent={hasContent}>
          <ResponseChat
            messages={chatMessages}
            pendingFragment={pendingFragment}
            onClearPendingFragment={onClearPendingFragment}
            onSend={onSendChatMessage}
            onApplyEdit={onApplyEdit}
            isSending={isChatSending}
          />
        </AiSidePanel>
      </div>
    </div>
  )
}
