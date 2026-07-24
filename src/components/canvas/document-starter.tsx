"use client"

import * as React from "react"
import { AlertTriangle, Loader2, PenLine, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileDropzone } from "@/components/left-panel/file-dropzone"
import type { Attachment } from "@/components/app-shell"

interface DocumentStarterProps {
  prompt: string
  onPromptChange: (value: string) => void
  attachments: Attachment[]
  onFilesSelected: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  onGenerate: () => void
  onStartBlank: () => void
  isGenerating: boolean
  canGenerate: boolean
  errorMessage?: string | null
}

export function DocumentStarter({
  prompt,
  onPromptChange,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  onGenerate,
  onStartBlank,
  isGenerating,
  canGenerate,
  errorMessage,
}: DocumentStarterProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 py-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Empieza tu documento con Gemini</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Describe lo que quieres redactar (o adjunta el enunciado) y Gemini creará un borrador
          directamente en la página. También puedes empezar a escribir en blanco.
        </p>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Escribe aquí el enunciado o lo que quieres redactar…"
        className="min-h-[130px] resize-y text-base leading-relaxed"
        autoFocus
      />

      <FileDropzone
        attachments={attachments}
        onFilesSelected={onFilesSelected}
        onRemove={onRemoveAttachment}
      />

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={onGenerate} disabled={isGenerating || !canGenerate} className="w-full">
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" />
              Generando borrador…
            </>
          ) : (
            <>
              <Sparkles />
              Generar con Gemini
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={onStartBlank}
          disabled={isGenerating}
          className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
        >
          <PenLine className="h-3.5 w-3.5" />
          o empezar a escribir en blanco
        </button>
      </div>
    </div>
  )
}
