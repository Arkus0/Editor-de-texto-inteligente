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
  hasReadyAttachment: boolean
}

export function PromptPanel({
  prompt,
  onPromptChange,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  status,
  onGenerate,
  hasReadyAttachment,
}: PromptPanelProps) {
  const isGenerating = status === "streaming"
  const canGenerate = prompt.trim().length > 0 || hasReadyAttachment

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="space-y-2">
        <Label htmlFor="prompt">Enunciado o pregunta del examen / trabajo (opcional si lo adjuntas)</Label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Escribe aquí el enunciado, o déjalo vacío si el enunciado está dentro de un PDF/DOCX adjunto…"
          className="min-h-[220px] resize-y font-serif text-base leading-relaxed"
        />
      </div>

      <div className="space-y-2">
        <Label>Adjuntar enunciado y/o lecturas</Label>
        <p className="text-xs text-muted-foreground">
          Puedes adjuntar el propio examen o trabajo en PDF/DOCX/TXT: Gemini localizará el
          enunciado dentro del archivo aunque no escribas nada arriba.
        </p>
        <FileDropzone
          attachments={attachments}
          onFilesSelected={onFilesSelected}
          onRemove={onRemoveAttachment}
        />
      </div>

      <Button
        size="lg"
        onClick={onGenerate}
        disabled={isGenerating || !canGenerate}
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
