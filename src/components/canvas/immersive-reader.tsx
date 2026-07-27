"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  BookOpenText,
  Gauge,
  Minus,
  Pause,
  Play,
  Plus,
  Square,
  Volume2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { extractReaderBlocks, type ReaderBlock } from "@/lib/reader-content"
import { cn } from "@/lib/utils"

type ReaderTheme = "paper" | "sepia" | "night"
type ReaderWidth = "narrow" | "medium" | "wide"
type LineFocus = 0 | 1 | 3 | 5

interface ImmersiveReaderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editor: Editor | null
  documentTitle: string
}

const WIDTHS: Record<ReaderWidth, string> = {
  narrow: "max-w-2xl",
  medium: "max-w-4xl",
  wide: "max-w-6xl",
}

const THEMES: Record<
  ReaderTheme,
  { page: string; text: string; muted: string; selected: string }
> = {
  paper: {
    page: "bg-white",
    text: "text-slate-950",
    muted: "text-slate-400",
    selected: "bg-blue-50 ring-blue-300",
  },
  sepia: {
    page: "bg-[#f6eedb]",
    text: "text-[#352d21]",
    muted: "text-[#9c8d76]",
    selected: "bg-[#eadcbf] ring-[#b99b68]",
  },
  night: {
    page: "bg-[#17202b]",
    text: "text-slate-100",
    muted: "text-slate-600",
    selected: "bg-slate-700 ring-sky-500",
  },
}

function localSystemVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return []
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.localService)
    .sort((left, right) => left.name.localeCompare(right.name))
}

function blockLabel(block: ReaderBlock): string {
  if (block.kind === "heading") return `Título ${block.level ?? 1}`
  if (block.kind === "listItem") return "Elemento de lista"
  if (block.kind === "quote") return "Cita"
  if (block.kind === "caption") return "Rótulo"
  if (block.kind === "equation") return "Ecuación"
  if (block.kind === "table") return "Tabla"
  return "Párrafo"
}

