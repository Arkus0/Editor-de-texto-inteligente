"use client"

import * as React from "react"
import { Bookmark, BookmarkCheck, History, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { DocumentVersion } from "@/types/desktop"

interface VersionSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  onRestore: (version: DocumentVersion) => void
}

function formatVersionDate(timestamp: number) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp)
}

export function VersionSidebar({
  open,
  onOpenChange,
  documentId,
  onRestore,
}: VersionSidebarProps) {
  const [versions, setVersions] = React.useState<DocumentVersion[]>([])
  const [loading, setLoading] = React.useState(false)

  const refresh = React.useCallback(async () => {
    if (!window.editorDesktop || !documentId) return
    setLoading(true)
    try {
      setVersions(await window.editorDesktop.documents.listVersions(documentId))
    } finally {
      setLoading(false)
    }
  }, [documentId])

  React.useEffect(() => {
    if (!open || !window.editorDesktop || !documentId) return
    let cancelled = false
    window.editorDesktop.documents.listVersions(documentId).then((nextVersions) => {
      if (!cancelled) setVersions(nextVersions)
    })
    return () => {
      cancelled = true
    }
  }, [documentId, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de versiones
          </SheetTitle>
          <SheetDescription>
            Puntos de restauración locales creados al guardar y antes de aplicar cambios de IA.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="-mx-6 mt-5 flex-1 px-6">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando versiones…</p>
          ) : versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay puntos de restauración para este documento.
            </p>
          ) : (
            <ul className="space-y-2 pb-8">
              {versions.map((version) => (
                <li key={version.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{version.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatVersionDate(version.createdAt)}
                      </p>
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                        {version.markdown.slice(0, 240)}
                      </p>
                    </div>
                    {version.pinned ? (
                      <BookmarkCheck className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        onRestore(version)
                        onOpenChange(false)
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={async () => {
                        await window.editorDesktop?.documents.pinVersion(version.id, !version.pinned)
                        await refresh()
                      }}
                    >
                      <Bookmark className="h-3 w-3" />
                      {version.pinned ? "Desmarcar" : "Conservar"}
                    </Button>
                    {!version.pinned && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-7 w-7 text-destructive"
                        onClick={async () => {
                          await window.editorDesktop?.documents.deleteVersion(version.id)
                          toast.success("Versión eliminada")
                          await refresh()
                        }}
                        aria-label="Eliminar versión"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
