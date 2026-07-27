"use client"

import * as React from "react"
import {
  CornerDownLeft,
  Eye,
  FileText,
  Languages,
  Loader2,
  MessageSquare,
  Palette,
  Paperclip,
  PenLine,
  Quote,
  Replace,
  Search,
  Square,
  TextCursorInput,
  Wand2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MarkdownView } from "@/components/canvas/markdown-view"
import { cn } from "@/lib/utils"
import {
  DEFAULT_AI_CONTEXT_OPTIONS,
  estimateIncludedContextCharacters,
  type AiContextOptions,
  type AiContextPreview,
} from "@/lib/ai-context"
import { TRANSLATE_LANGUAGES, translateInstruction } from "@/lib/ai-actions"
import {
  ASSISTANT_PROFILES,
  getAssistantProfile,
  type AssistantProfileId,
  type ResolvedProfileProvider,
} from "@/lib/assistant-profiles"
import {
  editorActionLabel,
  type EditorAssistantAction,
} from "@/lib/editor-assistant"
import type { Attachment, ChatMessage, MessageKind } from "@/components/app-shell"
import type { GroundingSource } from "@/types/desktop"

interface GeminiPanelProps {
  messages: ChatMessage[]
  pendingFragment: string | null
  onClearPendingFragment: () => void
  onSend: (
    message: string,
    quotedFragment: string | undefined,
    kind: MessageKind,
    options: { directApply: boolean; context: AiContextOptions }
  ) => void
  onApplyEdit: (quotedFragment: string, replacement: string, quotedRange?: { from: number; to: number }) => void
  onInsert: (text: string) => void
  onReplaceAll: (text: string) => void
  onApplyEditorActions: (
    messageId: string,
    actions: EditorAssistantAction[],
    quotedRange?: { from: number; to: number }
  ) => void
  attachments: Attachment[]
  onFilesSelected: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  isSending: boolean
  onCancel: () => void
  onAddResearchSource?: (source: GroundingSource) => void
  onNewChat: () => void
  contextPreview: AiContextPreview
  profileId: AssistantProfileId
  onProfileChange: (id: AssistantProfileId) => void
  /** Proveedor real de este perfil, con el aviso si pierde alguna capacidad. */
  providerState: ResolvedProfileProvider
  providerModelLabel: string
  /** Permite forzar el proveedor de este perfil cuando hay dos claves. */
  canSwitchProvider: boolean
  onSwitchProvider: () => void
  /** Lleva el cursor al fragmento fijado y lo hace visible. */
  onRevealFragment: () => void
}

const ACCEPTED_CHAT_FILES = ".pdf,.docx,.odt,.txt"

const PROFILE_ICONS: Record<AssistantProfileId, React.ReactNode> = {
  write: <PenLine className="h-3.5 w-3.5" />,
  research: <Search className="h-3.5 w-3.5" />,
  design: <Palette className="h-3.5 w-3.5" />,
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Tarjeta del fragmento fijado. Antes era una píldora recortada a dos líneas que
 * además se borraba al enviar, así que costaba saber sobre qué se estaba
 * trabajando. Ahora persiste, se puede desplegar y lleva de vuelta al documento.
 */
function SelectionCard({
  fragment,
  onClear,
  onReveal,
}: {
  fragment: string
  onClear: () => void
  onReveal: () => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const words = countWords(fragment)
  const isLong = fragment.length > 160

  return (
    <div className="mb-2 rounded-md border border-primary/40 bg-primary/5">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Quote className="h-3 w-3 shrink-0 text-primary" />
        <span className="text-[11px] font-semibold text-primary">
          Trabajando sobre la selección
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {words} {words === 1 ? "palabra" : "palabras"} ·{" "}
          {fragment.length.toLocaleString("es-ES")} car.
        </span>
      </div>
      <p
        className={cn(
          "px-2 text-xs leading-relaxed text-foreground/80",
          expanded ? "max-h-40 overflow-y-auto whitespace-pre-wrap" : "line-clamp-2"
        )}
      >
        {fragment}
      </p>
      <div className="flex items-center gap-1 px-1.5 py-1">
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {expanded ? "Contraer" : "Ver completo"}
          </button>
        )}
        <button
          type="button"
          onClick={onReveal}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Ver en el documento
        </button>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Soltar
        </button>
      </div>
    </div>
  )
}

