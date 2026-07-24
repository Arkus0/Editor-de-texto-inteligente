"use client"

import * as React from "react"
import { MessageSquareText, PanelRightClose, PanelRightOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface AiSidePanelProps {
  expanded: boolean
  onToggle: () => void
  hasContent: boolean
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

export function AiSidePanel({ expanded, onToggle, hasContent, children }: AiSidePanelProps) {
  const isDesktop = useIsDesktop()

  return (
    <>
      <div
        className={cn(
          "hidden shrink-0 flex-col border-l border-border bg-card transition-[width] duration-200 md:flex",
          expanded ? "w-[360px]" : "w-12"
        )}
      >
        {expanded ? (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <MessageSquareText className="h-4 w-4" />
                Asistente IA
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} aria-label="Minimizar panel de IA">
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center gap-2 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggle}
              disabled={!hasContent}
              aria-label="Expandir panel de IA"
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Sheet open={expanded && !isDesktop} onOpenChange={onToggle}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-medium">
            <MessageSquareText className="h-4 w-4" />
            Asistente IA
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  )
}
