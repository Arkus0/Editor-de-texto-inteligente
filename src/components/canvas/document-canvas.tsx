"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { EditorContent, posToDOMRect, type Editor } from "@tiptap/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { DocumentStarter } from "@/components/canvas/document-starter"
import { SelectionBubble, type FloatingSelection } from "@/components/canvas/selection-bubble"
import type { EditorMode } from "@/components/app-shell"

interface DocumentCanvasProps {
  editor: Editor | null
  mode: EditorMode
  responseText: string
  starter: React.ComponentProps<typeof DocumentStarter>
  onSelectFragment: (fragment: string, range: { from: number; to: number }) => void
  onFragmentAction: (fragment: string, range: { from: number; to: number }, instruction: string) => void
}

export function DocumentCanvas({
  editor,
  mode,
  responseText,
  starter,
  onSelectFragment,
  onFragmentAction,
}: DocumentCanvasProps) {
  const [floatingSelection, setFloatingSelection] = React.useState<FloatingSelection | null>(null)
  const bubbleRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const { from, to, empty } = editor.state.selection
      if (empty || mode !== "editing") {
        setFloatingSelection(null)
        return
      }
      const text = editor.state.doc.textBetween(from, to, " ").trim()
      if (!text) {
        setFloatingSelection(null)
        return
      }
      const rect = posToDOMRect(editor.view, from, to)
      setFloatingSelection({ text, top: rect.top, left: rect.left + rect.width / 2, from, to })
    }

    editor.on("selectionUpdate", updateSelection)
    return () => {
      editor.off("selectionUpdate", updateSelection)
    }
  }, [editor, mode])

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (bubbleRef.current?.contains(event.target as Node)) return
      setFloatingSelection(null)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const dismissBubble = () => {
    if (floatingSelection) editor?.commands.setTextSelection(floatingSelection.to)
    setFloatingSelection(null)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-desk">
      <ScrollArea className="desk-scroll min-h-0 flex-1">
        <div className="px-4 py-6 sm:px-8 sm:py-10">
          <div className="doc-page px-10 py-14 sm:px-20 sm:py-20">
            {mode === "streaming" ? (
              <div className="prose prose-slate max-w-none font-serif text-[1.05rem] leading-[1.9] dark:prose-invert prose-p:my-4 prose-headings:font-sans">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{responseText}</ReactMarkdown>
                <span className="ml-0.5 inline-block h-5 w-2 animate-pulse bg-foreground/60 align-text-bottom" />
              </div>
            ) : mode === "welcome" ? (
              <DocumentStarter {...starter} />
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
        </div>
      </ScrollArea>

      {floatingSelection && (
        <SelectionBubble
          ref={bubbleRef}
          selection={floatingSelection}
          onAsk={() => {
            onSelectFragment(floatingSelection.text, { from: floatingSelection.from, to: floatingSelection.to })
            dismissBubble()
          }}
          onAction={(instruction) => {
            onFragmentAction(
              floatingSelection.text,
              { from: floatingSelection.from, to: floatingSelection.to },
              instruction
            )
            dismissBubble()
          }}
        />
      )}
    </div>
  )
}
