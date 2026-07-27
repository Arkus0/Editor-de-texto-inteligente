"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  Check,
  CheckCheck,
  Link2,
  Link2Off,
  MessageSquarePlus,
  Reply,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  collectRevisions,
  type RevisionDescriptor,
} from "@/editor/extensions/document-features"
import { cn } from "@/lib/utils"
import type {
  DocumentComment,
  ImportedRevisionSummary,
} from "@/types/document"

interface ReviewSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editor: Editor | null
  comments: DocumentComment[]
  author: string
  trackChanges: boolean
  showMarkup: boolean
  hasPreservedSelection: boolean
  importedRevisionSummary?: ImportedRevisionSummary
  onAuthorChange: (author: string) => void
  onTrackChangesChange: (enabled: boolean) => void
  onShowMarkupChange: (show: boolean) => void
  onAddComment: (text: string) => void
  onResolveComment: (id: string, resolved: boolean) => void
  onDeleteComment: (id: string) => void
  onReplyComment: (id: string, text: string) => void
  onSelectComment: (id: string) => void
  onDetachComments: (ids: string[]) => void
  onReanchorComment: (id: string) => void
}

function commentsRemovedByDecision(
  editor: Editor,
  revisions: RevisionDescriptor[],
  decision: "accept" | "reject"
) {
  const commentIds = new Set<string>()
  for (const revision of revisions) {
    const removesText =
      (decision === "accept" && revision.type === "deletion") ||
      (decision === "reject" && revision.type === "insertion")
    if (!removesText) continue
    editor.state.doc.nodesBetween(revision.from, revision.to, (node) => {
      if (!node.isText) return true
      for (const mark of node.marks) {
        if (mark.type.name === "comment" && mark.attrs.commentId) {
          commentIds.add(String(mark.attrs.commentId))
        }
      }
      return true
    })
  }
  return [...commentIds]
}

