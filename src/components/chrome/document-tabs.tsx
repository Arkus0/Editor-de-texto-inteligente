"use client"

import { ExternalLink, FileText, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DocumentTab {
  id: string
  title: string
  path: string | null
  html: string
  markdown: string
  mode: "welcome" | "streaming" | "editing"
  prompt: string
  chatJson: string
  documentJson: string
  dirty: boolean
}

interface DocumentTabsProps {
  tabs: DocumentTab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  onRename?: (id: string, title: string) => void
  onDetach?: (id: string) => void
}

export function DocumentTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
  onRename,
  onDetach,
}: DocumentTabsProps) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Documentos abiertos"
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "group flex h-8 min-w-36 max-w-64 shrink-0 items-center gap-1 rounded-md border px-2 text-xs transition-colors",
            tab.id === activeId
              ? "border-border bg-background text-foreground shadow-sm"
              : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/60 hover:text-foreground"
          )}
          title={tab.path ?? tab.title}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          {tab.id === activeId && onRename ? (
            <input
              value={tab.title}
              onChange={(event) => onRename(tab.id, event.target.value)}
              onFocus={() => onSelect(tab.id)}
              aria-label="Nombre del documento"
              className="min-w-0 flex-1 truncate bg-transparent font-medium outline-none"
              spellCheck={false}
            />
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left"
              onClick={() => onSelect(tab.id)}
            >
              {tab.title}
            </button>
          )}
          {tab.dirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Cambios pendientes"
              title="Cambios pendientes"
            />
          )}
          {onDetach && tab.id === activeId && (
            <button
              type="button"
              onClick={() => onDetach(tab.id)}
              className="hidden rounded p-0.5 hover:bg-accent group-hover:block"
              aria-label="Separar en otra ventana"
              title="Separar en otra ventana"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose(tab.id)}
            className="rounded p-0.5 hover:bg-accent"
            aria-label={`Cerrar ${tab.title}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onNew}
        aria-label="Nuevo documento"
        title="Nuevo documento"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
