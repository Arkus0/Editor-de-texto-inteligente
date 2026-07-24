"use client"

import * as React from "react"
import { PanelRightClose, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface AiSidePanelProps {
  expanded: boolean
  onToggle: () => void
  modelLabel: string
  children: React.ReactNode
}

function useIsDesktop() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(min-width: 768px)")
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false
  )
}

function PanelHeader({ modelLabel, onClose }: { modelLabel: string; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Gemini</span>
          <span className="max-w-[220px] truncate text-[10px] text-muted-foreground">{modelLabel}</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Minimizar panel de IA">
        <PanelRightClose className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function AiSidePanel({ expanded, onToggle, modelLabel, children }: AiSidePanelProps) {
  const isDesktop = useIsDesktop()

  return (
    <>
      {/* Escritorio: riel fino ↔ panel expandido */}
      <div
        className={cn(
          "hidden shrink-0 flex-col border-l border-border bg-card transition-[width] duration-200 md:flex",
          expanded ? "w-[400px]" : "w-12"
        )}
      >
        {expanded ? (
          <>
            <PanelHeader modelLabel={modelLabel} onClose={onToggle} />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center gap-3 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-primary hover:bg-primary/10"
              onClick={onToggle}
              aria-label="Abrir el asistente Gemini"
              title="Abrir el asistente Gemini (Ctrl/⌘ + J)"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <span className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
              Gemini
            </span>
          </div>
        )}
      </div>

      {/* Móvil: hoja lateral */}
      <Sheet open={expanded && !isDesktop} onOpenChange={onToggle}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Asistente Gemini</SheetTitle>
          <PanelHeader modelLabel={modelLabel} onClose={onToggle} />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  )
}
