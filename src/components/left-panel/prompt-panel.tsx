"use client"

import { Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FileDropzone } from "@/components/left-panel/file-dropzone"
import type { Attachment, GenerationStatus } from "@/components/app-shell"

interface PromptPanelProps {
  prompt: string
  onPromptChange: (value: string) => void
  attachments: Attachment[]
  onFilesSelected: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  status: GenerationStatus
  onGenerate: () => void
}

export function PromptPanel({
  prompt,
  onPromptChange,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  status,
  onGenerate,
}: PromptPanelProps) {
  const isGenerating = status === "streaming"

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="space-y-2">
        <Label htmlFor="prompt">Enunciado o pregunta del examen / trabajo</Label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Pega aquí el enunciado, pregunta de examen o consigna de trabajo…"
          className="min-h-[220px] resize-y font-serif text-base leading-relaxed"
        />
      </div>

      <div className="space-y-2">
        <Label>Adjuntar lecturas / contexto</Label>
        <FileDropzone
          attachments={attachments}
          onFilesSelected={onFilesSelected}
          onRemove={onRemoveAttachment}
        />
      </div>

      <Button
        size="lg"
        onClick={onGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="mt-auto w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="animate-spin" />
            Generando respuesta modélica…
          </>
        ) : (
          <>
            <Sparkles />
            Generar Respuesta Modélica
          </>
        )}
      </Button>
    </div>
  )
}
