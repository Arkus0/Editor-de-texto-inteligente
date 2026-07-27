"use client"

import * as React from "react"
import { FileImage, FileText, Loader2, Paperclip, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ATTACHMENT_ROLE_LABELS,
  type AcademicAttachment,
  type AttachmentRole,
} from "@/types/academic"

interface FileDropzoneProps {
  attachments: AcademicAttachment[]
  onFilesSelected: (files: File[]) => void
  onRemove: (id: string) => void
  onRoleChange?: (id: string, role: AttachmentRole) => void
  professional?: boolean
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".odt", ".txt", ".png", ".jpg", ".jpeg", ".webp"]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropzone({
  attachments,
  onFilesSelected,
  onRemove,
  onRoleChange,
  professional = false,
}: FileDropzoneProps) {
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
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          inputRef.current?.click()
        }}
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
          Arrastra materiales aquí o{" "}
          <span className="font-medium text-foreground underline underline-offset-2">
            selecciona archivos
          </span>
        </p>
        <p className="text-xs text-muted-foreground/70">
          PDF, PDF escaneado, imagen, DOCX o TXT
        </p>
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
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              {attachment.status === "extracting" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : attachment.kind === "image" ? (
                <FileImage
                  className={cn(
                    "h-4 w-4 shrink-0",
                    attachment.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                />
              ) : (
                <FileText
                  className={cn(
                    "h-4 w-4 shrink-0",
                    attachment.status === "error" ? "text-destructive" : "text-muted-foreground"
                  )}
                />
              )}
              <span className="flex-1 truncate">{attachment.name}</span>
              {professional && onRoleChange && attachment.status !== "error" && (
                <select
                  value={attachment.role}
                  onChange={(event) =>
                    onRoleChange(
                      attachment.id,
                      event.target.value as AttachmentRole
                    )
                  }
                  onClick={(event) => event.stopPropagation()}
                  className="order-last h-7 w-full rounded-md border border-input bg-background px-2 text-xs lg:order-none lg:w-auto lg:max-w-44"
                  aria-label={`Función de ${attachment.name}`}
                >
                  {Object.entries(ATTACHMENT_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
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
              {attachment.error && (
                <span className="sr-only">{attachment.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
