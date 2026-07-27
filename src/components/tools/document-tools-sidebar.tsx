"use client"

import * as React from "react"
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model"
import type { Editor, JSONContent } from "@tiptap/react"
import {
  Bookmark as BookmarkIcon,
  BookOpen,
  Calculator,
  Check,
  FileDiff,
  GitMerge,
  Heading,
  Languages,
  ListTree,
  Table2,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MailMergePanel } from "@/components/tools/mail-merge-panel"
import { AutoCorrectPanel } from "@/components/tools/autocorrect-panel"
import { ThesaurusPanel } from "@/components/tools/thesaurus-panel"
import {
  compareDocumentText,
  limitDiffSegments,
} from "@/lib/document-diff"
import {
  compareDocumentStructure,
  describeDocumentBlock,
  mergeDocumentStructure,
} from "@/lib/document-structure-diff"
import { extractEditableHtmlFromFile } from "@/lib/file-extract"
import {
  analyzeWritingSegments,
  WRITING_RULE_LABELS,
  type LocalWritingIssue,
  type WritingTextSegment,
} from "@/lib/writing-assistant"
import {
  applySelectedTableFormula,
  sortSelectedTable,
  type TableFormulaDirection,
  type TableFormulaOperation,
} from "@/lib/table-tools"
import type {
  AutoCorrectSettings,
  OutlineNumberingSettings,
  WritingAssistantSettings,
  WritingRuleId,
} from "@/types/document"

interface StructureItem {
  id: string
  type:
    | "heading"
    | "caption"
    | "equation"
    | "citation"
    | "bookmark"
    | "page"
  label: string
  position: number
  level?: number
}

export type DocumentToolsTab =
  | "navigate"
  | "academic"
  | "compare"
  | "mailMerge"
  | "writing"

interface DocumentToolsSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: DocumentToolsTab
  editor: Editor | null
  outlineNumbering: OutlineNumberingSettings
  onOutlineNumberingChange: (value: OutlineNumberingSettings) => void
  proofingLanguage: string
  writingAssistant: WritingAssistantSettings
  onWritingAssistantChange: (value: WritingAssistantSettings) => void
  autocorrect: AutoCorrectSettings
  onAutoCorrectChange: (value: AutoCorrectSettings) => void
  onInsertCaption: (kind: "figure" | "table", title: string) => void
  onInsertEquation: (latex: string) => void
  onInsertCrossReference: (targetId: string) => void
  onReplaceDocument: (content: JSONContent, checkpointLabel: string) => void
  onCreateDocument: (html: string, title: string) => void
  onExportMergedDocuments: (
    documents: Array<{ name: string; html: string }>,
    format: "docx" | "pdf",
    batchName: string
  ) => Promise<void>
}

function collectStructure(editor: Editor | null): StructureItem[] {
  if (!editor) return []
  const items: StructureItem[] = []
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === "heading") {
      items.push({
        id: String(node.attrs.anchorId || `heading-${position}`),
        type: "heading",
        label: `${node.attrs.outlineNumber ? `${node.attrs.outlineNumber} ` : ""}${node.textContent}`,
        position,
        level: Number(node.attrs.level ?? 1),
      })
    } else if (node.type.name === "caption") {
      items.push({
        id: String(node.attrs.captionId),
        type: "caption",
        label: `${node.attrs.label} ${node.attrs.number}${
          node.attrs.title ? `. ${node.attrs.title}` : ""
        }`,
        position,
      })
    } else if (node.type.name === "equation") {
      items.push({
        id: String(node.attrs.equationId),
        type: "equation",
        label: `Ecuación ${node.attrs.number}: ${node.attrs.latex}`,
        position,
      })
    } else if (node.type.name === "citation") {
      items.push({
        id: String(node.attrs.clusterId || `citation-${position}`),
        type: "citation",
        label: String(node.attrs.label),
        position,
      })
    } else if (node.type.name === "pageBreak") {
      items.push({
        id: `page-${position}`,
        type: "page",
        label: "Salto de página",
        position,
      })
    } else if (node.isText) {
      const bookmark = node.marks.find(
        (mark) =>
          mark.type.name === "bookmark" &&
          typeof mark.attrs.bookmarkId === "string"
      )
      if (
        bookmark &&
        !items.some(
          (item) =>
            item.type === "bookmark" &&
            item.id === String(bookmark.attrs.bookmarkId)
        )
      ) {
        items.push({
          id: String(bookmark.attrs.bookmarkId),
          type: "bookmark",
          label: `Marcador «${
            bookmark.attrs.name || node.text || "Sin nombre"
          }»: ${node.text || ""}`,
          position,
        })
      }
    }
    return true
  })
  return items
}

