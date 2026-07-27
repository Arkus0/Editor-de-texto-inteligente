"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  ChevronDown,
  ChevronUp,
  CaseSensitive,
  Regex,
  Replace,
  Search,
  SlidersHorizontal,
  WholeWord,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DEFAULT_SEARCH_OPTIONS,
  MAX_SEARCH_MATCHES,
  SPECIAL_SEARCH_CODES,
  findDocumentMatches,
  matchIndexFromCursor,
  resolveReplacement,
  stepMatchIndex,
  type DocumentSearchFormat,
  type DocumentSearchMatch,
  type DocumentSearchOptions,
} from "@/lib/document-search"

interface FindBarProps {
  editor: Editor | null
  showReplace: boolean
  onClose: () => void
  onToggleReplace: () => void
  onReplaced: (count: number) => void
}

/**
 * Última búsqueda de la sesión. Word recuerda lo último que buscaste al volver
 * a abrir el cuadro, y perderlo obliga a reescribirlo cada vez. Vive fuera del
 * componente porque la barra se desmonta al cerrarse.
 */
let lastQuery = ""

function initialQuery(editor: Editor | null): string {
  if (!editor) return lastQuery
  const { from, to, empty } = editor.state.selection
  if (empty) return lastQuery
  const selected = editor.state.doc.textBetween(from, to, " ").trim()
  // Una selección de varias líneas o muy larga no es lo que se quiere buscar.
  if (!selected || selected.length > 120 || selected.includes("\n")) {
    return lastQuery
  }
  return selected
}

function OptionToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

const FORMAT_FILTERS: Array<{
  key: keyof DocumentSearchFormat
  label: string
}> = [
  { key: "bold", label: "Negrita" },
  { key: "italic", label: "Cursiva" },
  { key: "underline", label: "Subrayado" },
  { key: "strike", label: "Tachado" },
  { key: "highlight", label: "Resaltado" },
  { key: "code", label: "Código" },
  { key: "superscript", label: "Superíndice" },
  { key: "subscript", label: "Subíndice" },
]

/** Sin filtro → exigirlo → excluirlo → sin filtro, como el cuadro de Word. */
function cycleFormat(
  format: DocumentSearchFormat | undefined,
  key: keyof DocumentSearchFormat
): DocumentSearchFormat | undefined {
  const current = format?.[key]
  const next: DocumentSearchFormat = {
    ...format,
    [key]: current === undefined ? true : current ? false : undefined,
  }
  // Un objeto sin ninguna condición debe desaparecer, para no recorrer el
  // documento comprobando marcas que a nadie le importan.
  return Object.values(next).some((value) => value !== undefined)
    ? next
    : undefined
}

function FormatFilterToggle({
  label,
  state,
  onCycle,
}: {
  label: string
  state: boolean | undefined
  onCycle: () => void
}) {
  const description =
    state === undefined
      ? `${label}: sin filtrar`
      : state
        ? `${label}: solo con este formato`
        : `${label}: solo sin este formato`
  return (
    <button
      type="button"
      onClick={onCycle}
      title={description}
      aria-label={description}
      className={cn(
        "rounded border px-1.5 py-0.5 text-xs transition",
        state === undefined && "border-input text-muted-foreground",
        state === true && "border-primary bg-primary/15 text-primary",
        state === false &&
          "border-destructive/60 bg-destructive/10 text-destructive line-through"
      )}
    >
      {label}
    </button>
  )
}

function TextToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded border px-1.5 py-0.5 text-xs transition",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-input text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  )
}

/**
 * Barra de búsqueda acoplada sobre el documento.
 *
 * Word esconde buscar y reemplazar en un cuadro de diálogo o en el panel de
 * navegación, que roba ancho al documento y deja de estar sincronizado con lo
 * que se ve. Aquí la barra no es modal —se puede seguir escribiendo con ella
 * abierta—, todas las coincidencias quedan resaltadas sobre el texto y el
 * contador dice en cuál se está.
 */
