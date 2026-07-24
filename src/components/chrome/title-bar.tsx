"use client"

import * as React from "react"
import {
  ChevronDown,
  Download,
  FileText,
  History,
  PanelRight,
  Settings,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ThemeToggle } from "@/components/chrome/theme-toggle"
import { cn } from "@/lib/utils"

export type ExportFormat = "pdf" | "docx" | "md" | "txt"

interface TitleBarProps {
  docName: string
  onDocNameChange: (value: string) => void
  onOpenHistory: () => void
  onOpenSettings: () => void
  onToggleAi: () => void
  aiOpen: boolean
  onExport: (format: ExportFormat) => void
  canExport: boolean
  isExporting: boolean
}

const EXPORT_ITEMS: { format: ExportFormat; label: string }[] = [
  { format: "pdf", label: "PDF (.pdf)" },
  { format: "docx", label: "Word (.docx)" },
  { format: "md", label: "Markdown (.md)" },
  { format: "txt", label: "Texto (.txt)" },
]

export function TitleBar({
  docName,
  onDocNameChange,
  onOpenHistory,
  onOpenSettings,
  onToggleAi,
  aiOpen,
  onExport,
  canExport,
  isExporting,
}: TitleBarProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-col">
          <input
            value={docName}
            onChange={(e) => onDocNameChange(e.target.value)}
            aria-label="Nombre del documento"
            className="w-full min-w-0 truncate rounded-sm bg-transparent text-sm font-semibold outline-none hover:bg-accent/60 focus:bg-accent/60 focus:ring-1 focus:ring-ring"
            spellCheck={false}
          />
          <span className="text-[11px] text-muted-foreground">Editor de Texto Inteligente</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onOpenHistory} className="hidden sm:inline-flex">
          <History />
          Historial
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" onClick={onOpenHistory} aria-label="Historial">
          <History className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!canExport || isExporting}>
              <Download />
              <span className="hidden sm:inline">Exportar</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            {EXPORT_ITEMS.map((item) => (
              <button
                key={item.format}
                onClick={() => onExport(item.format)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="h-4 w-4" /> {item.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings} aria-label="Ajustes">
          <Settings className="h-4 w-4" />
        </Button>

        <ThemeToggle />

        <Button
          variant={aiOpen ? "default" : "outline"}
          size="sm"
          onClick={onToggleAi}
          className={cn("gap-1.5", aiOpen && "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          <PanelRight className="h-4 w-4" />
          <span className="hidden sm:inline">Gemini</span>
        </Button>
      </div>
    </header>
  )
}
