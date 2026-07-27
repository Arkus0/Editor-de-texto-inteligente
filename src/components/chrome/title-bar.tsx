"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Focus,
  FolderOpen,
  History,
  PanelRight,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  ShieldCheck,
  Undo2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ThemeToggle } from "@/components/chrome/theme-toggle"
import {
  CommandSearch,
  type AppCommandId,
} from "@/components/chrome/command-search"
import { cn } from "@/lib/utils"
import {
  QUICK_ACCESS_COMMANDS,
  type QuickAccessCommandId,
  useUiPreferencesStore,
} from "@/store/useUiPreferencesStore"

export type ExportFormat = "pdf" | "docx" | "odt" | "md" | "txt"

interface TitleBarProps {
  documentTabs: React.ReactNode
  onOpenHistory: () => void
  onOpenDocument?: () => void
  onSaveDocument?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onToggleAi: () => void
  aiOpen: boolean
  canExport: boolean
  isDirty?: boolean
  editing: boolean
  desktop: boolean
  onCommand: (command: AppCommandId) => void
}

const QUICK_ACCESS_ITEMS: Record<
  QuickAccessCommandId,
  {
    label: string
    shortcut?: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  save: { label: "Guardar", shortcut: "Ctrl+S", icon: Save },
  undo: { label: "Deshacer", shortcut: "Ctrl+Z", icon: Undo2 },
  redo: { label: "Rehacer", shortcut: "Ctrl+Y", icon: Redo2 },
  open: { label: "Abrir", shortcut: "Ctrl+O", icon: FolderOpen },
  print: { label: "Imprimir", shortcut: "Ctrl+P", icon: Printer },
  focus: { label: "Modo Enfoque", shortcut: "Alt+W, O", icon: Focus },
  accessibility: {
    label: "Comprobar accesibilidad",
    icon: ShieldCheck,
  },
}

export function TitleBar({
  documentTabs,
  onOpenHistory,
  onOpenDocument,
  onSaveDocument,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleAi,
  aiOpen,
  canExport,
  isDirty,
  editing,
  desktop,
  onCommand,
}: TitleBarProps) {
  const quickAccessCommands = useUiPreferencesStore(
    (state) => state.quickAccessCommands
  )
  const toggleQuickAccessCommand = useUiPreferencesStore(
    (state) => state.toggleQuickAccessCommand
  )
  const moveQuickAccessCommand = useUiPreferencesStore(
    (state) => state.moveQuickAccessCommand
  )
  const resetQuickAccessCommands = useUiPreferencesStore(
    (state) => state.resetQuickAccessCommands
  )

  const quickAccessDisabled = (command: QuickAccessCommandId) => {
    if (command === "save") return !editing || !onSaveDocument
    if (command === "undo") return !onUndo || !canUndo
    if (command === "redo") return !onRedo || !canRedo
    if (command === "open") return !onOpenDocument
    return !editing
  }

  const runQuickAccessCommand = (command: QuickAccessCommandId) => {
    if (command === "save") onSaveDocument?.()
    else if (command === "undo") onUndo?.()
    else if (command === "redo") onRedo?.()
    else if (command === "open") onOpenDocument?.()
    else if (command === "print") onCommand("file:print")
    else if (command === "focus") onCommand("view:focus")
    else if (command === "accessibility") onCommand("view:accessibility")
  }

  return (
    <header className="grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_minmax(220px,420px)_minmax(0,1fr)] items-center gap-2 border-b border-border bg-card px-2 max-md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-2">
        {documentTabs}
      </div>

      <div className="min-w-0 max-md:hidden">
        <CommandSearch
          editing={editing}
          desktop={desktop}
          hasContent={canExport}
          onCommand={onCommand}
        />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <div
          className="hidden items-center gap-0.5 border-l border-border pl-1 sm:flex"
          aria-label="Barra de acceso rápido"
        >
          {quickAccessCommands.map((command) => {
            const item = QUICK_ACCESS_ITEMS[command]
            const Icon = item.icon
            return (
              <Button
                key={command}
                variant={command === "save" && isDirty ? "outline" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => runQuickAccessCommand(command)}
                disabled={quickAccessDisabled(command)}
                aria-label={item.label}
                title={
                  item.shortcut
                    ? `${item.label} (${item.shortcut})`
                    : item.label
                }
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-6"
                aria-label="Personalizar barra de acceso rápido"
                title="Personalizar barra de acceso rápido"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2">
              <div className="px-2 pb-2">
                <p className="text-sm font-semibold">
                  Barra de acceso rápido
                </p>
                <p className="text-xs text-muted-foreground">
                  Se guarda solo en este equipo.
                </p>
              </div>
              <div className="space-y-0.5">
                {QUICK_ACCESS_COMMANDS.map((command) => {
                  const item = QUICK_ACCESS_ITEMS[command]
                  const Icon = item.icon
                  const selected = quickAccessCommands.includes(command)
                  return (
                    <button
                      key={command}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => toggleQuickAccessCommand(command)}
                    >
                      <span className="flex h-4 w-4 items-center justify-center">
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[11px] text-muted-foreground">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {quickAccessCommands.length > 1 && (
                <>
                  <div className="my-2 border-t border-border" />
                  <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Orden
                  </p>
                  <div className="space-y-0.5">
                    {quickAccessCommands.map((command, index) => {
                      const item = QUICK_ACCESS_ITEMS[command]
                      return (
                        <div
                          key={command}
                          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0}
                            onClick={() =>
                              moveQuickAccessCommand(command, -1)
                            }
                            aria-label={`Subir ${item.label}`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={
                              index === quickAccessCommands.length - 1
                            }
                            onClick={() =>
                              moveQuickAccessCommand(command, 1)
                            }
                            aria-label={`Bajar ${item.label}`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={resetQuickAccessCommands}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar valores predeterminados
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenHistory}
          aria-label="Historial de respuestas de IA"
          title="Historial de respuestas de IA guardadas"
        >
          <History />
          <span className="hidden 2xl:inline">Historial IA</span>
        </Button>

        <div className="flex items-center gap-1.5 border-l border-border pl-1.5">
          <ThemeToggle />

          <Button
            variant={aiOpen ? "default" : "outline"}
            size="sm"
            onClick={onToggleAi}
            aria-label="Asistente IA"
            className={cn("gap-1.5", aiOpen && "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            <PanelRight className="h-4 w-4" />
            <span className="hidden xl:inline">IA</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
