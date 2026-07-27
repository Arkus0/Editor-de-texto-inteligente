"use client"

import * as React from "react"
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model"
import type { Editor, JSONContent } from "@tiptap/react"
import {
  Braces,
  FileSpreadsheet,
  FolderDown,
  GitMerge,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  applyMailMergeRecord,
  buildMailMergeBatchHtml,
  buildMailMergeDocuments,
  extractMailMergeFields,
  parseMailMergeDataset,
  type MailMergeDataset,
} from "@/lib/mail-merge"

interface MailMergePanelProps {
  editor: Editor | null
  documentRevision: number
  onReplaceDocument: (content: JSONContent, checkpointLabel: string) => void
  onCreateDocument: (html: string, title: string) => void
  onExportMergedDocuments: (
    documents: Array<{ name: string; html: string }>,
    format: "docx" | "pdf",
    batchName: string
  ) => Promise<void>
}

function htmlToDocument(editor: Editor, html: string) {
  const container = document.createElement("div")
  container.innerHTML = html
  return ProseMirrorDOMParser.fromSchema(editor.schema)
    .parse(container)
    .toJSON() as JSONContent
}

export function MailMergePanel({
  editor,
  documentRevision,
  onReplaceDocument,
  onCreateDocument,
  onExportMergedDocuments,
}: MailMergePanelProps) {
  const [dataset, setDataset] = React.useState<MailMergeDataset | null>(null)
  const [fileName, setFileName] = React.useState("")
  const [selectedRecord, setSelectedRecord] = React.useState(0)
  const [batchFrom, setBatchFrom] = React.useState(1)
  const [batchTo, setBatchTo] = React.useState(1)
  const [nameField, setNameField] = React.useState("")
  const [exportFormat, setExportFormat] = React.useState<"docx" | "pdf">("pdf")
  const [exporting, setExporting] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const templateHtml = React.useMemo(
    () => (documentRevision >= 0 ? editor?.getHTML() ?? "" : ""),
    [documentRevision, editor]
  )
  const templateFields = React.useMemo(
    () => extractMailMergeFields(templateHtml),
    [templateHtml]
  )
  const preview = React.useMemo(() => {
    const record = dataset?.records[selectedRecord]
    return record
      ? applyMailMergeRecord(templateHtml, record)
      : { html: "", missingFields: [] }
  }, [dataset, selectedRecord, templateHtml])

  const loadDataset = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 5 MB")
      return
    }
    setLoading(true)
    try {
      const next = parseMailMergeDataset(await file.text())
      setDataset(next)
      setFileName(file.name)
      setSelectedRecord(0)
      setBatchFrom(1)
      setBatchTo(Math.min(500, Math.max(1, next.records.length)))
      toast.success(
        `${next.records.length.toLocaleString("es-ES")} registros preparados`
      )
    } catch (error) {
      setDataset(null)
      setFileName("")
      toast.error("No se pudo leer la fuente de datos", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  const applyRecord = () => {
    if (!editor || !dataset?.records[selectedRecord]) return
    const result = applyMailMergeRecord(
      templateHtml,
      dataset.records[selectedRecord]
    )
    onReplaceDocument(
      htmlToDocument(editor, result.html),
      `Antes de combinar la fila ${selectedRecord + 1} de ${fileName}`
    )
    if (result.missingFields.length) {
      toast.warning("Quedan campos sin datos", {
        description: result.missingFields.join(", "),
      })
    }
  }

  const exportOnePerRecipient = async () => {
    if (!editor || !dataset?.records.length) return
    const selectedRecords = dataset.records.slice(batchFrom - 1, batchTo)
    const documents = buildMailMergeDocuments(
      templateHtml,
      selectedRecords,
      nameField || undefined
    )
    const missing = new Set(
      documents.flatMap((document) => document.missingFields)
    )
    setExporting(true)
    try {
      await onExportMergedDocuments(
        documents.map(({ name, html }) => ({ name, html })),
        exportFormat,
        `${fileName.replace(/\.[^.]+$/, "")} ${batchFrom}-${batchTo}`
      )
      toast.success(
        `${documents.length.toLocaleString("es-ES")} archivos listos en el ZIP`
      )
      if (missing.size) {
        toast.warning("Algunos campos no existen en el CSV", {
          description: [...missing].join(", "),
        })
      }
    } catch {
      toast.error("No se pudo generar el lote", {
        description: "Prueba con menos filas o revisa el documento.",
      })
    } finally {
      setExporting(false)
    }
  }

  const createBatch = () => {
    if (!editor || !dataset?.records.length) return
    const selectedRecords = dataset.records.slice(batchFrom - 1, batchTo)
    const result = buildMailMergeBatchHtml(templateHtml, selectedRecords)
    onCreateDocument(
      result.html,
      `Combinación ${batchFrom}-${batchTo} · ${fileName.replace(/\.[^.]+$/, "")}`
    )
    toast.success(
      `Lote creado con ${selectedRecords.length.toLocaleString("es-ES")} documentos`
    )
    if (result.missingFields.length) {
      toast.warning("Algunos campos no existen en el CSV", {
        description: result.missingFields.join(", "),
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileSpreadsheet className="h-4 w-4" />
        Combinar correspondencia local
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Carga un CSV, inserta campos como {"{{Nombre}}"} y crea cartas,
        certificados o etiquetas sin enviar datos fuera del dispositivo.
      </p>

      <section className="space-y-3 rounded-lg border p-3">
        <label className="space-y-1 text-xs">
          <span className="font-medium">1. Fuente de datos CSV/TSV</span>
          <Input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void loadDataset(file)
              event.currentTarget.value = ""
            }}
          />
        </label>
        {dataset && (
          <p className="text-xs text-muted-foreground">
            {fileName} · {dataset.fields.length} campos ·{" "}
            {dataset.records.length.toLocaleString("es-ES")} registros
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">2. Campos del documento</p>
          <p className="text-xs text-muted-foreground">
            Coloca el cursor y pulsa un campo para insertarlo.
          </p>
        </div>
        {dataset ? (
          <div className="flex flex-wrap gap-2">
            {dataset.fields.map((field) => (
              <Button
                key={field}
                type="button"
                size="sm"
                variant="outline"
                disabled={!editor}
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .insertContent(`{{${field}}}`)
                    .run()
                }
              >
                <Braces className="h-3.5 w-3.5" />
                {field}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Carga primero una fuente para ver sus encabezados.
          </p>
        )}
        <p className="text-xs">
          Campos usados:{" "}
          {templateFields.length ? templateFields.join(", ") : "ninguno"}
        </p>
      </section>

      {dataset && dataset.records.length > 0 && (
        <section className="space-y-3 rounded-lg border p-3">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1 text-xs">
              <span className="font-medium">3. Vista previa del registro</span>
              <Input
                type="number"
                min={1}
                max={dataset.records.length}
                value={selectedRecord + 1}
                onChange={(event) =>
                  setSelectedRecord(
                    Math.min(
                      dataset.records.length - 1,
                      Math.max(0, Number(event.target.value) - 1)
                    )
                  )
                }
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={!editor || templateFields.length === 0}
              onClick={applyRecord}
            >
              Aplicar fila
            </Button>
          </div>
          <div
            className="max-h-48 overflow-auto rounded border bg-background p-3 text-xs leading-5"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
          {preview.missingFields.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Sin columna correspondiente: {preview.missingFields.join(", ")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium">Lote desde la fila</span>
              <Input
                type="number"
                min={1}
                max={batchTo}
                value={batchFrom}
                onChange={(event) =>
                  setBatchFrom(
                    Math.min(
                      batchTo,
                      Math.max(1, Number(event.target.value) || 1)
                    )
                  )
                }
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium">Hasta la fila</span>
              <Input
                type="number"
                min={batchFrom}
                max={dataset.records.length}
                value={batchTo}
                onChange={(event) =>
                  setBatchTo(
                    Math.min(
                      dataset.records.length,
                      Math.max(
                        batchFrom,
                        Number(event.target.value) || batchFrom
                      )
                    )
                  )
                }
              />
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!editor || templateFields.length === 0}
            onClick={createBatch}
          >
            <GitMerge className="h-4 w-4" />
            Un solo documento de{" "}
            {(batchTo - batchFrom + 1).toLocaleString("es-ES")} páginas
          </Button>

          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold">Un archivo por destinatario</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 space-y-1 text-xs">
                <span className="text-muted-foreground">
                  Nombrar cada archivo con
                </span>
                <select
                  value={nameField}
                  onChange={(event) => setNameField(event.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="">Número de fila</option>
                  {(dataset?.fields ?? []).map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Formato</span>
                <select
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(event.target.value as "docx" | "pdf")
                  }
                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="pdf">PDF</option>
                  <option value="docx">Word</option>
                </select>
              </label>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={
                !editor || templateFields.length === 0 || exporting
              }
              onClick={() => void exportOnePerRecipient()}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderDown className="h-4 w-4" />
              )}
              {exporting
                ? "Generando…"
                : `Descargar ZIP con ${(
                    batchTo -
                    batchFrom +
                    1
                  ).toLocaleString("es-ES")} archivos`}
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            El documento único separa cada registro con un salto de página
            nativo y sirve para imprimir de una tirada. El ZIP trae un archivo
            independiente por persona, listo para adjuntar en un correo sin
            trocear nada a mano. Todo se genera en este dispositivo.
          </p>
        </section>
      )}
    </div>
  )
}
