"use client"

import * as React from "react"
import { BookMarked, Footprints, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type {
  DocumentEndnote,
  DocumentFootnote,
} from "@/types/document"

interface FootnoteSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  footnotes: DocumentFootnote[]
  onInsert: (text: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
  endnotes: DocumentEndnote[]
  onInsertEndnote: (text: string) => void
  onUpdateEndnote: (id: string, text: string) => void
  onDeleteEndnote: (id: string) => void
}

export function FootnoteSidebar({
  open,
  onOpenChange,
  footnotes,
  onInsert,
  onUpdate,
  onDelete,
  endnotes,
  onInsertEndnote,
  onUpdateEndnote,
  onDeleteEndnote,
}: FootnoteSidebarProps) {
  const [noteKind, setNoteKind] =
    React.useState<"footnote" | "endnote">("footnote")
  const [draft, setDraft] = React.useState("")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingText, setEditingText] = React.useState("")
  const activeNotes = noteKind === "footnote" ? footnotes : endnotes
  const noteLabel = noteKind === "footnote" ? "nota al pie" : "nota final"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Footprints className="h-5 w-5" />
            Notas al pie y finales
          </SheetTitle>
          <SheetDescription>
            Se numeran automáticamente y se exportan como campos nativos de
            Word.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-6 mt-4 flex-1 px-6">
          <div className="space-y-5 pb-8">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={noteKind === "footnote" ? "default" : "outline"}
                onClick={() => {
                  setNoteKind("footnote")
                  setEditingId(null)
                }}
              >
                <Footprints />
                Al pie
              </Button>
              <Button
                type="button"
                variant={noteKind === "endnote" ? "default" : "outline"}
                onClick={() => {
                  setNoteKind("endnote")
                  setEditingId(null)
                }}
              >
                <BookMarked />
                Al final
              </Button>
            </div>
            <section className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label htmlFor="footnote-text">
                Nueva {noteLabel} en el cursor
              </Label>
              <Textarea
                id="footnote-text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Texto completo de la nota…"
              />
              <Button
                className="w-full"
                disabled={!draft.trim()}
                onClick={() => {
                  if (noteKind === "footnote") onInsert(draft.trim())
                  else onInsertEndnote(draft.trim())
                  setDraft("")
                }}
              >
                <Plus />
                Insertar {noteLabel}
              </Button>
            </section>

            {activeNotes.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                El documento todavía no contiene{" "}
                {noteKind === "footnote" ? "notas al pie" : "notas finales"}.
              </p>
            ) : (
              activeNotes
                .slice()
                .sort((left, right) => left.number - right.number)
                .map((footnote) => (
                  <article
                    key={footnote.id}
                    className="space-y-2 rounded-lg border p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {footnote.number}
                      </span>
                      {editingId === footnote.id ? (
                        <Textarea
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          className="min-h-20 flex-1"
                        />
                      ) : (
                        <p className="flex-1 whitespace-pre-wrap text-sm">
                          {footnote.text}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-1">
                      {editingId === footnote.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null)
                              setEditingText("")
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            disabled={!editingText.trim()}
                            onClick={() => {
                              if (noteKind === "footnote") {
                                onUpdate(footnote.id, editingText.trim())
                              } else {
                                onUpdateEndnote(
                                  footnote.id,
                                  editingText.trim()
                                )
                              }
                              setEditingId(null)
                              setEditingText("")
                            }}
                          >
                            Guardar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(footnote.id)
                              setEditingText(footnote.text)
                            }}
                          >
                            <Pencil />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              noteKind === "footnote"
                                ? onDelete(footnote.id)
                                : onDeleteEndnote(footnote.id)
                            }
                          >
                            <Trash2 />
                            Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
