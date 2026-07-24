"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, ChevronDown, Copy, Download, FileText, MessageSquareText, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ResponseChat } from "@/components/canvas/response-chat"
import { cn } from "@/lib/utils"
import type { ChatMessage, GenerationStatus } from "@/components/app-shell"

interface ResponseCanvasProps {
  status: GenerationStatus
  responseText: string
  errorMessage: string | null
  chatOpen: boolean
  onToggleChat: () => void
  chatMessages: ChatMessage[]
  pendingFragment: string | null
  onSelectFragment: (fragment: string) => void
  onClearPendingFragment: () => void
  onSendChatMessage: (message: string, quotedFragment?: string) => void
  onApplyEdit: (quotedFragment: string, replacement: string) => void
  isChatSending: boolean
}

const STATUS_LABEL: Record<GenerationStatus, string> = {
  idle: "Listo para generar",
  streaming: "Generando…",
  done: "Completado",
  error: "Error",
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

interface FloatingSelection {
  text: string
  top: number
  left: number
}

export function ResponseCanvas({
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
  const [floatingSelection, setFloatingSelection] = React.useState<FloatingSelection | null>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const floatingButtonRef = React.useRef<HTMLButtonElement>(null)

  const handleCopy = async () => {
    if (!responseText) return
    await navigator.clipboard.writeText(responseText)
    setCopied(true)
    toast.success("Copiado al portapapeles")
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExport = (extension: "md" | "txt") => {
    if (!responseText) return
    downloadTextFile(`respuesta-modelica.${extension}`, responseText)
  }

  const handleMouseUp = () => {
    if (status !== "done") return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !contentRef.current) {
      return
    }
    const text = selection.toString().trim()
    if (!text || !contentRef.current.contains(selection.anchorNode)) {
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    setFloatingSelection({ text, top: rect.top, left: rect.left + rect.width / 2 })
  }

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
    onSelectFragment(floatingSelection.text)
    window.getSelection()?.removeAllRanges()
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
              <Button variant="outline" size="sm" disabled={!hasContent}>
                <Download />
                Exportar
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1">
              <button
                onClick={() => handleExport("md")}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> Markdown (.md)
              </button>
              <button
                onClick={() => handleExport("txt")}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> Texto (.txt)
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div ref={contentRef} onMouseUp={handleMouseUp} className="mx-auto max-w-[70ch] px-8 py-12">
          {status === "error" ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : hasContent ? (
            <div className="prose prose-slate max-w-none font-serif text-[1.05rem] leading-[1.9] prose-p:my-4 prose-headings:font-sans">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseText}</ReactMarkdown>
              {status === "streaming" && (
                <span className="ml-0.5 inline-block h-5 w-2 animate-pulse bg-foreground/60 align-text-bottom" />
              )}
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

      {chatOpen && (
        <ResponseChat
          messages={chatMessages}
          pendingFragment={pendingFragment}
          onClearPendingFragment={onClearPendingFragment}
          onSend={onSendChatMessage}
          onApplyEdit={onApplyEdit}
          isSending={isChatSending}
        />
      )}
    </div>
  )
}
