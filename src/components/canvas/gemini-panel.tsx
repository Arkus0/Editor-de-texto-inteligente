"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  CornerDownLeft,
  FileText,
  Languages,
  Loader2,
  MessageSquare,
  Quote,
  Replace,
  TextCursorInput,
  Wand2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  DOCUMENT_ACTIONS,
  SELECTION_ACTIONS,
  TRANSLATE_LANGUAGES,
  translateInstruction,
} from "@/lib/ai-actions"
import type { ChatMessage, MessageKind } from "@/components/app-shell"

interface GeminiPanelProps {
  messages: ChatMessage[]
  pendingFragment: string | null
  onClearPendingFragment: () => void
  onSend: (message: string, quotedFragment: string | undefined, kind: MessageKind) => void
  onApplyEdit: (quotedFragment: string, replacement: string, quotedRange?: { from: number; to: number }) => void
  onInsert: (text: string) => void
  onReplaceAll: (text: string) => void
  isSending: boolean
}

type PanelTab = "selection" | "document" | "translate"

const TABS: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
  { id: "selection", label: "Selección", icon: <Wand2 className="h-3.5 w-3.5" /> },
  { id: "document", label: "Documento", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "translate", label: "Traducir", icon: <Languages className="h-3.5 w-3.5" /> },
]

export function GeminiPanel({
  messages,
  pendingFragment,
  onClearPendingFragment,
  onSend,
  onApplyEdit,
  onInsert,
  onReplaceAll,
  isSending,
}: GeminiPanelProps) {
  const [input, setInput] = React.useState("")
  const [tab, setTab] = React.useState<PanelTab>("selection")
  const [language, setLanguage] = React.useState<string>(TRANSLATE_LANGUAGES[0])
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  // Al seleccionar un fragmento nuevo, saltar a la pestaña de selección
  // (patrón oficial de ajuste de estado durante el render, sin efectos).
  const [prevFragment, setPrevFragment] = React.useState<string | null>(pendingFragment)
  if (pendingFragment !== prevFragment) {
    setPrevFragment(pendingFragment)
    if (pendingFragment) setTab("selection")
  }

  const handleSend = () => {
    if (!input.trim() || isSending) return
    onSend(input.trim(), pendingFragment ?? undefined, "chat")
    setInput("")
  }

  const runSelectionAction = (instruction: string) => {
    if (!pendingFragment || isSending) return
    onSend(instruction, pendingFragment, "selection")
  }

  const runDocumentAction = (instruction: string) => {
    if (isSending) return
    onSend(instruction, undefined, "document")
  }

  const runTranslate = (scope: "selection" | "document") => {
    if (isSending) return
    if (scope === "selection") {
      if (!pendingFragment) return
      onSend(translateInstruction(language, "selection"), pendingFragment, "selection")
    } else {
      onSend(translateInstruction(language, "document"), undefined, "document")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
            <p className="max-w-[240px] text-xs text-muted-foreground">
              Selecciona texto en el documento y elige una acción, pide algo sobre todo el
              documento, o escribe abajo para conversar con Gemini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.quotedFragment && (
                    <div className="mb-1.5 flex items-start gap-1 rounded border border-current/20 bg-black/5 px-1.5 py-1 text-xs opacity-80 dark:bg-white/5">
                      <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{message.quotedFragment}</span>
                    </div>
                  )}
                  {message.status === "streaming" && !message.content ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : message.role === "model" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-headings:my-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}

                  {message.role === "model" && message.status === "done" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.kind === "selection" && message.quotedFragment && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => onApplyEdit(message.quotedFragment as string, message.content, message.quotedRange)}
                        >
                          <Wand2 className="h-3 w-3" />
                          Aplicar al fragmento
                        </Button>
                      )}
                      {message.kind === "document" && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => onInsert(message.content)}
                          >
                            <TextCursorInput className="h-3 w-3" />
                            Insertar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => onReplaceAll(message.content)}
                          >
                            <Replace className="h-3 w-3" />
                            Reemplazar documento
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border p-3">
        {pendingFragment && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-border bg-accent/50 px-2 py-1.5 text-xs">
            <Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="line-clamp-2 flex-1 text-muted-foreground">{pendingFragment}</span>
            <button
              type="button"
              onClick={onClearPendingFragment}
              className="shrink-0 rounded p-0.5 hover:bg-accent"
              aria-label="Quitar fragmento seleccionado"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Selector de modo de acción */}
        <div className="mb-2 grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "selection" && (
          <div className="mb-2">
            {pendingFragment ? (
              <div className="flex flex-wrap gap-1.5">
                {SELECTION_ACTIONS.map((action) => (
                  <Button
                    key={action.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={isSending}
                    onClick={() => runSelectionAction(action.instruction())}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="px-1 text-xs text-muted-foreground">
                Selecciona texto en el documento para reescribirlo, ampliarlo, corregirlo…
              </p>
            )}
          </div>
        )}

        {tab === "document" && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {DOCUMENT_ACTIONS.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={isSending}
                onClick={() => runDocumentAction(action.instruction())}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {tab === "translate" && (
          <div className="mb-2 space-y-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              {TRANSLATE_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 text-xs"
                disabled={isSending || !pendingFragment}
                onClick={() => runTranslate("selection")}
              >
                Selección
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 text-xs"
                disabled={isSending}
                onClick={() => runTranslate("document")}
              >
                Documento
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              pendingFragment
                ? "Indica qué hacer con el fragmento…"
                : "Pregunta o pide algo sobre el texto…"
            }
            className="min-h-[40px] resize-none text-sm"
            rows={1}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isSending}>
            {isSending ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
          </Button>
        </div>
      </div>
    </div>
  )
}