export function ReviewSidebar({
  open,
  onOpenChange,
  editor,
  comments,
  author,
  trackChanges,
  showMarkup,
  hasPreservedSelection,
  importedRevisionSummary,
  onAuthorChange,
  onTrackChangesChange,
  onShowMarkupChange,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onReplyComment,
  onSelectComment,
  onDetachComments,
  onReanchorComment,
}: ReviewSidebarProps) {
  const [tab, setTab] = React.useState<"comments" | "changes">("comments")
  const [commentDraft, setCommentDraft] = React.useState("")
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null)
  const [replyDraft, setReplyDraft] = React.useState("")
  const [revisions, setRevisions] = React.useState<RevisionDescriptor[]>([])
  const [hasSelection, setHasSelection] = React.useState(
    hasPreservedSelection
  )

  React.useEffect(() => {
    if (!editor) return
    let timeout: ReturnType<typeof setTimeout> | null = null
    const refreshRevisions = () => {
      setRevisions(collectRevisions(editor.state.doc))
    }
    const scheduleRevisions = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(refreshRevisions, 120)
    }
    const refreshSelection = () => {
      setHasSelection(
        !editor.state.selection.empty || hasPreservedSelection
      )
    }
    refreshRevisions()
    refreshSelection()
    editor.on("update", scheduleRevisions)
    editor.on("selectionUpdate", refreshSelection)
    return () => {
      if (timeout) clearTimeout(timeout)
      editor.off("update", scheduleRevisions)
      editor.off("selectionUpdate", refreshSelection)
    }
  }, [editor, hasPreservedSelection])

  const decideRevision = (
    revision: RevisionDescriptor,
    decision: "accept" | "reject"
  ) => {
    if (!editor) return
    const detachedComments = commentsRemovedByDecision(
      editor,
      [revision],
      decision
    )
    if (decision === "accept") editor.commands.acceptRevision(revision.id)
    else editor.commands.rejectRevision(revision.id)
    onDetachComments(detachedComments)
    setRevisions(collectRevisions(editor.state.doc))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Revisión del documento</SheetTitle>
          <SheetDescription>
            Comentarios y control de cambios compatibles con Microsoft Word.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab("comments")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              tab === "comments" && "bg-background font-medium shadow-sm"
            )}
          >
            Comentarios ({comments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("changes")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              tab === "changes" && "bg-background font-medium shadow-sm"
            )}
          >
            Cambios ({revisions.length})
          </button>
        </div>

        <ScrollArea className="-mx-6 mt-4 flex-1 px-6">
          {tab === "comments" ? (
            <div className="space-y-4 pb-8">
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label htmlFor="new-comment">Nuevo comentario</Label>
                <Textarea
                  id="new-comment"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder={
                    hasSelection
                      ? "Escribe el comentario para el texto seleccionado…"
                      : "Escribe el comentario; si falta el anclaje te pediremos seleccionar texto."
                  }
                />
                <Button
                  className="w-full"
                  disabled={!commentDraft.trim()}
                  onClick={() => {
                    onAddComment(commentDraft.trim())
                    setCommentDraft("")
                  }}
                >
                  <MessageSquarePlus />
                  Comentar selección
                </Button>
              </div>

              {comments.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Todavía no hay comentarios.
                </p>
              ) : (
                comments.map((comment) => (
                  <article
                    key={comment.id}
                    className={cn(
                      "space-y-2 rounded-lg border p-3",
                      comment.resolved && "bg-muted/40 opacity-75",
                      comment.orphaned &&
                        "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectComment(comment.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {comment.author}
                          {comment.orphaned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                              <Link2Off className="h-3 w-3" />
                              Sin anclaje
                            </span>
                          )}
                        </span>
                        <time className="text-[11px] text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString("es")}
                        </time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {comment.text}
                      </p>
                      {comment.anchorText && (
                        <p className="mt-2 line-clamp-3 border-l-2 border-muted-foreground/30 pl-2 text-xs italic text-muted-foreground">
                          Texto original: “{comment.anchorText}”
                        </p>
                      )}
                    </button>

                    {comment.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="ml-4 border-l-2 border-primary/30 pl-3 text-sm"
                      >
                        <div className="font-medium">{reply.author}</div>
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {reply.text}
                        </p>
                      </div>
                    ))}

                    {replyingTo === comment.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          placeholder="Responder…"
                          className="min-h-16"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyingTo(null)
                              setReplyDraft("")
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            disabled={!replyDraft.trim()}
                            onClick={() => {
                              onReplyComment(comment.id, replyDraft.trim())
                              setReplyingTo(null)
                              setReplyDraft("")
                            }}
                          >
                            Responder
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyingTo(comment.id)}
                        >
                          <Reply />
                          Responder
                        </Button>
                        {comment.orphaned && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!hasSelection}
                            onClick={() => onReanchorComment(comment.id)}
                            title={
                              hasSelection
                                ? "Vincular al texto seleccionado"
                                : "Selecciona primero el nuevo texto"
                            }
                          >
                            <Link2 />
                            Reanclar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onResolveComment(comment.id, !comment.resolved)
                          }
                        >
                          {comment.resolved ? <RotateCcw /> : <Check />}
                          {comment.resolved ? "Reabrir" : "Resolver"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => onDeleteComment(comment.id)}
                        >
                          <Trash2 />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-8">
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Control de cambios</p>
                    <p className="text-xs text-muted-foreground">
                      Registra texto añadido y eliminado.
                    </p>
                  </div>
                  <Switch
                    checked={trackChanges}
                    onCheckedChange={onTrackChangesChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="review-author">Autor de los cambios</Label>
                  <Input
                    id="review-author"
                    value={author}
                    onChange={(event) => onAuthorChange(event.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="show-markup">Mostrar marcas en pantalla</Label>
                  <Switch
                    id="show-markup"
                    checked={showMarkup}
                    onCheckedChange={onShowMarkupChange}
                  />
                </div>
              </div>

              {importedRevisionSummary &&
                (importedRevisionSummary.insertions > 0 ||
                  importedRevisionSummary.deletions > 0) && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    El archivo original contenía{" "}
                    {importedRevisionSummary.insertions} inserciones y{" "}
                    {importedRevisionSummary.deletions} eliminaciones. El original
                    se conserva como copia de seguridad.
                  </div>
                )}

              {revisions.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const detachedComments = editor
                        ? commentsRemovedByDecision(
                            editor,
                            revisions,
                            "accept"
                          )
                        : []
                      editor?.commands.acceptAllRevisions()
                      onDetachComments(detachedComments)
                      if (editor) setRevisions(collectRevisions(editor.state.doc))
                    }}
                  >
                    <CheckCheck />
                    Aceptar todo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const detachedComments = editor
                        ? commentsRemovedByDecision(
                            editor,
                            revisions,
                            "reject"
                          )
                        : []
                      editor?.commands.rejectAllRevisions()
                      onDetachComments(detachedComments)
                      if (editor) setRevisions(collectRevisions(editor.state.doc))
                    }}
                  >
                    <X />
                    Rechazar todo
                  </Button>
                </div>
              )}

              <Separator />

              {revisions.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No hay cambios pendientes.
                </p>
              ) : (
                revisions.map((revision) => (
                  <article
                    key={`${revision.type}-${revision.id}`}
                    className="space-y-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          revision.type === "insertion"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                        )}
                      >
                        {revision.type === "insertion"
                          ? "Inserción"
                          : "Eliminación"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {revision.author}
                      </span>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm">
                      {revision.text}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decideRevision(revision, "accept")}
                      >
                        <Check />
                        Aceptar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decideRevision(revision, "reject")}
                      >
                        <X />
                        Rechazar
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
