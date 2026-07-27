"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  LocateFixed,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  auditDocumentAccessibility,
  type AccessibilityIssue,
  type AccessibilityReport,
} from "@/lib/accessibility-checker"
import { cn } from "@/lib/utils"

interface AccessibilitySidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editor: Editor | null
  documentTitle: string
  language: string
}

function issueIcon(issue: AccessibilityIssue) {
  if (issue.severity === "error") return <CircleAlert className="h-4 w-4" />
  if (issue.severity === "warning") {
    return <AlertTriangle className="h-4 w-4" />
  }
  return <Info className="h-4 w-4" />
}

export function AccessibilitySidebar({
  open,
  onOpenChange,
  editor,
  documentTitle,
  language,
}: AccessibilitySidebarProps) {
  const [revision, setRevision] = React.useState(0)

  const refresh = React.useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  const report: AccessibilityReport = React.useMemo(
    () => {
      void revision
      return auditDocumentAccessibility(editor?.getJSON(), {
        title: documentTitle,
        language,
      })
    },
    [documentTitle, editor, language, revision]
  )

  React.useEffect(() => {
    if (!open) return
    if (!editor) return
    let timeout = 0
    let idleHandle = 0
    const scheduleRefresh = () => {
      window.clearTimeout(timeout)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
        idleHandle = 0
      }
      timeout = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idleHandle = window.requestIdleCallback(
            () => {
              idleHandle = 0
              refresh()
            },
            { timeout: 1_200 }
          )
        } else {
          refresh()
        }
      }, 650)
    }
    editor.on("transaction", scheduleRefresh)
    return () => {
      window.clearTimeout(timeout)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
      }
      editor.off("transaction", scheduleRefresh)
    }
  }, [editor, open, refresh])

  const goToIssue = (issue: AccessibilityIssue) => {
    if (!editor || issue.position <= 0) return
    const position = Math.min(
      Math.max(1, issue.position + 1),
      editor.state.doc.content.size
    )
    editor
      .chain()
      .focus()
      .setTextSelection(position)
      .scrollIntoView()
      .run()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Comprobar accesibilidad
          </SheetTitle>
          <SheetDescription>
            Revisión local e inmediata de estructura, imágenes, enlaces, tablas,
            legibilidad y contraste explícito.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-4 rounded-xl border bg-muted/25 p-4">
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-full border-8 text-xl font-bold",
              report.errors > 0
                ? "border-destructive/20 text-destructive"
                : report.warnings > 0
                  ? "border-amber-500/25 text-amber-700 dark:text-amber-300"
                  : "border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
            )}
            aria-label={`Puntuación orientativa ${report.score} sobre 100`}
          >
            {report.score}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-destructive/10 px-2 py-1 text-destructive">
                {report.errors} {report.errors === 1 ? "error" : "errores"}
              </span>
              <span className="rounded-full bg-amber-500/12 px-2 py-1 text-amber-800 dark:text-amber-200">
                {report.warnings} {report.warnings === 1 ? "aviso" : "avisos"}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                {report.tips} {report.tips === 1 ? "sugerencia" : "sugerencias"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {report.checkedNodes} elementos comprobados. La puntuación ayuda a
              priorizar; no sustituye una auditoría humana ni certifica WCAG.
            </p>
          </div>
        </div>

        <div className="my-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {report.issues.length > 0
              ? `${report.issues.length} ${
                  report.issues.length === 1 ? "punto" : "puntos"
                } para revisar`
              : "Sin problemas detectados"}
          </h3>
          <Button type="button" size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 pr-3">
          {report.issues.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold">
                  La comprobación automática no ha encontrado problemas
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Revisa también el documento con teclado y lector de pantalla
                  antes de publicarlo.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {report.issues.map((issue) => (
                <article
                  key={issue.id}
                  className={cn(
                    "rounded-lg border p-3",
                    issue.severity === "error"
                      ? "border-destructive/30 bg-destructive/5"
                      : issue.severity === "warning"
                        ? "border-amber-500/35 bg-amber-500/5"
                        : "border-border bg-card"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0",
                        issue.severity === "error"
                          ? "text-destructive"
                          : issue.severity === "warning"
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-primary"
                      )}
                    >
                      {issueIcon(issue)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold">{issue.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {issue.description}
                      </p>
                    </div>
                  </div>
                  {issue.position > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={() => goToIssue(issue)}
                    >
                      <LocateFixed className="h-3.5 w-3.5" />
                      Ir al elemento
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
