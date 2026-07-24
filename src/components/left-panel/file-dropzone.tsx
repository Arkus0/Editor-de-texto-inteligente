"use client"

import * as React from "react"
import { FileText, Loader2, Paperclip, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Attachment } from "@/components/app-shell"

interface FileDropzoneProps {
  attachments: Attachment[]
  onFilesSelected: (files: File[]) => void
  onRemove: (id: string) => void
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropzone({ attachments, onFilesSelected, onRemove }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    onFilesSelected(Array.from(fileList))
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
          isDragging ? "border-primary bg-accent" : "border-input hover:bg-accent/50"
        )}
      >
        <Paperclip className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastra lecturas aquí o{" "}
          <span className="font-medium text-foreground underline underline-offset-2">
            selecciona archivos
          </span>
        </p>
        <p className="text-xs text-muted-foreground/70">PDF, DOCX o TXT</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              {attachment.status === "extracting" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <FileText
                  className={cn(
                    "h-4 w-4 shrink-0",
                    attachment.status === "error" ? "text-destructive" : "text-muted-foreground"
                  )}
                />
              )}
              <span className="flex-1 truncate">{attachment.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(attachment.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Quitar ${attachment.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
