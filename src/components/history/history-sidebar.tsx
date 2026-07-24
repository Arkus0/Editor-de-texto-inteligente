"use client"

import * as React from "react"
import { Check, Pencil, Search, Trash2, X } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useHistoryStore, type HistoryEntry } from "@/store/useHistoryStore"

interface HistorySidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoad: (entry: HistoryEntry) => void
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

export function HistorySidebar({ open, onOpenChange, onLoad }: HistorySidebarProps) {
  const { entries, remove, rename } = useHistoryStore()
  const [query, setQuery] = React.useState("")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingTitle, setEditingTitle] = React.useState("")

  const filtered = entries.filter((entry) => {
    const haystack = `${entry.title} ${entry.prompt}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  const startRename = (entry: HistoryEntry) => {
    setEditingId(entry.id)
    setEditingTitle(entry.title)
  }

  const commitRename = (id: string) => {
    if (editingTitle.trim()) rename(id, editingTitle.trim())
    setEditingId(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Historial de respuestas</SheetTitle>
          <SheetDescription>
            Respuestas modélicas generadas anteriormente, guardadas en este navegador.
          </SheetDescription>
        </SheetHeader>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el historial…"
            className="pl-9"
          />
        </div>

        <ScrollArea className="-mx-6 mt-4 flex-1 px-6">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {entries.length === 0
                ? "Todavía no hay respuestas guardadas."
                : "No se encontraron resultados."}
            </p>
          ) : (
            <ul className="space-y-2 pb-8">
              {filtered.map((entry) => (
                <li
                  key={entry.id}
                  className="group rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                >
                  {editingId === entry.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(entry.id)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        className="h-8 text-sm"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => commitRename(entry.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onLoad(entry)}
                      className="block w-full text-left"
                    >
                      <p className="truncate text-sm font-medium">{entry.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {entry.response.slice(0, 160)}
                      </p>
                    </button>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                    {editingId !== entry.id && (
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startRename(entry)}
                          aria-label="Renombrar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (window.confirm("¿Eliminar esta respuesta del historial?")) {
                              remove(entry.id)
                            }
                          }}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
