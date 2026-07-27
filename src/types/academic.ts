export type WorkspaceMode = "quick" | "professional"

export type ExerciseType =
  | "essay"
  | "text-analysis"
  | "structured-questions"
  | "other"

export type ExerciseAnalysisStatus =
  | "idle"
  | "waiting"
  | "analyzing"
  | "ready"
  | "error"

export interface DetectedQuestion {
  label: string
  instruction: string
}

export interface ExerciseAnalysis {
  type: ExerciseType
  title: string
  language: string
  summary: string
  questions: DetectedQuestion[]
  requirements: string[]
  requestedWordCount: number | null
  citationsRequired: boolean
  confidence: number
  warnings: string[]
}

export type AttachmentRole =
  | "auto"
  | "assignment"
  | "reference"
  | "rubric"
  | "example"
  | "bibliography"

export type AcademicAttachmentKind = "text" | "pdf" | "image"

export interface AcademicAttachment {
  id: string
  name: string
  size: number
  mimeType: string
  kind: AcademicAttachmentKind
  role: AttachmentRole
  status: "extracting" | "ready" | "error"
  text: string
  dataBase64?: string
  error?: string
}

export interface AiAttachmentInput {
  name: string
  mimeType: string
  kind: AcademicAttachmentKind
  role: AttachmentRole
  text?: string
  dataBase64?: string
}

export type ThinkingLevel = "minimal" | "low" | "medium" | "high"
export type SafetyPreset = "academic" | "standard" | "strict"
export type SourcePolicy = "material-knowledge" | "material-only" | "research"
export type ReviewPasses = 1 | 2

export interface ProfessionalGenerationSettings {
  model: string
  thinkingLevel: ThinkingLevel
  temperature: number
  topP: number
  lengthPreset: "auto" | "short" | "medium" | "long" | "very-long" | "custom"
  customWordCount: number
  reviewPasses: ReviewPasses
  safetyPreset: SafetyPreset
  sourcePolicy: SourcePolicy
  systemPrompt: string
}

export interface GenerationPreset {
  id: string
  name: string
  settings: ProfessionalGenerationSettings
  builtIn?: boolean
  createdAt: number
}

export type AiGenerationPhase =
  | "idle"
  | "reading"
  | "drafting"
  | "reviewing"
  | "complete"
  | "error"

export const DEFAULT_EXERCISE_ANALYSIS: ExerciseAnalysis = {
  type: "other",
  title: "",
  language: "es",
  summary: "",
  questions: [],
  requirements: [],
  requestedWordCount: null,
  citationsRequired: false,
  confidence: 0,
  warnings: [],
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  essay: "Ensayo",
  "text-analysis": "Análisis de texto",
  "structured-questions": "Preguntas estructuradas",
  other: "Otro ejercicio",
}

export const ATTACHMENT_ROLE_LABELS: Record<AttachmentRole, string> = {
  auto: "Detectar automáticamente",
  assignment: "Instrucciones o briefing",
  reference: "Documento de referencia",
  rubric: "Criterios o requisitos",
  example: "Ejemplo de resultado",
  bibliography: "Fuentes y datos",
}

export const GENERATION_PHASE_LABELS: Record<AiGenerationPhase, string> = {
  idle: "",
  reading: "Leyendo las instrucciones y materiales",
  drafting: "Creando el documento",
  reviewing: "Revisando contenido y estructura",
  complete: "Documento preparado",
  error: "No se pudo completar",
}

export function toAiAttachmentInput(
  attachment: AcademicAttachment
): AiAttachmentInput {
  return {
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    role: attachment.role,
    text: attachment.text || undefined,
    dataBase64: attachment.dataBase64,
  }
}