export function ImmersiveReader({
  open,
  onOpenChange,
  editor,
  documentTitle,
}: ImmersiveReaderProps) {
  const blocks = React.useMemo(
    () => extractReaderBlocks(editor?.getJSON()),
    [editor]
  )
  const [theme, setTheme] = React.useState<ReaderTheme>("paper")
  const [width, setWidth] = React.useState<ReaderWidth>("medium")
  const [fontSize, setFontSize] = React.useState(21)
  const [lineHeight, setLineHeight] = React.useState(1.8)
  const [lineFocus, setLineFocus] = React.useState<LineFocus>(3)
  const [activeBlock, setActiveBlock] = React.useState(0)
  const [rate, setRate] = React.useState(1)
  const [localVoices, setLocalVoices] = React.useState(localSystemVoices)
  const [selectedVoiceUri, setSelectedVoiceUri] = React.useState("")
  const [isSpeaking, setIsSpeaking] = React.useState(false)
  const [isPaused, setIsPaused] = React.useState(false)
  const speakFromRef = React.useRef<(index: number) => void>(() => undefined)
  /**
   * Identifica la lectura en curso.
   *
   * `speechSynthesis.cancel()` también dispara el `onend` de lo que estaba
   * sonando, y ese `onend` es justo el que encadena el bloque siguiente. Sin
   * distinguir «terminó de leerse» de «lo hemos cortado», parar la lectura
   * arrancaba el párrafo siguiente, cerrar el lector seguía hablando con el
   * diálogo cerrado, y saltar a un bloque leía otro distinto. Cada lectura
   * recibe un número y el `onend` solo encadena si sigue siendo la vigente.
   */
  const speechRunRef = React.useRef(0)

  const selectedVoice =
    localVoices.find((voice) => voice.voiceURI === selectedVoiceUri) ??
    localVoices[0]
  const colors = THEMES[theme]

  React.useEffect(() => {
    if (!("speechSynthesis" in window)) return
    const updateVoices = () => setLocalVoices(localSystemVoices())
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices)
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices)
      // También aquí hay que invalidar la lectura: si el lector se desmonta
      // mientras habla, el `onend` de este `cancel()` encadenaría el bloque
      // siguiente y la voz seguiría sonando sin ninguna ventana que la pare.
      speechRunRef.current += 1
      window.speechSynthesis.cancel()
    }
  }, [])

  const stopReading = React.useCallback(() => {
    speechRunRef.current += 1
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [])

  /**
   * Cerrar el lector desde fuera —otra herramienta, un atajo del shell— no pasa
   * por `onOpenChange`, y la voz se quedaba hablando sola con el diálogo ya
   * cerrado.
   *
   * Va en dos partes a propósito. Los indicadores de React se ajustan durante el
   * render, que es la forma recomendada de reaccionar a un cambio de propiedad
   * sin provocar un segundo commit; parar la voz es tocar un sistema externo y
   * eso solo puede hacerse en un efecto.
   */
  const [wasOpen, setWasOpen] = React.useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setIsSpeaking(false)
      setIsPaused(false)
    }
  }

  React.useEffect(() => {
    if (open) return
    speechRunRef.current += 1
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
  }, [open])

  const speakFrom = React.useCallback(
    (index: number) => {
      if (
        !selectedVoice ||
        !("speechSynthesis" in window) ||
        index < 0 ||
        index >= blocks.length
      ) {
        speechRunRef.current += 1
        if ("speechSynthesis" in window) window.speechSynthesis.cancel()
        setIsSpeaking(false)
        setIsPaused(false)
        return
      }
      // Invalida el encadenado anterior antes de cortar: el `onend` que provoque
      // este `cancel()` ya no coincidirá con la lectura vigente.
      speechRunRef.current += 1
      const run = speechRunRef.current
      window.speechSynthesis.cancel()
      setActiveBlock(index)
      setIsSpeaking(true)
      setIsPaused(false)

      const utterance = new SpeechSynthesisUtterance(blocks[index].text)
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang
      utterance.rate = rate
      utterance.onend = () => {
        if (speechRunRef.current !== run) return
        if (index + 1 < blocks.length) {
          speakFromRef.current(index + 1)
        } else {
          setIsSpeaking(false)
          setIsPaused(false)
        }
      }
      utterance.onerror = () => {
        if (speechRunRef.current !== run) return
        setIsSpeaking(false)
        setIsPaused(false)
      }
      window.speechSynthesis.speak(utterance)
      window.requestAnimationFrame(() =>
        document
          .getElementById(blocks[index].id)
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      )
    },
    [blocks, rate, selectedVoice]
  )
  React.useEffect(() => {
    speakFromRef.current = speakFrom
  }, [speakFrom])

  const togglePause = () => {
    if (!("speechSynthesis" in window) || !isSpeaking) return
    if (isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
    } else {
      window.speechSynthesis.pause()
      setIsPaused(true)
    }
  }

  const isDimmed = (index: number) => {
    if (lineFocus === 0) return false
    const radius = Math.floor(lineFocus / 2)
    return Math.abs(index - activeBlock) > radius
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) stopReading()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="!left-0 !top-0 h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 gap-0 overflow-hidden border-0 bg-slate-100 p-0 sm:!max-w-none sm:rounded-none dark:bg-slate-950">
        <DialogTitle className="sr-only">Lector inmersivo</DialogTitle>
        <DialogDescription className="sr-only">
          Vista de lectura sin edición, con foco de línea y lectura mediante
          voces locales del sistema.
        </DialogDescription>

        <header className="flex min-h-16 flex-wrap items-center gap-2 border-b bg-background px-4 py-2 pr-14 shadow-sm">
          <div className="mr-auto flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpenText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Lector inmersivo</p>
              <p className="truncate text-xs text-muted-foreground">
                {documentTitle} · completamente local
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setFontSize((value) => Math.max(16, value - 1))}
              aria-label="Reducir texto"
            >
              <Minus />
            </Button>
            <span className="w-10 text-center text-xs">{fontSize}px</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setFontSize((value) => Math.min(34, value + 1))}
              aria-label="Aumentar texto"
            >
              <Plus />
            </Button>
          </div>

          <select
            value={width}
            onChange={(event) => setWidth(event.target.value as ReaderWidth)}
            className="h-9 rounded-md border bg-background px-2 text-xs"
            aria-label="Ancho de lectura"
          >
            <option value="narrow">Columna estrecha</option>
            <option value="medium">Columna media</option>
            <option value="wide">Columna amplia</option>
          </select>

          <select
            value={lineFocus}
            onChange={(event) =>
              setLineFocus(Number(event.target.value) as LineFocus)
            }
            className="h-9 rounded-md border bg-background px-2 text-xs"
            aria-label="Foco de línea"
          >
            <option value={0}>Sin foco</option>
            <option value={1}>Foco: 1 bloque</option>
            <option value={3}>Foco: 3 bloques</option>
            <option value={5}>Foco: 5 bloques</option>
          </select>

          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            {(["paper", "sepia", "night"] as ReaderTheme[]).map(
              (themeOption) => (
                <button
                  key={themeOption}
                  type="button"
                  onClick={() => setTheme(themeOption)}
                  aria-label={
                    themeOption === "paper"
                      ? "Tema papel"
                      : themeOption === "sepia"
                        ? "Tema sepia"
                        : "Tema nocturno"
                  }
                  aria-pressed={theme === themeOption}
                  className={cn(
                    "h-7 w-7 rounded-full border-2",
                    themeOption === "paper"
                      ? "bg-white"
                      : themeOption === "sepia"
                        ? "bg-[#f0dfbd]"
                        : "bg-[#17202b]",
                    theme === themeOption
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  )}
                />
              )
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-2">
            <Button
              type="button"
              size="sm"
              onClick={() => speakFrom(activeBlock)}
              disabled={!selectedVoice || blocks.length === 0 || isSpeaking}
            >
              <Play />
              Leer desde aquí
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={togglePause}
              disabled={!isSpeaking}
            >
              <Pause />
              {isPaused ? "Continuar" : "Pausar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={stopReading}
              disabled={!isSpeaking}
            >
              <Square />
              Detener
            </Button>

            <label className="flex items-center gap-2 text-xs">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Voz local</span>
              <select
                value={selectedVoice?.voiceURI ?? ""}
                onChange={(event) => setSelectedVoiceUri(event.target.value)}
                className="h-8 max-w-56 rounded border bg-background px-2"
                disabled={localVoices.length === 0}
                aria-label="Voz local"
              >
                {localVoices.length === 0 ? (
                  <option value="">No hay voces locales instaladas</option>
                ) : (
                  localVoices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} · {voice.lang}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="flex min-w-40 items-center gap-2 text-xs">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <span>Velocidad</span>
              <Slider
                value={[rate]}
                min={0.6}
                max={1.6}
                step={0.1}
                onValueChange={([value]) => setRate(value)}
                aria-label="Velocidad de lectura"
              />
              <span className="w-8 text-right tabular-nums">{rate.toFixed(1)}×</span>
            </label>

            <label className="ml-auto flex items-center gap-2 text-xs">
              Interlineado
              <select
                value={lineHeight}
                onChange={(event) => setLineHeight(Number(event.target.value))}
                className="h-8 rounded border bg-background px-2"
              >
                <option value={1.5}>1,5</option>
                <option value={1.8}>1,8</option>
                <option value={2.1}>2,1</option>
              </select>
            </label>
          </div>

          {localVoices.length === 0 && (
            <p className="border-b bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-900 dark:text-amber-100">
              La lectura está desactivada porque el sistema no ha expuesto una
              voz local. No se usará una voz remota como sustitución.
            </p>
          )}

          <main
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-5 py-10 transition-colors",
              colors.page,
              colors.text
            )}
          >
            <div
              className={cn("mx-auto space-y-3 transition-all", WIDTHS[width])}
              style={{ fontSize: `${fontSize}px`, lineHeight }}
            >
              {blocks.length === 0 ? (
                <p className="py-24 text-center opacity-60">
                  El documento todavía no contiene texto para leer.
                </p>
              ) : (
                blocks.map((block, index) => (
                  <button
                    id={block.id}
                    key={block.id}
                    type="button"
                    onClick={() => {
                      stopReading()
                      setActiveBlock(index)
                    }}
                    className={cn(
                      "block w-full rounded-lg px-4 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2",
                      index === activeBlock && `ring-1 ${colors.selected}`,
                      isDimmed(index)
                        ? `${colors.muted} opacity-45`
                        : colors.text,
                      block.kind === "heading" && "font-semibold",
                      block.kind === "listItem" && "pl-10 before:mr-3 before:content-['•']",
                      block.kind === "quote" && "border-l-4 border-current italic",
                      (block.kind === "caption" ||
                        block.kind === "equation" ||
                        block.kind === "table") &&
                        "font-mono text-[0.86em]"
                    )}
                    aria-current={index === activeBlock ? "true" : undefined}
                    aria-label={`${blockLabel(block)}: ${block.text}`}
                  >
                    {block.text}
                  </button>
                ))
              )}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
