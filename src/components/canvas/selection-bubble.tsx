"use client"

import * as React from "react"
import { MessageSquareText, Sparkles } from "lucide-react"

import { SELECTION_ACTIONS } from "@/lib/ai-actions"
import { cn } from "@/lib/utils"

export interface FloatingSelection {
  text: string
  top: number
  left: number
  from: number
  to: number
}

interface SelectionBubbleProps {
  selection: FloatingSelection
  onAction: (instruction: string) => void
  onAsk: () => void
}

// Acciones inline rápidas (subconjunto de las acciones de selección).
const INLINE_ACTION_IDS = ["rewrite", "expand", "shorten", "fix"]

export const SelectionBubble = React.forwardRef<HTMLDivElement, SelectionBubbleProps>(
  ({ selection, onAction, onAsk }, ref) => {
    const inlineActions = SELECTION_ACTIONS.filter((a) => INLINE_ACTION_IDS.includes(a.id))

    return (
      <div
        ref={ref}
        style={{
          position: "fixed",
          top: Math.max(selection.top - 46, 8),
          left: selection.left,
          transform: "translateX(-50%)",
        }}
        className="z-40 flex items-center gap-0.5 rounded-full border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        <span className="flex items-center gap-1 pl-1.5 pr-1 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        {inlineActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.instruction())}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {action.label}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={onAsk}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Preguntar
        </button>
      </div>
    )
  }
)
SelectionBubble.displayName = "SelectionBubble"
