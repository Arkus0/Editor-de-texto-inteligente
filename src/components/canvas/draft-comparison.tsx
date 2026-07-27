"use client"

import { Check, Loader2, RefreshCcw, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface DraftVariant {
  id: string
  title: string
  content: string
  status: "streaming" | "done" | "error"
}

interface DraftComparisonProps {
  open: boolean
  currentText: string
  variant: DraftVariant | null
  onOpenChange: (open: boolean) => void
  onAccept: (content: string) => void
  onRegenerate: () => void
}

export function DraftComparison({
  open,
  currentText,
  variant,
  onOpenChange,
  onAccept,
  onRegenerate,
}: DraftComparisonProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] max-w-6xl flex-col">
        <DialogHeader>
          <DialogTitle>Comparar borrador alternativo</DialogTitle>
          <DialogDescription>
            El documento actual permanece intacto hasta que aceptes la nueva versión.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col rounded-lg border border-border">
            <h3 className="border-b border-border px-4 py-2 text-sm font-semibold">
              Documento actual
            </h3>
            <ScrollArea className="flex-1 p-4">
              <p className="whitespace-pre-wrap font-serif text-sm leading-7">{currentText}</p>
            </ScrollArea>
          </section>
          <section className="flex min-h-0 flex-col rounded-lg border border-primary/40">
            <h3 className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm font-semibold">
              {variant?.status === "streaming" && <Loader2 className="h-4 w-4 animate-spin" />}
              {variant?.title ?? "Nuevo borrador"}
            </h3>
            <ScrollArea className="flex-1 p-4">
              <p className="whitespace-pre-wrap font-serif text-sm leading-7">
                {variant?.content || "Preparando una variante del documento…"}
              </p>
            </ScrollArea>
          </section>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X />
            Mantener actual
          </Button>
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={variant?.status === "streaming"}
          >
            <RefreshCcw />
            Regenerar
          </Button>
          <Button
            onClick={() => variant && onAccept(variant.content)}
            disabled={!variant || variant.status !== "done" || !variant.content.trim()}
          >
            <Check />
            Usar este borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

