"use client"

import * as React from "react"
import { CornerDownLeft, Loader2, Quote, Wand2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/components/app-shell"

interface ResponseChatProps {
  messages: ChatMessage[]
  pendingFragment: string | null
  onClearPendingFragment: () => void
  onSend: (message: string, quotedFragment?: string) => void
  onApplyEdit: (quotedFragment: string, replacement: string, quotedRange?: { from: number; to: number }) => void
  isSending: boolean
}

const QUICK_ACTIONS = [
  { label: "Reescribir", instruction: "Reescribe este fragmento manteniendo el sentido pero con otras palabras." },
  { label: "Ampliar", instruction: "Amplía este fragmento desarrollando la idea con mayor profundidad." },
  { label: "Acortar", instruction: "Sintetiza este fragmento de forma más concisa sin perder el sentido." },
  { label: "Cambiar tono", instruction: "Reescribe este fragmento con un tono aún más académico y riguroso." },
]

export function ResponseChat({
  messages,
  pendingFragment,
  onClearPendingFragment,
  onSend,
  onApplyEdit,
  isSending,
}: ResponseChatProps) {
  const [input, setInput] = React.useState("")
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isSending) return
    onSend(input.trim(), pendingFragment ?? undefined)
    setInput("")
  }

  const handleQuickAction = (instruction: string) => {
    if (!pendingFragment || isSending) return
    onSend(instruction, pendingFragment)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Selecciona un fragmento del texto o escribe abajo para pedirle a Gemini que lo
            reescriba, lo cambie o te dé su opinión.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.quotedFragment && (
                    <div className="mb-1.5 flex items-start gap-1 rounded border border-current/20 bg-black/5 px-1.5 py-1 text-xs opacity-80">
                      <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{message.quotedFragment}</span>
                    </div>
                  )}
                  {message.status === "streaming" && !message.content ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}
                  {message.role === "model" && message.status === "done" && message.quotedFragment && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 h-7 text-xs"
                      onClick={() => onApplyEdit(message.quotedFragment as string, message.content, message.quotedRange)}
                    >
                      <Wand2 className="h-3 w-3" />
                      Aplicar al documento
                    </Button>
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

        {pendingFragment && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={isSending}
                onClick={() => handleQuickAction(action.instruction)}
              >
                {action.label}
              </Button>
            ))}
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
                ? "Indica qué quieres hacer con el fragmento seleccionado…"
                : "Pregunta algo o pide un cambio sobre el texto…"
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