export function FindBar({
  editor,
  showReplace,
  onClose,
  onToggleReplace,
  onReplaced,
}: FindBarProps) {
  const [query, setQuery] = React.useState(() => initialQuery(editor))
  const [replacement, setReplacement] = React.useState("")
  const [options, setOptions] = React.useState<DocumentSearchOptions>(
    DEFAULT_SEARCH_OPTIONS
  )
  const [matches, setMatches] = React.useState<DocumentSearchMatch[]>([])
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const queryInputRef = React.useRef<HTMLInputElement>(null)

  const hasFormatFilter = Object.values(options.format ?? {}).some(
    (value) => value !== undefined
  )
  // Con la fila plegada hay que seguir avisando de que hay filtros puestos, o
  // se busca «casa» y no aparece nada sin entender por qué.
  const hasAdvancedOptions =
    hasFormatFilter || Boolean(options.matchPrefix || options.matchSuffix)

  /** Inserta el código donde esté el cursor, como el menú «Especial» de Word. */
  const insertSpecialCode = React.useCallback((code: string) => {
    const input = queryInputRef.current
    if (!input) return
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const next = input.value.slice(0, start) + code + input.value.slice(end)
    lastQuery = next
    setQuery(next)
    // El foco vuelve al cuadro para poder seguir escribiendo la búsqueda.
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + code.length, start + code.length)
    })
  }, [])

  const scrollToMatch = React.useCallback(
    (match: DocumentSearchMatch) => {
      if (!editor) return
      const dom = editor.view.domAtPos(match.from).node
      const element =
        dom instanceof HTMLElement ? dom : dom.parentElement ?? null
      element?.scrollIntoView({ block: "center", behavior: "smooth" })
    },
    [editor]
  )

  React.useEffect(() => {
    const focusFrame = requestAnimationFrame(() => {
      queryInputRef.current?.focus()
      queryInputRef.current?.select()
    })
    return () => cancelAnimationFrame(focusFrame)
  }, [])

  // Al cerrarse, el documento se queda limpio de resaltados.
  React.useEffect(
    () => () => {
      editor?.commands.clearSearchMatches()
    },
    [editor]
  )

  /**
   * Recalcular la búsqueda entera en cada tecla sería lento en un documento
   * largo, así que se espera una pausa breve. La primera coincidencia se elige
   * a partir de dónde está el cursor, no desde el principio del documento.
   */
  React.useEffect(() => {
    if (!editor) return
    const timer = window.setTimeout(() => {
      const found = findDocumentMatches(editor.state.doc, query, options)
      setMatches(found)
      const next =
        found.length === 0
          ? -1
          : matchIndexFromCursor(found, editor.state.selection.from, true)
      setActiveIndex(next)
      editor.commands.setSearchMatches(found, next)
      if (next >= 0) scrollToMatch(found[next])
    }, 140)
    return () => window.clearTimeout(timer)
  }, [editor, options, query, scrollToMatch])

  const goToMatch = React.useCallback(
    (forward: boolean) => {
      if (!editor || matches.length === 0) return
      const next = stepMatchIndex(activeIndex, matches.length, forward)
      setActiveIndex(next)
      editor.commands.setSearchMatches(matches, next)
      scrollToMatch(matches[next])
    },
    [activeIndex, editor, matches, scrollToMatch]
  )

  /**
   * Sustituye la coincidencia activa y deja marcada la siguiente, de forma que
   * pulsar «Reemplazar» repetidamente recorra el documento.
   */
  const replaceCurrent = React.useCallback(() => {
    if (!editor || activeIndex < 0) return
    const match = matches[activeIndex]
    if (!match) return
    const matchedText = editor.state.doc.textBetween(match.from, match.to)
    const text = resolveReplacement(matchedText, query, replacement, options)
    const transaction = editor.state.tr
    if (text) {
      transaction.insertText(text, match.from, match.to)
    } else {
      transaction.delete(match.from, match.to)
    }
    editor.view.dispatch(transaction)
    onReplaced(1)

    const found = findDocumentMatches(editor.state.doc, query, options)
    setMatches(found)
    const next =
      found.length === 0
        ? -1
        : matchIndexFromCursor(found, match.from + text.length, true)
    setActiveIndex(next)
    editor.commands.setSearchMatches(found, next)
    if (next >= 0) scrollToMatch(found[next])
  }, [
    activeIndex,
    editor,
    matches,
    onReplaced,
    options,
    query,
    replacement,
    scrollToMatch,
  ])

  const replaceAll = React.useCallback(() => {
    if (!editor || matches.length === 0) return
    const transaction = editor.state.tr
    // De atrás hacia delante: así cada sustitución no desplaza las posiciones
    // de las que todavía quedan por hacer.
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index]
      const matchedText = editor.state.doc.textBetween(match.from, match.to)
      const text = resolveReplacement(matchedText, query, replacement, options)
      if (text) {
        transaction.insertText(text, match.from, match.to)
      } else {
        transaction.delete(match.from, match.to)
      }
    }
    if (transaction.docChanged) editor.view.dispatch(transaction)
    onReplaced(matches.length)
    setMatches([])
    setActiveIndex(-1)
    editor.commands.clearSearchMatches()
  }, [editor, matches, onReplaced, options, query, replacement])

  const total = matches.length
  const counter =
    query.length === 0
      ? ""
      : total === 0
        ? "Sin resultados"
        : `${activeIndex + 1} de ${total}${
            total >= MAX_SEARCH_MATCHES ? "+" : ""
          }`

  return (
    <div
      role="search"
      aria-label="Buscar en el documento"
      className="pointer-events-auto absolute right-4 top-3 z-30 w-[min(30rem,calc(100%-2rem))] rounded-lg border border-border bg-popover/97 p-2 shadow-lg backdrop-blur"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          onClose()
          editor?.commands.focus()
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <Search className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={queryInputRef}
          value={query}
          onChange={(event) => {
            lastQuery = event.target.value
            setQuery(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              goToMatch(!event.shiftKey)
            }
          }}
          placeholder="Buscar"
          aria-label="Texto a buscar"
          className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <OptionToggle
            active={options.caseSensitive}
            label="Distinguir mayúsculas y minúsculas"
            onClick={() =>
              setOptions((current) => ({
                ...current,
                caseSensitive: !current.caseSensitive,
              }))
            }
          >
            <CaseSensitive className="h-4 w-4" />
          </OptionToggle>
          <OptionToggle
            active={options.wholeWord}
            label="Solo palabras completas"
            onClick={() =>
              setOptions((current) => ({
                ...current,
                wholeWord: !current.wholeWord,
              }))
            }
          >
            <WholeWord className="h-4 w-4" />
          </OptionToggle>
          <OptionToggle
            active={options.regex}
            label="Usar expresión regular"
            onClick={() =>
              setOptions((current) => ({ ...current, regex: !current.regex }))
            }
          >
            <Regex className="h-4 w-4" />
          </OptionToggle>
          <OptionToggle
            active={showAdvanced || hasAdvancedOptions}
            label="Más opciones de búsqueda: formato y caracteres especiales"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </OptionToggle>
        </div>
        <span
          className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {counter}
        </span>
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={total === 0}
            onClick={() => goToMatch(false)}
            aria-label="Coincidencia anterior (Mayús+Intro)"
            title="Anterior · Mayús+Intro"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={total === 0}
            onClick={() => goToMatch(true)}
            aria-label="Coincidencia siguiente (Intro)"
            title="Siguiente · Intro"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleReplace}
            aria-pressed={showReplace}
            aria-label="Mostrar reemplazar (Ctrl+H)"
            title="Reemplazar · Ctrl+H"
          >
            <Replace className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              onClose()
              editor?.commands.focus()
            }}
            aria-label="Cerrar la búsqueda (Esc)"
            title="Cerrar · Esc"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-1.5 space-y-1.5 rounded border border-border/60 bg-muted/30 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Formato
            </span>
            {FORMAT_FILTERS.map(({ key, label }) => (
              <FormatFilterToggle
                key={key}
                label={label}
                state={options.format?.[key]}
                onCycle={() =>
                  setOptions((current) => ({
                    ...current,
                    format: cycleFormat(current.format, key),
                  }))
                }
              />
            ))}
            {hasFormatFilter && (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() =>
                  setOptions((current) => ({ ...current, format: undefined }))
                }
              >
                Quitar formato
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Coincidir
            </span>
            <TextToggle
              active={Boolean(options.matchPrefix)}
              label="Coincidir prefijo"
              onClick={() =>
                setOptions((current) => ({
                  ...current,
                  matchPrefix: !current.matchPrefix,
                }))
              }
            />
            <TextToggle
              active={Boolean(options.matchSuffix)}
              label="Coincidir sufijo"
              onClick={() =>
                setOptions((current) => ({
                  ...current,
                  matchSuffix: !current.matchSuffix,
                }))
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Especial
            </span>
            {SPECIAL_SEARCH_CODES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                title={`${label} (${code})`}
                aria-label={`Insertar ${label}`}
                disabled={options.regex}
                className="rounded border border-input bg-background px-1.5 py-0.5 text-xs disabled:opacity-40 hover:bg-accent"
                onClick={() => insertSpecialCode(code)}
              >
                {label}
              </button>
            ))}
          </div>
          {options.regex && (
            <p className="text-xs text-muted-foreground">
              Los caracteres especiales no se usan con expresiones regulares:
              ahí `^` es el principio de línea.
            </p>
          )}
        </div>
      )}

      {showReplace && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Replace className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                if (event.ctrlKey || event.metaKey) replaceAll()
                else replaceCurrent()
              }
            }}
            placeholder="Reemplazar por"
            aria-label="Texto de reemplazo"
            className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={activeIndex < 0}
            onClick={replaceCurrent}
          >
            Reemplazar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={total === 0}
            onClick={replaceAll}
          >
            Todas
          </Button>
        </div>
      )}
    </div>
  )
}
