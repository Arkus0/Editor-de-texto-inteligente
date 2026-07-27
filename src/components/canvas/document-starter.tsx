"use client"

import * as React from "react"
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Gauge,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { ProfessionalControls } from "@/components/academic/professional-controls"
import { FileDropzone } from "@/components/left-panel/file-dropzone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  DOCUMENT_TEMPLATES,
  type DocumentTemplateId,
} from "@/lib/document-templates"
import {
  EXERCISE_TYPE_LABELS,
  type AcademicAttachment,
  type AttachmentRole,
  type ExerciseAnalysis,
  type ExerciseAnalysisStatus,
  type ExerciseType,
  type WorkspaceMode,
} from "@/types/academic"

export interface RecentDocumentSummary {
  path: string
  title: string
  lastOpenedAt: number
}

/**
 * Miniaturas de las plantillas. Word muestra la pinta real de cada documento
 * en su pantalla de inicio, y eso es lo que permite elegir de un vistazo; un
 * icono genérico repetido seis veces no distingue una carta de un currículum.
 *
 * Cada forma se dibuja con divs: `title` es una línea gruesa y oscura, `head`
 * un subtítulo de sección, `text` una línea de párrafo y `gap` un espacio. El
 * ancho va en porcentaje para que la miniatura respire como una página real.
 */
type PreviewRow = readonly [kind: "title" | "head" | "text" | "gap", width: number]

const TEMPLATE_PREVIEWS: Record<DocumentTemplateId, readonly PreviewRow[]> = {
  report: [
    ["title", 70],
    ["text", 45],
    ["gap", 0],
    ["head", 52],
    ["text", 100],
    ["text", 88],
    ["head", 44],
    ["text", 96],
  ],
  letter: [
    ["text", 38],
    ["text", 30],
    ["gap", 0],
    ["text", 46],
    ["text", 100],
    ["text", 94],
    ["text", 100],
    ["text", 40],
  ],
  resume: [
    ["title", 56],
    ["text", 68],
    ["gap", 0],
    ["head", 40],
    ["text", 92],
    ["head", 34],
    ["text", 88],
    ["text", 72],
  ],
  meeting: [
    ["title", 62],
    ["text", 52],
    ["gap", 0],
    ["head", 30],
    ["text", 84],
    ["text", 78],
    ["text", 84],
    ["text", 66],
  ],
  project: [
    ["title", 66],
    ["gap", 0],
    ["head", 46],
    ["text", 100],
    ["text", 100],
    ["text", 100],
    ["text", 100],
    ["text", 74],
  ],
  academic: [
    ["title", 78],
    ["text", 50],
    ["gap", 0],
    ["head", 36],
    ["text", 100],
    ["text", 100],
    ["text", 92],
    ["text", 100],
  ],
  // Las líneas cortas alternando con huecos sugieren un impreso con campos.
  questionnaire: [
    ["title", 58],
    ["text", 72],
    ["gap", 0],
    ["head", 38],
    ["text", 62],
    ["text", 58],
    ["text", 66],
    ["text", 44],
  ],
  worksheet: [
    ["title", 68],
    ["text", 54],
    ["gap", 0],
    ["head", 46],
    ["text", 80],
    ["text", 74],
    ["head", 42],
    ["text", 68],
  ],
}

function PagePreview({
  rows,
  accent = false,
}: {
  rows: readonly PreviewRow[]
  accent?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block aspect-[1/1.32] w-full overflow-hidden rounded-[3px] border bg-white px-[9%] py-[8%] dark:bg-zinc-100",
        accent ? "border-primary/35" : "border-black/10"
      )}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-0 block h-[3px]",
          accent ? "bg-primary" : "bg-primary/45"
        )}
      />
      <span className="mt-[4%] flex flex-col gap-[5%]">
        {rows.map(([kind, width], index) =>
          kind === "gap" ? (
            <span key={index} className="block h-[6%]" />
          ) : (
            <span
              key={index}
              className={cn(
                "block rounded-[1px]",
                kind === "title"
                  ? "h-[7%] bg-zinc-800/80"
                  : kind === "head"
                    ? "h-[5%] bg-primary/55"
                    : "h-[3.5%] bg-zinc-400/60"
              )}
              style={{ width: `${width}%` }}
            />
          )
        )}
      </span>
    </span>
  )
}

