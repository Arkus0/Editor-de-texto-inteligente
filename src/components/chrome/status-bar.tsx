"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { Check, Loader2 } from "lucide-react"

import type { GenerationStatus } from "@/components/app-shell"

interface StatusBarProps {
  editor: Editor | null
  status: GenerationStatus
  modelLabel: string
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function StatusBar({ editor, status, modelLabel }: StatusBarProps) {
  const [, forceRerender] = React.useReducer((c) => c + 1, 0)

  React.useEffect(() => {
    if (!editor) return
    const update = () => forceRerender()
    editor.on("update", update)
    editor.on("selectionUpdate", update)
    return () => {
      editor.off("update", update)
      editor.off("selectionUpdate", update)
    }
  }, [editor])

  const text = editor?.getText() ?? ""
  const words = countWords(text)
  const chars = text.length

  return (
    <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-4 py-1.5 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>
          {words} {words === 1 ? "palabra" : "palabras"}
        </span>
        <span className="hidden sm:inline">{chars} caracteres</span>
      </div>
      <div className="flex items-center gap-3">
        {status === "streaming" ? (
          <span className="flex items-center gap-1 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generando…
          </span>
        ) : status === "done" ? (
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-500" />
            Listo
          </span>
        ) : null}
        <span className="hidden truncate sm:inline">{modelLabel}</span>
      </div>
    </footer>
  )
}