export function GeminiPanel({
  messages,
  pendingFragment,
  onClearPendingFragment,
  onSend,
  onApplyEdit,
  onInsert,
  onReplaceAll,
  onApplyEditorActions,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  isSending,
  onCancel,
  onAddResearchSource,
  onNewChat,
  contextPreview,
  profileId,
  onProfileChange,
  providerState,
  providerModelLabel,
  canSwitchProvider,
  onSwitchProvider,
  onRevealFragment,
}: GeminiPanelProps) {
  const [input, setInput] = React.useState("")
  const [showTranslate, setShowTranslate] = React.useState(false)
  const [language, setLanguage] = React.useState<string>(TRANSLATE_LANGUAGES[0])
  const [directApply, setDirectApply] = React.useState(false)
  const [contextOptions, setContextOptions] =
    React.useState<AiContextOptions>(DEFAULT_AI_CONTEXT_OPTIONS)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files)
    if (files.length > 0) {
      e.preventDefault()
      onFilesSelected(files)
    }
  }

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const profile = getAssistantProfile(profileId)

  /**
   * Solo Escribir devuelve texto para insertar. Investigar y Diseñar conversan:
   * su resultado son hallazgos o acciones, nunca un documento de reemplazo.
   */
  const resolveKind = (scope: "selection" | "document"): MessageKind => {
    if (profile.outputMode === "conversation") return "chat"
    if (scope === "selection") return pendingFragment ? "selection" : "chat"
    return "document"
  }

  const run = (instruction: string, scope: "selection" | "document") => {
    if (isSending) return
    if (scope === "selection" && !pendingFragment) return
    onSend(
      instruction,
      scope === "selection" ? pendingFragment ?? undefined : undefined,
      resolveKind(scope),
      { directApply, context: contextOptions }
    )
  }

  const handleSend = () => {
    if (!input.trim() || isSending) return
    const kind: MessageKind =
      profile.outputMode === "conversation"
        ? "chat"
        : pendingFragment
          ? "selection"
          : "chat"
    onSend(input.trim(), pendingFragment ?? undefined, kind, {
      directApply,
      context: contextOptions,
    })
    setInput("")
  }

  const runTranslate = (scope: "selection" | "document") => {
    if (isSending) return
    if (scope === "selection" && !pendingFragment) return
    onSend(
      translateInstruction(language, scope),
      scope === "selection" ? pendingFragment ?? undefined : undefined,
      scope === "selection" ? "selection" : "document",
      { directApply, context: contextOptions }
    )
  }

  const selectionActions = profile.actions.filter(
    (action) => action.scope === "selection"
  )
  const documentActions = profile.actions.filter(
    (action) => action.scope === "document"
  )

  const toggleContextOption = (key: keyof AiContextOptions) => {
    setContextOptions((current) => ({ ...current, [key]: !current[key] }))
  }
  const estimatedContextCharacters = estimateIncludedContextCharacters(
    contextPreview,
    contextOptions
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
            <p className="max-w-[240px] text-xs text-muted-foreground">
              Selecciona texto y elige una acción, pide algo sobre todo el documento, adjunta o
              pega un PDF como referencia, o escribe abajo para conversar con el asistente.
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
                      <MarkdownView>{message.content}</MarkdownView>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}

                  {message.role === "model" && message.status === "done" && (
                    <div className="mt-2 space-y-2">
                      {message.editorActions &&
                        message.editorActions.length > 0 && (
                          <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                              Acciones nativas preparadas
                            </p>
                            <ul className="mb-2 space-y-0.5 text-xs">
                              {message.editorActions.map((action, index) => (
                                <li
                                  key={`${action.type}-${index}`}
                                  className="flex gap-1.5"
                                >
                                  <span aria-hidden="true">•</span>
                                  <span>{editorActionLabel(action)}</span>
                                </li>
                              ))}
                            </ul>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 w-full text-xs"
                              variant={
                                message.editorActionsApplied
                                  ? "secondary"
                                  : "default"
                              }
                              disabled={message.editorActionsApplied}
                              onClick={() =>
                                onApplyEditorActions(
                                  message.id,
                                  message.editorActions as EditorAssistantAction[],
                                  message.quotedRange
                                )
                              }
                            >
                              {message.editorActionsApplied
                                ? "Acciones aplicadas"
                                : `Aplicar ${
                                    message.editorActions.length === 1
                                      ? "acción"
                                      : `${message.editorActions.length} acciones`
                                  }`}
                            </Button>
                          </div>
                        )}
                      {message.sources && message.sources.length > 0 && (
                        <div className="rounded-md border border-border/70 bg-background/50 p-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Fuentes consultadas
                          </p>
                          <div className="space-y-1">
                            {message.sources.map((source) => (
                              <div key={source.url} className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    window.editorDesktop
                                      ? window.editorDesktop.windows.openExternal(source.url)
                                      : window.open(source.url, "_blank", "noopener,noreferrer")
                                  }
                                  className="min-w-0 flex-1 truncate text-left text-xs text-primary hover:underline"
                                  title={source.url}
                                >
                                  {source.title}
                                </button>
                                {onAddResearchSource && (
                                  <button
                                    type="button"
                                    onClick={() => onAddResearchSource(source)}
                                    className="shrink-0 rounded px-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                                    title="Añadir al gestor bibliográfico"
                                  >
                                    + Fuente
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
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
        {attachments.length > 0 && (
          <div className="mb-2 space-y-1.5">
            <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              Documentos de referencia
            </p>
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((att) => (
                <span
                  key={att.id}
                  className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs"
                  title={att.name}
                >
                  {att.status === "extracting" ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <FileText
                      className={cn(
                        "h-3 w-3 shrink-0",
                        att.status === "error" ? "text-destructive" : "text-primary"
                      )}
                    />
                  )}
                  <span className="max-w-[140px] truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att.id)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Quitar ${att.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {pendingFragment && (
          <SelectionCard
            fragment={pendingFragment}
            onClear={onClearPendingFragment}
            onReveal={onRevealFragment}
          />
        )}

        <div className="mb-2 flex items-center justify-between gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
              >
                <Eye className="h-3.5 w-3.5" />
                Contexto antes de enviar
                <span className="rounded bg-muted px-1 font-mono">
                  ≈{estimatedContextCharacters.toLocaleString("es-ES")} car.
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3" align="start">
              <div>
                <p className="text-sm font-semibold">Contexto de esta solicitud</p>
                <p className="text-xs text-muted-foreground">
                  Decide qué información acompaña a tu mensaje. Nada se envía
                  hasta que pulses Enviar.
                </p>
              </div>
              {contextPreview.selectionCharacters > 0 && (
                <div className="flex items-center justify-between rounded-md border border-primary/25 bg-primary/5 px-2 py-1.5 text-xs">
                  <span>Selección actual</span>
                  <span className="font-mono text-muted-foreground">
                    {contextPreview.selectionCharacters.toLocaleString("es-ES")} car.
                  </span>
                </div>
              )}
              <div className="space-y-1">
                {[
                  {
                    key: "includeDocument" as const,
                    label: "Texto del documento",
                    detail: `${contextPreview.documentCharacters.toLocaleString("es-ES")} caracteres`,
                    disabled: contextPreview.documentCharacters === 0,
                  },
                  {
                    key: "includeEditorState" as const,
                    label: "Estructura y capacidades del editor",
                    detail: `≈${contextPreview.editorStateCharacters.toLocaleString("es-ES")} caracteres`,
                    disabled: false,
                  },
                  {
                    key: "includeAttachments" as const,
                    label: "Documentos adjuntos",
                    detail: `${contextPreview.attachmentCount} archivos · ${contextPreview.attachmentCharacters.toLocaleString("es-ES")} caracteres`,
                    disabled: contextPreview.attachmentCount === 0,
                  },
                  {
                    key: "includeHistory" as const,
                    label: "Historial del chat",
                    detail: `${contextPreview.historyTurns} turnos`,
                    disabled: contextPreview.historyTurns === 0,
                  },
                ].map((item) => {
                  const enabled = contextOptions[item.key] && !item.disabled
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={item.disabled}
                      aria-pressed={enabled}
                      onClick={() => toggleContextOption(item.key)}
                      className="flex w-full items-center gap-2 rounded-md border border-border/70 p-2 text-left transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                          enabled
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        )}
                        aria-hidden="true"
                      >
                        {enabled ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">
                          {item.label}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {item.detail}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {!contextOptions.includeEditorState && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-200">
                  Sin la estructura del editor, el asistente podrá responder,
                  pero no sabrá preparar acciones nativas fiables.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                El proveedor activo procesa únicamente las categorías
                habilitadas para esta solicitud.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        {/* Selector de caso de uso */}
        <div className="mb-2 grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5">
          {ASSISTANT_PROFILES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onProfileChange(item.id)}
              title={item.description}
              aria-pressed={profileId === item.id}
              className={cn(
                "flex items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                profileId === item.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PROFILE_ICONS[item.id]}
              {item.label}
            </button>
          ))}
        </div>

        <p className="mb-2 px-1 text-[11px] leading-snug text-muted-foreground">
          {profile.description}
        </p>

        {providerState.notice && (
          <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
            {providerState.notice}
          </p>
        )}

        {/* Acciones del perfil sobre la selección */}
        {selectionActions.length > 0 && (
          <div className="mb-2">
            {pendingFragment ? (
              <div className="flex flex-wrap gap-1.5">
                {selectionActions.map((action) => (
                  <Button
                    key={action.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={isSending}
                    onClick={() => run(action.instruction(), "selection")}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="px-1 text-xs text-muted-foreground">
                Selecciona texto en el documento para trabajar sobre un fragmento
                concreto.
              </p>
            )}
          </div>
        )}

        {/* Acciones del perfil sobre el documento */}
        {documentActions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {documentActions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={isSending}
                onClick={() => run(action.instruction(), "document")}
              >
                {action.label}
              </Button>
            ))}
            {profile.outputMode === "edit" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                disabled={isSending}
                onClick={() => setShowTranslate((value) => !value)}
              >
                <Languages className="h-3 w-3" />
                Traducir
              </Button>
            )}
          </div>
        )}

        {showTranslate && profile.outputMode === "edit" && (
          <div className="mb-2 space-y-2 rounded-md border border-border/70 p-2">
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

        <div className="mb-2 flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={onNewChat}
            title="Nuevo chat"
            aria-label="Nuevo chat"
            disabled={isSending}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          {canSwitchProvider ? (
            <button
              type="button"
              onClick={onSwitchProvider}
              disabled={isSending}
              title={`${providerModelLabel}. Pulsa para usar ${
                providerState.provider === "openrouter" ? "Gemini" : "OpenRouter"
              } en este perfil.`}
              className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {providerModelLabel}
              {providerState.grounding ? " · con búsqueda web" : ""}
            </button>
          ) : (
            <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {providerModelLabel}
              {providerState.grounding ? " · con búsqueda web" : ""}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            variant={directApply ? "default" : "outline"}
            className="h-8 shrink-0 text-xs"
            onClick={() => setDirectApply((value) => !value)}
            title={
              directApply
                ? "La siguiente edición validada se aplicará automáticamente"
                : "Revisar las propuestas antes de aplicarlas"
            }
          >
            {directApply ? "Edición directa" : "Revisar antes"}
          </Button>
        </div>

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_CHAT_FILES}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) onFilesSelected(files)
              e.target.value = ""
            }}
          />
          <Button
            size="icon"
            variant="outline"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Adjuntar PDF, DOCX o TXT"
            title="Adjuntar PDF, DOCX o TXT"
          >
            <Paperclip />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              pendingFragment
                ? "Indica qué hacer con el fragmento…"
                : "Pregunta, pide algo o pega un PDF…"
            }
            className="min-h-[40px] resize-none text-sm"
            rows={1}
          />
          {isSending ? (
            <Button size="icon" variant="destructive" onClick={onCancel} title="Detener generación">
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
              <CornerDownLeft />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