interface DocumentStarterProps {
  prompt: string
  onPromptChange: (value: string) => void
  attachments: AcademicAttachment[]
  onFilesSelected: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  onAttachmentRoleChange: (id: string, role: AttachmentRole) => void
  onGenerate: () => void
  onStartBlank: () => void
  onStartTemplate: (templateId: DocumentTemplateId) => void
  isGenerating: boolean
  canGenerate: boolean
  errorMessage?: string | null
  workspaceMode: WorkspaceMode
  onWorkspaceModeChange: (mode: WorkspaceMode) => void
  analysis: ExerciseAnalysis
  analysisStatus: ExerciseAnalysisStatus
  onAnalysisChange: (analysis: ExerciseAnalysis) => void
  onAnalyze: () => void
  geminiConfigured: boolean
  onConfigureGemini: () => void
  modelLabel: string
  recentDocuments: RecentDocumentSummary[]
  onOpenRecent: (path: string) => void
  onRemoveRecent: (path: string) => void
  onBrowseDocuments?: () => void
}

const RECENT_TIME_FORMAT = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
})
const RECENT_DATE_FORMAT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
})
const RECENT_YEAR_FORMAT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

/**
 * Una fecha completa obliga a hacer la resta mentalmente. Lo que interesa al
 * mirar la lista es si el documento es de hace un rato, de ayer o de hace
 * meses, así que lo reciente se cuenta en relativo y lo antiguo con su fecha.
 */
export function formatRecentDate(timestamp: number, now = Date.now()): string {
  const elapsed = now - timestamp
  const minutes = Math.floor(elapsed / 60_000)

  if (minutes < 1) return "ahora mismo"
  if (minutes < 60) return `hace ${minutes} min`

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  if (timestamp >= startOfToday.getTime()) {
    return `hoy, ${RECENT_TIME_FORMAT.format(timestamp)}`
  }

  const startOfYesterday = startOfToday.getTime() - 86_400_000
  if (timestamp >= startOfYesterday) {
    return `ayer, ${RECENT_TIME_FORMAT.format(timestamp)}`
  }

  const isSameYear =
    new Date(timestamp).getFullYear() === new Date(now).getFullYear()
  return isSameYear
    ? RECENT_DATE_FORMAT.format(timestamp)
    : RECENT_YEAR_FORMAT.format(timestamp)
}

// El análisis separado queda oculto mientras validamos el núcleo estable de una
// sola llamada. Mantenerlo fuera del flujo evita cargos y puntos de fallo extra.
const ENABLE_EXERCISE_ANALYSIS = false

function AnalysisStatus({
  analysis,
  status,
  onAnalyze,
}: {
  analysis: ExerciseAnalysis
  status: ExerciseAnalysisStatus
  onAnalyze: () => void
}) {
  if (status === "idle") return null

  if (status === "waiting" || status === "analyzing") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {status === "waiting"
          ? "Preparando el análisis del ejercicio…"
          : "Gemini está identificando preguntas y requisitos…"}
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <span>No se pudo completar el análisis previo. Puedes generar igualmente.</span>
        <Button type="button" variant="ghost" size="sm" onClick={onAnalyze}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="font-medium">
          {EXERCISE_TYPE_LABELS[analysis.type]}
          {analysis.title ? ` · ${analysis.title}` : ""}
        </span>
        <span className="text-emerald-800 dark:text-emerald-200">
          {analysis.questions.length > 0
            ? ` · ${analysis.questions.length} apartado${analysis.questions.length === 1 ? "" : "s"} detectado${analysis.questions.length === 1 ? "" : "s"}`
            : " · estructura identificada"}
        </span>
      </div>
    </div>
  )
}

