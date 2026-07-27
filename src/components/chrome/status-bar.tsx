"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { BookOpen, Check, FileText, Languages, Loader2, Minus, Plus } from "lucide-react"

import type { GenerationStatus } from "@/components/app-shell"
import { cn } from "@/lib/utils"
import {
  PROOFING_LANGUAGE_OPTIONS,
  type DocumentLayoutSettings,
} from "@/types/document"

interface StatusBarProps {
  editor: Editor | null
  status: GenerationStatus
  modelLabel: string
  proofingLanguage: string
  layout: DocumentLayoutSettings
  onLayoutChange: (layout: DocumentLayoutSettings) => void
  immersiveReaderOpen: boolean
  onImmersiveReaderChange: (open: boolean) => void
  onProofingLanguageChange: (
    language: string,
    scope: "document" | "selection",
    range?: { from: number; to: number }
  ) => void
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function StatusBar({
  editor,
  status,
  modelLabel,
  proofingLanguage,
  layout,
  onLayoutChange,
  immersiveReaderOpen,
  onImmersiveReaderChange,
  onProofingLanguageChange,
}: StatusBarProps) {
  const [, refreshSelection] = React.useReducer((count) => count + 1, 0)
  const [documentMetrics, setDocumentMetrics] = React.useState({
    words: 0,
    chars: 0,
  })
  const proofingTargetRef = React.useRef<{
    scope: "document" | "selection"
    range?: { from: number; to: number }
  } | null>(null)
  const lastProofingRangeRef = React.useRef<{
    from: number
    to: number
  } | null>(null)

  React.useEffect(() => {
    if (!editor) return
    let timeout: ReturnType<typeof setTimeout> | null = null
    let idleHandle = 0
    const updateMetrics = () => {
      const text = editor.getText()
      const words = countWords(text)
      const chars = text.length
      setDocumentMetrics((current) =>
        current.words === words && current.chars === chars
          ? current
          : { words, chars }
      )
      idleHandle = 0
    }
    const scheduleMetrics = (event?: {
      transaction?: { docChanged: boolean }
    }) => {
      if (event?.transaction && !event.transaction.docChanged) return
      if (timeout) clearTimeout(timeout)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
        idleHandle = 0
      }
      timeout = setTimeout(() => {
        timeout = null
        if ("requestIdleCallback" in window) {
          idleHandle = window.requestIdleCallback(updateMetrics, {
            timeout: 800,
          })
        } else {
          updateMetrics()
        }
      }, 180)
    }
    updateMetrics()
    editor.on("transaction", scheduleMetrics)
    let selectionSignature = editor.state.selection.empty
      ? "empty"
      : `${editor.state.selection.from}:${editor.state.selection.to}`
    const updateSelection = () => {
      const currentSelection = editor.state.selection
      if (!currentSelection.empty) {
        lastProofingRangeRef.current = {
          from: currentSelection.from,
          to: currentSelection.to,
        }
      } else if (editor.isFocused) {
        lastProofingRangeRef.current = null
      }
      const nextSignature = currentSelection.empty
        ? "empty"
        : `${currentSelection.from}:${currentSelection.to}`
      if (nextSignature === selectionSignature) return
      selectionSignature = nextSignature
      refreshSelection()
    }
    const clearCollapsedSelection = () => {
      if (editor.state.selection.empty) lastProofingRangeRef.current = null
    }
    editor.on("selectionUpdate", updateSelection)
    editor.on("focus", clearCollapsedSelection)
    return () => {
      if (timeout) clearTimeout(timeout)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
      }
      editor.off("transaction", scheduleMetrics)
      editor.off("selectionUpdate", updateSelection)
      editor.off("focus", clearCollapsedSelection)
    }
  }, [editor])

  const { words, chars } = documentMetrics
  const selection = editor?.state.selection
  const selectedText =
    editor && selection && !selection.empty
      ? editor.state.doc.textBetween(selection.from, selection.to, " ")
      : ""
  const selectedWords = countWords(selectedText)
  const proofingScope =
    editor && selection && !selection.empty ? "selection" : "document"
  const activeProofingLanguage =
    proofingScope === "selection"
      ? String(
          editor?.getAttributes("proofingLanguage").language ||
            proofingLanguage
        )
      : proofingLanguage

  const rememberProofingTarget = () => {
    const currentSelection = editor?.state.selection
    const range =
      currentSelection && !currentSelection.empty
        ? {
            from: currentSelection.from,
            to: currentSelection.to,
          }
        : lastProofingRangeRef.current
    proofingTargetRef.current = range
      ? { scope: "selection", range }
      : { scope: "document" }
  }

  const setZoom = (zoom: number) => {
    onLayoutChange({
      ...layout,
      zoom: Math.min(2, Math.max(0.5, Math.round(zoom * 20) / 20)),
    })
  }

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-primary/80 bg-primary px-3 text-[11px] text-primary-foreground">
      <div className="flex min-w-0 items-center gap-4">
        <span>
          {selectedWords > 0
            ? `${selectedWords} de ${words} palabras`
            : `${words} ${words === 1 ? "palabra" : "palabras"}`}
        </span>
        <span className="hidden sm:inline">{chars} caracteres</span>
        <label className="hidden items-center gap-1 md:flex">
          <Languages className="h-3 w-3" />
          <span className="sr-only">Idioma de corrección</span>
          <select
            value={activeProofingLanguage}
            onPointerDown={rememberProofingTarget}
            onKeyDown={rememberProofingTarget}
            onChange={(event) => {
              const target =
                proofingTargetRef.current ??
                (lastProofingRangeRef.current
                  ? {
                      scope: "selection" as const,
                      range: lastProofingRangeRef.current,
                    }
                  : { scope: proofingScope })
              proofingTargetRef.current = null
              onProofingLanguageChange(
                event.target.value,
                target.scope,
                target.range
              )
            }}
            className="max-w-36 bg-transparent text-primary-foreground outline-none"
            title={`Idioma de corrección de ${
              proofingScope === "selection"
                ? "la selección"
                : "todo el documento"
            }`}
          >
            {!PROOFING_LANGUAGE_OPTIONS.some(
              (option) => option.value === activeProofingLanguage
            ) && (
              <option value={activeProofingLanguage}>
                {activeProofingLanguage}
              </option>
            )}
            {PROOFING_LANGUAGE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-background text-foreground"
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {status === "streaming" ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generando…
          </span>
        ) : status === "done" ? (
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3" />
            Listo
          </span>
        ) : null}
        <span className="hidden max-w-56 truncate xl:inline">{modelLabel}</span>
        <div
          className="hidden items-center gap-0.5 lg:flex"
          aria-label="Vista del documento"
        >
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-primary-foreground/15",
              !immersiveReaderOpen && "bg-primary-foreground/15"
            )}
            onClick={() => onImmersiveReaderChange(false)}
            aria-pressed={!immersiveReaderOpen}
            title="Diseño de impresión"
          >
            <FileText className="h-3 w-3" />
            Diseño de impresión
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-primary-foreground/15"
            onClick={() => onImmersiveReaderChange(true)}
            aria-pressed={immersiveReaderOpen}
            title="Modo de lectura"
          >
            <BookOpen className="h-3 w-3" />
            <span className="sr-only">Modo de lectura</span>
          </button>
        </div>
        <div className="flex items-center gap-1" aria-label="Zoom del documento">
          <button
            type="button"
            className="rounded p-0.5 hover:bg-primary-foreground/15 disabled:opacity-40"
            onClick={() => setZoom(layout.zoom - 0.1)}
            disabled={layout.zoom <= 0.5}
            aria-label="Alejar"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={Math.round(layout.zoom * 100)}
            onChange={(event) => setZoom(Number(event.target.value) / 100)}
            className="hidden h-1 w-20 accent-white sm:block"
            aria-label="Nivel de zoom"
          />
          <button
            type="button"
            className="min-w-10 rounded px-1 py-0.5 text-center hover:bg-primary-foreground/15"
            onClick={() => setZoom(1)}
            title="Restablecer zoom al 100 %"
          >
            {Math.round(layout.zoom * 100)} %
          </button>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-primary-foreground/15 disabled:opacity-40"
            onClick={() => setZoom(layout.zoom + 0.1)}
            disabled={layout.zoom >= 2}
            aria-label="Acercar"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </footer>
  )
}