function writingIssues(
  editor: Editor | null,
  longSentenceThreshold: WritingAssistantSettings["longSentenceThreshold"],
  proofingLanguage: string
): LocalWritingIssue[] {
  if (!editor) return []
  const segments: WritingTextSegment[] = []
  editor.state.doc.descendants((node, position) => {
    if (!node.isText || !node.text) return true
    const languageMark = node.marks.find(
      (mark) => mark.type.name === "proofingLanguage"
    )
    segments.push({
      text: node.text,
      position,
      language:
        typeof languageMark?.attrs.language === "string"
          ? languageMark.attrs.language
          : undefined,
    })
    return true
  })
  return analyzeWritingSegments(
    segments,
    { longSentenceThreshold },
    proofingLanguage
  )
}

export function DocumentToolsSidebar({
  open,
  onOpenChange,
  initialTab = "navigate",
  editor,
  outlineNumbering,
  onOutlineNumberingChange,
  proofingLanguage,
  writingAssistant,
  onWritingAssistantChange,
  autocorrect,
  onAutoCorrectChange,
  onInsertCaption,
  onInsertEquation,
  onInsertCrossReference,
  onReplaceDocument,
  onCreateDocument,
  onExportMergedDocuments,
}: DocumentToolsSidebarProps) {
  const [structure, setStructure] = React.useState<StructureItem[]>([])
  const [compareDocument, setCompareDocument] =
    React.useState<JSONContent | null>(null)
  const [compareName, setCompareName] = React.useState("")
  const [compareLoading, setCompareLoading] = React.useState(false)
  const [selectedStructuralChanges, setSelectedStructuralChanges] =
    React.useState<Set<string>>(() => new Set())
  const [captionTitle, setCaptionTitle] = React.useState("")
  const [captionKind, setCaptionKind] =
    React.useState<"figure" | "table">("figure")
  const [latex, setLatex] = React.useState("\\frac{a}{b} = c")
  const [referenceTarget, setReferenceTarget] = React.useState("")
  const [bookmarkDraft, setBookmarkDraft] = React.useState("")
  const [tableFormulaOperation, setTableFormulaOperation] =
    React.useState<TableFormulaOperation>("SUM")
  const [tableFormulaDirection, setTableFormulaDirection] =
    React.useState<TableFormulaDirection>("ABOVE")
  const [dictionaryWords, setDictionaryWords] = React.useState<string[]>([])
  const [dictionaryDraft, setDictionaryDraft] = React.useState("")
  const [contentRevision, refreshContent] = React.useReducer(
    (count) => count + 1,
    0
  )
  const [, refreshSelection] = React.useReducer((count) => count + 1, 0)

  React.useEffect(() => {
    if (!editor) return
    let timeout: ReturnType<typeof setTimeout> | null = null
    let frame = 0
    const refreshDocument = () => {
      setStructure(collectStructure(editor))
      refreshContent()
    }
    const scheduleDocument = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(refreshDocument, 140)
    }
    const scheduleSelection = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        refreshSelection()
      })
    }
    refreshDocument()
    editor.on("update", scheduleDocument)
    editor.on("selectionUpdate", scheduleSelection)
    return () => {
      if (timeout) clearTimeout(timeout)
      if (frame) cancelAnimationFrame(frame)
      editor.off("update", scheduleDocument)
      editor.off("selectionUpdate", scheduleSelection)
    }
  }, [editor])

  React.useEffect(() => {
    if (!open || !window.editorDesktop) return
    void window.editorDesktop.dictionary.listWords().then(setDictionaryWords)
  }, [open])

  const allWritingIssues = React.useMemo(
    () =>
      contentRevision >= 0
        ? writingIssues(
            editor,
            writingAssistant.longSentenceThreshold,
            proofingLanguage
          )
        : [],
    [
      contentRevision,
      editor,
      proofingLanguage,
      writingAssistant.longSentenceThreshold,
    ]
  )
  const issues = React.useMemo(
    () => {
      const disabled = new Set(writingAssistant.disabledRules)
      const ignored = new Set(writingAssistant.ignoredIssues)
      return allWritingIssues.filter(
        (issue) =>
          !disabled.has(issue.ruleId) && !ignored.has(issue.fingerprint)
      )
    },
    [
      allWritingIssues,
      writingAssistant.disabledRules,
      writingAssistant.ignoredIssues,
    ]
  )
  const structuralComparison = React.useMemo(
    () =>
      editor && compareDocument && contentRevision >= 0
        ? compareDocumentStructure(editor.getJSON(), compareDocument)
        : null,
    [compareDocument, contentRevision, editor]
  )
  const structuralPreviews = React.useMemo(
    () =>
      new Map(
        (structuralComparison?.changes ?? []).slice(0, 80).map((change) => [
          change.id,
          limitDiffSegments(
            compareDocumentText(change.currentText, change.incomingText).segments,
            800,
            80
          ),
        ])
      ),
    [structuralComparison]
  )
  const referenceTargets = React.useMemo(
    () =>
      structure.filter(
        (item) =>
          item.type === "heading" ||
          item.type === "caption" ||
          item.type === "equation" ||
          item.type === "bookmark"
      ),
    [structure]
  )

  const applyWritingFix = (issue: LocalWritingIssue) => {
    if (!editor) return
    const currentText = editor.state.doc.textBetween(issue.from, issue.to)
    if (currentText !== issue.originalText) {
      toast.info("El texto cambió desde que se detectó el aviso", {
        description: "La revisión se actualizará sin aplicar un cambio dudoso.",
      })
      refreshContent()
      return
    }
    editor
      .chain()
      .focus()
      .setTextSelection({ from: issue.from, to: issue.to })
      .run()
    if (issue.replacement !== undefined) {
      editor.view.dispatch(
        editor.state.tr.insertText(issue.replacement, issue.from, issue.to)
      )
    }
  }

  const toggleTableAttribute = (attribute: "repeatHeader" | "allowRowBreak") => {
    if (!editor) return
    const current = editor.getAttributes("table")[attribute] !== false
    editor.chain().focus().updateAttributes("table", { [attribute]: !current }).run()
  }

  const clearComparison = () => {
    setCompareDocument(null)
    setCompareName("")
    setSelectedStructuralChanges(new Set())
  }

  const loadComparisonFile = async (file: File) => {
    if (!editor) return
    setCompareLoading(true)
    setCompareName(file.name)
    try {
      const html = await extractEditableHtmlFromFile(file)
      const container = document.createElement("div")
      container.innerHTML = html
      const incoming = ProseMirrorDOMParser.fromSchema(editor.schema)
        .parse(container)
        .toJSON() as JSONContent
      const nextComparison = compareDocumentStructure(
        editor.getJSON(),
        incoming
      )
      setCompareDocument(incoming)
      setSelectedStructuralChanges(
        new Set(nextComparison.changes.map((change) => change.id))
      )
      if (nextComparison.changes.length === 0) {
        toast.success("Los documentos tienen la misma estructura y formato")
      }
    } catch (error) {
      clearComparison()
      toast.error("No se pudo leer la versión", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setCompareLoading(false)
    }
  }

  const mergeSelectedChanges = () => {
    if (!editor || !structuralComparison) return
    const merged = mergeDocumentStructure(
      editor.getJSON(),
      structuralComparison,
      selectedStructuralChanges
    )
    onReplaceDocument(
      merged,
      `Antes de combinar cambios de ${compareName || "otra versión"}`
    )
    clearComparison()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Herramientas del documento</SheetTitle>
          <SheetDescription>
            Navegación, campos académicos, búsqueda, tablas, comparación y
            corrección local.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          defaultValue={initialTab}
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          {/* Buscar ya no vive aquí: la barra de `Ctrl+F` resalta todas las
              coincidencias sobre el propio documento y permite recorrerlas,
              cosa que esta pestaña no hacía. Tener las dos obligaba a elegir
              entre una buena y una peor sin ninguna pista de cuál era cuál. */}
          <TabsList className="grid h-auto grid-cols-3 sm:grid-cols-5">
            <TabsTrigger value="navigate">Navegar</TabsTrigger>
            <TabsTrigger value="academic">Académico</TabsTrigger>
            <TabsTrigger value="compare">Comparar</TabsTrigger>
            <TabsTrigger value="mailMerge">Combinar</TabsTrigger>
            <TabsTrigger value="writing">Revisar</TabsTrigger>
          </TabsList>
          <ScrollArea className="mt-3 flex-1 pr-3">
            <TabsContent value="navigate" className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ListTree className="h-4 w-4" />
                Mapa del documento
              </div>
              {structure.length === 0 ? (
                <p className="rounded border border-dashed p-4 text-xs text-muted-foreground">
                  Añade títulos, rótulos o citas para construir el mapa.
                </p>
              ) : (
                <div className="space-y-1">
                  {structure.map((item) => (
                    <button
                      key={`${item.type}-${item.id}-${item.position}`}
                      type="button"
                      className="flex w-full items-center gap-2 rounded border p-2 text-left text-xs hover:bg-muted"
                      style={{
                        paddingLeft:
                          item.type === "heading"
                            ? `${Math.max(0.5, (item.level ?? 1) * 0.75)}rem`
                            : undefined,
                      }}
                      onClick={() =>
                        editor
                          ?.chain()
                          .focus()
                          .setTextSelection(
                            item.position + (item.type === "bookmark" ? 0 : 1)
                          )
                          .scrollIntoView()
                          .run()
                      }
                    >
                      {item.type === "heading" ? (
                        <Heading className="h-3.5 w-3.5 shrink-0" />
                      ) : item.type === "citation" ? (
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      ) : item.type === "bookmark" ? (
                        <BookmarkIcon className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="line-clamp-2">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="academic" className="space-y-5">
              <section className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Heading className="h-4 w-4" />
                  Numeración multinivel
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={outlineNumbering.enabled ? "on" : "off"}
                    onChange={(event) =>
                      onOutlineNumberingChange({
                        ...outlineNumbering,
                        enabled: event.target.value === "on",
                      })
                    }
                    className="h-9 rounded border bg-background px-2 text-xs"
                  >
                    <option value="off">Desactivada</option>
                    <option value="on">Activada</option>
                  </select>
                  <select
                    value={outlineNumbering.maxLevel}
                    onChange={(event) =>
                      onOutlineNumberingChange({
                        ...outlineNumbering,
                        maxLevel: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 | 6,
                      })
                    }
                    className="h-9 rounded border bg-background px-2 text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6].map((level) => (
                      <option key={level} value={level}>
                        Hasta nivel {level}
                      </option>
                    ))}
                  </select>
                  <select
                    value={outlineNumbering.separator}
                    onChange={(event) =>
                      onOutlineNumberingChange({
                        ...outlineNumbering,
                        separator: event.target.value as "." | "-",
                      })
                    }
                    className="h-9 rounded border bg-background px-2 text-xs"
                  >
                    <option value=".">1.1.1</option>
                    <option value="-">1-1-1</option>
                  </select>
                </div>
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <Label>Rótulo de figura o tabla</Label>
                <div className="flex gap-2">
                  <select
                    value={captionKind}
                    onChange={(event) =>
                      setCaptionKind(event.target.value as "figure" | "table")
                    }
                    className="h-9 rounded border bg-background px-2 text-xs"
                  >
                    <option value="figure">Figura</option>
                    <option value="table">Tabla</option>
                  </select>
                  <Input
                    value={captionTitle}
                    onChange={(event) => setCaptionTitle(event.target.value)}
                    placeholder="Descripción del rótulo"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      onInsertCaption(captionKind, captionTitle)
                      setCaptionTitle("")
                    }}
                  >
                    Insertar
                  </Button>
                </div>
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <Label className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Ecuación LaTeX/KaTeX
                </Label>
                <Textarea
                  value={latex}
                  onChange={(event) => setLatex(event.target.value)}
                  className="font-mono"
                />
                <Button type="button" onClick={() => onInsertEquation(latex)}>
                  Insertar ecuación numerada
                </Button>
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <Label className="flex items-center gap-2">
                  <BookmarkIcon className="h-4 w-4" />
                  Marcadores manuales
                </Label>
                <p className="text-xs text-muted-foreground">
                  Selecciona texto, asigna un nombre y úsalo para navegar o
                  crear una referencia cruzada.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={bookmarkDraft}
                    maxLength={80}
                    onChange={(event) => setBookmarkDraft(event.target.value)}
                    placeholder="Nombre del marcador"
                  />
                  <Button
                    type="button"
                    disabled={
                      !editor ||
                      editor.state.selection.empty ||
                      !bookmarkDraft.trim()
                    }
                    onClick={() => {
                      if (!editor || editor.state.selection.empty) return
                      editor
                        .chain()
                        .focus()
                        .setBookmark({
                          bookmarkId: `bookmark-${crypto.randomUUID()}`,
                          name: bookmarkDraft.trim(),
                        })
                        .run()
                      setBookmarkDraft("")
                    }}
                  >
                    Crear
                  </Button>
                </div>
                <div className="space-y-1">
                  {structure
                    .filter((item) => item.type === "bookmark")
                    .map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="flex items-center gap-2 rounded border px-2 py-1 text-xs"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left hover:text-primary"
                          onClick={() =>
                            editor
                              ?.chain()
                              .focus()
                              .setTextSelection(bookmark.position)
                              .scrollIntoView()
                              .run()
                          }
                        >
                          {bookmark.label}
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar ${bookmark.label}`}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            if (!editor) return
                            const markType = editor.schema.marks.bookmark
                            if (!markType) return
                            const transaction = editor.state.tr
                            editor.state.doc.descendants((node, position) => {
                              if (
                                node.isText &&
                                node.marks.some(
                                  (mark) =>
                                    mark.type === markType &&
                                    mark.attrs.bookmarkId === bookmark.id
                                )
                              ) {
                                transaction.removeMark(
                                  position,
                                  position + node.nodeSize,
                                  markType
                                )
                              }
                            })
                            editor.view.dispatch(transaction)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <Label>Referencia cruzada</Label>
                <div className="flex gap-2">
                  <select
                    value={referenceTarget}
                    onChange={(event) => setReferenceTarget(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded border bg-background px-2 text-xs"
                  >
                    <option value="">
                      Elige título, rótulo, ecuación o marcador
                    </option>
                    {referenceTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    disabled={!referenceTarget}
                    onClick={() => onInsertCrossReference(referenceTarget)}
                  >
                    Insertar
                  </Button>
                </div>
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <Label className="flex items-center gap-2">
                  <Table2 className="h-4 w-4" />
                  Tabla seleccionada
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().mergeCells().run()}>Combinar</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().splitCell().run()}>Dividir</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>Cabecera</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().addRowAfter().run()}>+ fila</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().addColumnAfter().run()}>+ columna</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().deleteRow().run()}>− fila</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().deleteColumn().run()}>− columna</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => toggleTableAttribute("repeatHeader")}>Repetir cabecera</Button>
                  <Button size="sm" variant="outline" disabled={!editor?.isActive("table")} onClick={() => toggleTableAttribute("allowRowBreak")}>No dividir fila</Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={
                      editor?.getAttributes("table").tableStyle ?? "grid"
                    }
                    disabled={!editor?.isActive("table")}
                    onChange={(event) =>
                      editor
                        ?.chain()
                        .focus()
                        .updateAttributes("table", {
                          tableStyle: event.target.value,
                        })
                        .run()
                    }
                    className="h-8 rounded border bg-background px-2 text-xs"
                    aria-label="Estilo de tabla"
                  >
                    <option value="plain">Sin bordes</option>
                    <option value="grid">Cuadrícula</option>
                    <option value="header">Cabecera de color</option>
                    <option value="banded">Filas con bandas</option>
                    <option value="academic">Académica</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editor?.isActive("table")}
                    onClick={() =>
                      editor &&
                      sortSelectedTable(
                        editor,
                        "ascending",
                        proofingLanguage
                      )
                    }
                  >
                    Orden A→Z
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editor?.isActive("table")}
                    onClick={() =>
                      editor &&
                      sortSelectedTable(
                        editor,
                        "descending",
                        proofingLanguage
                      )
                    }
                  >
                    Orden Z→A
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    value={tableFormulaOperation}
                    disabled={!editor?.isActive("table")}
                    onChange={(event) =>
                      setTableFormulaOperation(
                        event.target.value as TableFormulaOperation
                      )
                    }
                    className="h-8 rounded border bg-background px-2 text-xs"
                    aria-label="Operación de fórmula"
                  >
                    <option value="SUM">Suma</option>
                    <option value="AVERAGE">Promedio</option>
                    <option value="COUNT">Contar</option>
                    <option value="MIN">Mínimo</option>
                    <option value="MAX">Máximo</option>
                  </select>
                  <select
                    value={tableFormulaDirection}
                    disabled={!editor?.isActive("table")}
                    onChange={(event) =>
                      setTableFormulaDirection(
                        event.target.value as TableFormulaDirection
                      )
                    }
                    className="h-8 rounded border bg-background px-2 text-xs"
                    aria-label="Dirección de fórmula"
                  >
                    <option value="ABOVE">Celdas superiores</option>
                    <option value="LEFT">Celdas de la izquierda</option>
                  </select>
                  <Button
                    size="sm"
                    disabled={!editor?.isActive("table")}
                    onClick={() => {
                      if (!editor) return
                      const result = applySelectedTableFormula(
                        editor,
                        tableFormulaOperation,
                        tableFormulaDirection,
                        proofingLanguage
                      )
                      if (result) {
                        toast.success(
                          `Fórmula =${result.expression} insertada`,
                          {
                            description: `${result.sourceCount} valores · resultado ${result.displayValue}`,
                          }
                        )
                      }
                    }}
                  >
                    Insertar fórmula
                  </Button>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="compare" className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileDiff className="h-4 w-4" />
                Comparar y combinar versiones
              </div>
              <p className="text-xs text-muted-foreground">
                Compara bloques completos y conserva títulos, listas, tablas y
                formato. Todo se procesa en este dispositivo.
              </p>
              <Input
                type="file"
                accept=".docx,.odt,.txt,.md,.html,.pdf"
                disabled={!editor || compareLoading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  void loadComparisonFile(file)
                  event.currentTarget.value = ""
                }}
              />
              {compareLoading && (
                <p className="text-xs text-muted-foreground">
                  Analizando estructura y formato…
                </p>
              )}
              {structuralComparison && compareDocument && (
                <>
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs">
                    <p className="font-medium">{compareName}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <span>
                        <strong>{structuralComparison.changes.length}</strong>{" "}
                        grupos
                      </span>
                      <span className="text-emerald-700">
                        +{structuralComparison.insertedBlocks} bloques
                      </span>
                      <span className="text-red-700">
                        −{structuralComparison.deletedBlocks} bloques
                      </span>
                      <span>
                        {structuralComparison.similarity}% idéntico
                      </span>
                    </div>
                    {structuralComparison.formattingChanges > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {structuralComparison.formattingChanges} cambios afectan
                        solo al formato o a la estructura.
                      </p>
                    )}
                  </div>
                  {structuralComparison.changes.length === 0 ? (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                      No hay diferencias estructurales ni de formato.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {selectedStructuralChanges.size} de{" "}
                          {structuralComparison.changes.length} grupos
                          seleccionados
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setSelectedStructuralChanges(
                                new Set(
                                  structuralComparison.changes.map(
                                    (change) => change.id
                                  )
                                )
                              )
                            }
                          >
                            Seleccionar todo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setSelectedStructuralChanges(new Set())
                            }
                          >
                            Ninguno
                          </Button>
                        </div>
                      </div>
                      <div
                        className="max-h-[26rem] space-y-2 overflow-auto pr-1"
                        aria-label="Cambios estructurales encontrados"
                      >
                        {structuralComparison.changes
                          .slice(0, 80)
                          .map((change, changeIndex) => {
                            const preview = structuralPreviews.get(change.id)
                            const checked = selectedStructuralChanges.has(
                              change.id
                            )
                            const label =
                              change.formatOnly
                                ? "Cambio de formato"
                                : change.type === "insert"
                                  ? "Bloque añadido"
                                  : change.type === "delete"
                                    ? "Bloque eliminado"
                                    : "Bloque modificado"
                            const description =
                              change.incoming[0] ?? change.current[0]
                            return (
                              <label
                                key={change.id}
                                className={`block cursor-pointer space-y-2 rounded-lg border p-3 transition-colors ${
                                  checked
                                    ? "border-primary/50 bg-primary/5"
                                    : "bg-background"
                                }`}
                              >
                                <span className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={checked}
                                    onChange={(event) =>
                                      setSelectedStructuralChanges(
                                        (current) => {
                                          const next = new Set(current)
                                          if (event.target.checked) {
                                            next.add(change.id)
                                          } else {
                                            next.delete(change.id)
                                          }
                                          return next
                                        }
                                      )
                                    }
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-xs font-medium">
                                      {changeIndex + 1}. {label}
                                    </span>
                                    <span className="block truncate text-[11px] text-muted-foreground">
                                      {description
                                        ? describeDocumentBlock(description)
                                        : "Contenido eliminado"}
                                    </span>
                                  </span>
                                </span>
                                {preview && (
                                  <span className="block whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-serif text-xs leading-5">
                                    {preview.segments.map((segment, index) => (
                                      <span
                                        key={`${segment.type}-${index}`}
                                        className={
                                          segment.type === "insert"
                                            ? "rounded-sm bg-emerald-100 text-emerald-950 underline decoration-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100"
                                            : segment.type === "delete"
                                              ? "rounded-sm bg-red-100 text-red-950 line-through decoration-red-600 dark:bg-red-950/40 dark:text-red-100"
                                              : undefined
                                        }
                                      >
                                        {segment.text}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </label>
                            )
                          })}
                      </div>
                      {structuralComparison.changes.length > 80 && (
                        <p className="text-[11px] text-muted-foreground">
                          Se muestran los primeros 80 grupos para mantener la
                          interfaz fluida. “Seleccionar todo” incluye todos.
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={
                        structuralComparison.changes.length === 0 ||
                        selectedStructuralChanges.size === 0
                      }
                      onClick={mergeSelectedChanges}
                    >
                      <GitMerge className="h-4 w-4" />
                      Combinar seleccionados
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onReplaceDocument(
                          compareDocument,
                          `Antes de usar la versión ${compareName}`
                        )
                        clearComparison()
                      }}
                    >
                      Usar versión completa
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearComparison}
                    >
                      Descartar comparación
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="mailMerge" className="space-y-3">
              <MailMergePanel
                editor={editor}
                documentRevision={contentRevision}
                onReplaceDocument={onReplaceDocument}
                onCreateDocument={onCreateDocument}
                onExportMergedDocuments={onExportMergedDocuments}
              />
            </TabsContent>

            <TabsContent value="writing" className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Languages className="h-4 w-4" />
                Asistente de escritura local
              </div>
              <p className="text-xs text-muted-foreground">
                Reglas explicables sin enviar el documento a un servidor. Las
                sugerencias de estilo nunca se presentan como errores.
              </p>
              <ThesaurusPanel
                editor={editor}
                language={proofingLanguage}
              />
              <AutoCorrectPanel
                settings={autocorrect}
                onChange={onAutoCorrectChange}
              />
              <section className="space-y-3 rounded-lg border p-3">
                <label className="grid gap-1 text-xs">
                  <span className="font-medium">Perfil de legibilidad</span>
                  <select
                    value={
                      writingAssistant.longSentenceThreshold === null
                        ? "minimal"
                        : String(writingAssistant.longSentenceThreshold)
                    }
                    onChange={(event) =>
                      onWritingAssistantChange({
                        ...writingAssistant,
                        longSentenceThreshold:
                          event.target.value === "minimal"
                            ? null
                            : (Number(event.target.value) as 45 | 60 | 75),
                      })
                    }
                    className="h-9 rounded border bg-background px-2"
                  >
                    <option value="45">Estricto · 45 palabras</option>
                    <option value="60">Académico · 60 palabras</option>
                    <option value="75">Flexible · 75 palabras</option>
                    <option value="minimal">Solo correcciones mecánicas</option>
                  </select>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    Object.keys(WRITING_RULE_LABELS) as WritingRuleId[]
                  ).map((ruleId) => {
                    const enabled =
                      !writingAssistant.disabledRules.includes(ruleId)
                    return (
                      <label
                        key={ruleId}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => {
                            const disabled = new Set(
                              writingAssistant.disabledRules
                            )
                            if (event.target.checked) disabled.delete(ruleId)
                            else disabled.add(ruleId)
                            onWritingAssistantChange({
                              ...writingAssistant,
                              disabledRules: [...disabled],
                            })
                          }}
                        />
                        {WRITING_RULE_LABELS[ruleId]}
                      </label>
                    )
                  })}
                </div>
                {writingAssistant.ignoredIssues.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    onClick={() =>
                      onWritingAssistantChange({
                        ...writingAssistant,
                        ignoredIssues: [],
                      })
                    }
                  >
                    Restaurar {writingAssistant.ignoredIssues.length} avisos
                    ignorados
                  </Button>
                )}
              </section>
              {issues.length === 0 ? (
                <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
                  No se detectan problemas con las reglas locales.
                </p>
              ) : (
                <div className="space-y-2">
                  {issues.slice(0, 100).map((issue) => (
                    <div
                      key={issue.id}
                      className="space-y-2 rounded border p-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{issue.message}</p>
                          <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                            {issue.excerpt}
                          </p>
                        </div>
                        <span
                          className={
                            issue.severity === "correction"
                              ? "shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                              : "shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                          }
                        >
                          {issue.severity === "correction"
                            ? "Corrección segura"
                            : "Sugerencia"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {issue.explanation}
                      </p>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onWritingAssistantChange({
                              ...writingAssistant,
                              ignoredIssues: [
                                ...new Set([
                                  ...writingAssistant.ignoredIssues,
                                  issue.fingerprint,
                                ]),
                              ].slice(-500),
                            })
                          }
                        >
                          Ignorar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyWritingFix(issue)}
                        >
                          {issue.replacement === undefined ? "Ir" : "Corregir"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <section className="space-y-2 rounded-lg border p-3">
                <Label>Diccionario personal de Windows</Label>
                <div className="flex gap-2">
                  <Input value={dictionaryDraft} onChange={(event) => setDictionaryDraft(event.target.value)} placeholder="Palabra aceptada" />
                  <Button
                    type="button"
                    disabled={!dictionaryDraft.trim() || !window.editorDesktop}
                    onClick={() => {
                      if (!window.editorDesktop) return
                      void window.editorDesktop.dictionary
                        .addWord(dictionaryDraft)
                        .then((words) => {
                          setDictionaryWords(words)
                          setDictionaryDraft("")
                        })
                        .catch((error) =>
                          toast.error("Palabra no válida", {
                            description:
                              error instanceof Error ? error.message : undefined,
                          })
                        )
                    }}
                  >
                    Añadir
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {dictionaryWords.map((word) => (
                    <span key={word} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                      {word}
                      <button
                        type="button"
                        aria-label={`Eliminar ${word}`}
                        onClick={() =>
                          void window.editorDesktop?.dictionary
                            .removeWord(word)
                            .then(setDictionaryWords)
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