function AnalysisEditor({
  analysis,
  status,
  onChange,
  onAnalyze,
}: {
  analysis: ExerciseAnalysis
  status: ExerciseAnalysisStatus
  onChange: (analysis: ExerciseAnalysis) => void
  onAnalyze: () => void
}) {
  const updateQuestion = (
    index: number,
    patch: Partial<ExerciseAnalysis["questions"][number]>
  ) => {
    onChange({
      ...analysis,
      questions: analysis.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      ),
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Lectura inteligente del ejercicio
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Revisa o corrige la interpretación antes de redactar.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAnalyze}
          disabled={status === "analyzing" || status === "waiting"}
        >
          {status === "analyzing" || status === "waiting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Analizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="exercise-type">Tipo de ejercicio</Label>
          <select
            id="exercise-type"
            value={analysis.type}
            onChange={(event) =>
              onChange({
                ...analysis,
                type: event.target.value as ExerciseType,
              })
            }
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {Object.entries(EXERCISE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exercise-title">Título detectado</Label>
          <Input
            id="exercise-title"
            value={analysis.title}
            onChange={(event) =>
              onChange({ ...analysis, title: event.target.value })
            }
            placeholder="Sin título"
          />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <Label htmlFor="exercise-summary">Qué pide exactamente</Label>
        <Textarea
          id="exercise-summary"
          value={analysis.summary}
          onChange={(event) =>
            onChange({ ...analysis, summary: event.target.value })
          }
          placeholder="Resumen de la tarea, enfoque y criterios importantes."
          className="min-h-20"
        />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Preguntas o apartados</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...analysis,
                questions: [
                  ...analysis.questions,
                  {
                    label: String(analysis.questions.length + 1),
                    instruction: "",
                  },
                ],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Añadir
          </Button>
        </div>
        {analysis.questions.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
            No hay apartados separados. Gemini responderá al ejercicio como una unidad.
          </p>
        ) : (
          analysis.questions.map((question, index) => (
            <div
              key={`${index}-${question.label}`}
              className="grid grid-cols-[74px_minmax(0,1fr)_32px] gap-2"
            >
              <Input
                value={question.label}
                onChange={(event) =>
                  updateQuestion(index, { label: event.target.value })
                }
                aria-label={`Etiqueta del apartado ${index + 1}`}
              />
              <Input
                value={question.instruction}
                onChange={(event) =>
                  updateQuestion(index, { instruction: event.target.value })
                }
                aria-label={`Instrucción del apartado ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  onChange({
                    ...analysis,
                    questions: analysis.questions.filter(
                      (_, questionIndex) => questionIndex !== index
                    ),
                  })
                }
                aria-label={`Eliminar apartado ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <Label htmlFor="exercise-requirements">Requisitos detectados</Label>
        <Textarea
          id="exercise-requirements"
          value={analysis.requirements.join("\n")}
          onChange={(event) =>
            onChange({
              ...analysis,
              requirements: event.target.value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
          placeholder={"Un requisito por línea\nExtensión, citas, estructura, autores…"}
          className="min-h-20"
        />
      </div>
    </section>
  )
}

export function DocumentStarter({
  prompt,
  onPromptChange,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  onAttachmentRoleChange,
  onGenerate,
  onStartBlank,
  onStartTemplate,
  isGenerating,
  canGenerate,
  errorMessage,
  workspaceMode,
  onWorkspaceModeChange,
  analysis,
  analysisStatus,
  onAnalysisChange,
  onAnalyze,
  geminiConfigured,
  onConfigureGemini,
  modelLabel,
  recentDocuments,
  onOpenRecent,
  onRemoveRecent,
  onBrowseDocuments,
}: DocumentStarterProps) {
  const isProfessional = workspaceMode === "professional"

  const coreForm = (
    <div className="space-y-4">
      {!geminiConfigured && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-left text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                El proveedor de IA todavía no está conectado
              </p>
              <p className="mt-0.5 text-sm opacity-80">
                Configura una API Key para crear y editar documentos con IA.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={onConfigureGemini}>
            Configurar IA
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="document-prompt">
          Describe el documento que necesitas{" "}
          <span className="font-normal text-muted-foreground">(opcional si adjuntas material)</span>
        </Label>
        <Textarea
          id="document-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Por ejemplo: crea una propuesta comercial clara a partir del PDF adjunto, mantén las cifras y añade una tabla de próximos pasos…"
          className="min-h-28 resize-y text-[15px] leading-relaxed"
          autoFocus
        />
      </div>

      <FileDropzone
        attachments={attachments}
        onFilesSelected={onFilesSelected}
        onRemove={onRemoveAttachment}
        onRoleChange={onAttachmentRoleChange}
        professional={isProfessional}
      />

      {ENABLE_EXERCISE_ANALYSIS && !isProfessional && (
        <AnalysisStatus
          analysis={analysis}
          status={analysisStatus}
          onAnalyze={onAnalyze}
        />
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-2">
        <Button
          size="lg"
          onClick={onGenerate}
          disabled={isGenerating || !canGenerate}
          className="h-12 w-full text-[15px] shadow-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" />
              Creando el documento…
            </>
          ) : (
            <>
              <Sparkles />
              {geminiConfigured
                ? "Crear con IA"
                : "Conectar un proveedor para generar"}
            </>
          )}
        </Button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{modelLabel}</span>
          <span aria-hidden="true">·</span>
          <span>una llamada estable</span>
          <span aria-hidden="true">·</span>
          <span>editable en Word y LibreOffice</span>
        </div>
      </div>
    </div>
  )

  const newDocumentGallery = (
    <section aria-labelledby="starter-new-heading">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3
          id="starter-new-heading"
          className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Nuevo
        </h3>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Estructura estable basada en estilos
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <button
          type="button"
          onClick={onStartBlank}
          disabled={isGenerating}
          className="group flex flex-col gap-2 rounded-lg text-left focus-visible:outline-none disabled:opacity-60"
        >
          <span className="block rounded-[4px] p-[3px] ring-1 ring-primary/40 transition group-hover:ring-2 group-hover:ring-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
            <PagePreview accent rows={[]} />
          </span>
          <span className="block px-0.5">
            <span className="block text-[13px] font-semibold leading-tight">
              Documento en blanco
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              Empieza a escribir
            </span>
          </span>
        </button>

        {DOCUMENT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onStartTemplate(template.id)}
            disabled={isGenerating}
            className="group flex flex-col gap-2 rounded-lg text-left focus-visible:outline-none disabled:opacity-60"
          >
            <span className="block rounded-[4px] p-[3px] ring-1 ring-border transition group-hover:ring-2 group-hover:ring-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
              <PagePreview rows={TEMPLATE_PREVIEWS[template.id]} />
            </span>
            <span className="block px-0.5">
              <span className="block text-[13px] font-semibold leading-tight">
                {template.name}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {template.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )

  const recentPanel = (
    <section
      aria-labelledby="starter-recent-heading"
      /* `min-w-0`: sin él, la regla `min-width: auto` de los elementos de
         rejilla deja que una ruta larga estire la columna y desborde. */
      className="flex min-h-full min-w-0 flex-col rounded-xl border border-border bg-card/80 p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3
          id="starter-recent-heading"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Clock className="h-4 w-4 text-primary" />
          Recientes
        </h3>
        {onBrowseDocuments && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBrowseDocuments}
            className="h-7 px-2 text-xs"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Abrir…
          </Button>
        )}
      </div>

      {recentDocuments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
          <FileText className="h-6 w-6 text-muted-foreground/70" />
          <p className="text-sm font-medium">Todavía no hay documentos</p>
          <p className="max-w-[34ch] text-xs text-muted-foreground">
            Los que abras o guardes aparecerán aquí para volver a ellos de un
            clic.
          </p>
          {onBrowseDocuments && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBrowseDocuments}
              className="mt-1"
            >
              <FolderOpen className="h-4 w-4" />
              Abrir un documento
            </Button>
          )}
        </div>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {recentDocuments.map((recent) => (
            <li key={recent.path} className="group relative">
              <button
                type="button"
                onClick={() => onOpenRecent(recent.path)}
                title={recent.path}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 pr-9 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {recent.title}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {recent.path}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {formatRecentDate(recent.lastOpenedAt)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveRecent(recent.path)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground opacity-0 transition hover:bg-background hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                aria-label={`Quitar ${recent.title} de recientes`}
                title="Quitar de recientes"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const assistantPanel = (
    <section
      aria-labelledby="starter-ai-heading"
      className="flex min-h-full min-w-0 flex-col rounded-xl border border-border bg-card/80 p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3
          id="starter-ai-heading"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Redactar con IA
        </h3>
        <div
          className="flex rounded-lg border border-border bg-muted/60 p-0.5"
          aria-label="Modo de trabajo"
        >
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("quick")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              workspaceMode === "quick"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Rápido
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceModeChange("professional")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition",
              workspaceMode === "professional"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Gauge className="h-3.5 w-3.5" />
            Profesional
          </button>
        </div>
      </div>
      {coreForm}
    </section>
  )

  return (
    <div className="mx-auto w-full max-w-6xl py-2 sm:py-4">
      <div className="mb-6">
        <h2 className="text-[26px] font-semibold leading-tight tracking-tight">
          Buen momento para escribir
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Abre lo último en lo que trabajabas, parte de una plantilla o describe
          lo que necesitas. La IA es opcional: el editor funciona entero sin
          conexión.
        </p>
      </div>

      <div className="space-y-6">
        {newDocumentGallery}

        {isProfessional ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
            {recentPanel}
            {assistantPanel}
            <ProfessionalControls disabled={isGenerating} />
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {recentPanel}
            {assistantPanel}
          </div>
        )}

        {ENABLE_EXERCISE_ANALYSIS && isProfessional && (
          <AnalysisEditor
            analysis={analysis}
            status={analysisStatus}
            onChange={onAnalysisChange}
            onAnalyze={onAnalyze}
          />
        )}
      </div>
    </div>
  )
}
