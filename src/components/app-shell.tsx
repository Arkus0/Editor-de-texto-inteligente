"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { useEditor, type JSONContent } from "@tiptap/react"
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import { TableKit } from "@tiptap/extension-table"
import { TextStyleKit } from "@tiptap/extension-text-style"
import Highlight from "@tiptap/extension-highlight"
import Placeholder from "@tiptap/extension-placeholder"
import Superscript from "@tiptap/extension-superscript"
import Subscript from "@tiptap/extension-subscript"

import { TitleBar, type ExportFormat } from "@/components/chrome/title-bar"
import type { AppCommandId } from "@/components/chrome/command-search"
import { DocumentTabs, type DocumentTab } from "@/components/chrome/document-tabs"
import { StatusBar } from "@/components/chrome/status-bar"
import { EditorToolbar } from "@/components/canvas/editor-toolbar"
import { DocumentCanvas } from "@/components/canvas/document-canvas"
import { FindBar } from "@/components/canvas/find-bar"
import { AiSidePanel } from "@/components/canvas/ai-side-panel"
import { GeminiPanel } from "@/components/canvas/gemini-panel"
import type { DraftVariant } from "@/components/canvas/draft-comparison"
import type { DocumentToolsTab } from "@/components/tools/document-tools-sidebar"
import type { LayoutFocusSection } from "@/components/layout/layout-sidebar"
import { prepareAiAttachment } from "@/lib/file-extract"
import {
  friendlyGeminiErrorMessage,
  AVAILABLE_MODELS,
} from "@/lib/gemini"
import {
  friendlyOpenRouterErrorMessage,
  OPENROUTER_FREE_MODEL_ID,
  OPENROUTER_MODELS,
  resolveOpenRouterFreeModel,
} from "@/lib/openrouter"
import type { StableChatTurn } from "@/lib/gemini-stable"
import { DOCUMENT_ACTIONS, SELECTION_ACTIONS } from "@/lib/ai-actions"
import {
  DEFAULT_ASSISTANT_PROFILE,
  buildProfileOverlay,
  getAssistantProfile,
  resolveProfileProvider,
  type AssistantProfileId,
} from "@/lib/assistant-profiles"
import {
  buildEditorAssistantContext,
  parseEditorAssistantResponse,
  type EditorAssistantAction,
} from "@/lib/editor-assistant"
import {
  DEFAULT_AI_CONTEXT_OPTIONS,
  type AiContextOptions,
  type AiContextPreview,
} from "@/lib/ai-context"
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdown"
import { useStableCallback } from "@/lib/use-stable-callback"
import { buildDocumentAst } from "@/lib/export/document-ast"
import {
  DEFAULT_IMAGE_PROCESSING_OPTIONS,
  processImage,
} from "@/lib/image-processing"
import {
  applySelectedTableFormula,
  selectedTableRows,
  sortSelectedTable,
} from "@/lib/table-tools"
import { getTextBoxPreset } from "@/lib/text-box"
import { downloadBlob } from "@/lib/export/download"
import {
  useSettingsStore,
  type AiProvider,
} from "@/store/useSettingsStore"
import {
  QUICK_GENERATION_SETTINGS,
  useAcademicStore,
} from "@/store/useAcademicStore"
import { useHistoryStore, type HistoryEntry } from "@/store/useHistoryStore"
import { useRecentDocumentsStore } from "@/store/useRecentDocumentsStore"
import { useSystemPromptStore } from "@/store/useSystemPromptStore"
import type { GroundingSource, DocumentVersion } from "@/types/desktop"
import {
  DEFAULT_EXERCISE_ANALYSIS,
  type AcademicAttachment,
  type AiGenerationPhase,
  type AttachmentRole,
  type ExerciseAnalysis,
  type ExerciseAnalysisStatus,
} from "@/types/academic"
import { useCitationStore } from "@/store/useCitationStore"
import {
  createCitationSource,
  deduplicateCitationSources,
  formatBibliographyEntry,
  formatCitationClusterFallback,
  type CitationCluster,
  type CitationStyle,
  type DocumentBibliography,
} from "@/types/citation"
import {
  BibliographyNode,
  CaptionNode,
  CitationNode,
  CommentMark,
  CrossReferenceNode,
  DocumentShapeNode,
  DocumentStructure,
  EndnoteReferenceNode,
  EquationNode,
  FootnoteReferenceNode,
  NamedStyle,
  PageBreakNode,
  Pagination,
  SectionBreakNode,
  TabStopNode,
  TableOfContentsNode,
  TextBoxNode,
  TrackChanges,
  TrackedDeletionMark,
  TrackedInsertionMark,
} from "@/editor/extensions/document-features"
import { DocumentImage } from "@/editor/extensions/document-image"
import { PinnedSelection } from "@/editor/extensions/pinned-selection"
import { SearchHighlight } from "@/editor/extensions/search-highlight"
import { DocumentChart } from "@/editor/extensions/document-chart"
import {
  FormCheckbox,
  FormDropdown,
  FormTextField,
} from "@/editor/extensions/form-fields"
import { ProofingLanguageMark } from "@/editor/extensions/proofing-language"
import { AutoCorrectExtension } from "@/editor/extensions/autocorrect"
import { BookmarkMark } from "@/editor/extensions/bookmark"
import { normalizeImportedDocxHtml } from "@/lib/docx-import"
import { mergePastedFormatting } from "@/lib/paste-sanitize"
import {
  applyDocumentStyleTheme,
  type DocumentStyleThemeId,
} from "@/lib/document-themes"
import {
  getDocumentTemplate,
  type DocumentTemplateId,
} from "@/lib/document-templates"
import {
  createDefaultDocumentWorkspaceState,
  parseDocumentWorkspaceState,
  BUILT_IN_DOCUMENT_STYLES,
  type DocumentSection,
  type DocumentLayoutSettings,
  type DocumentStyleDefinition,
  type DocumentWorkspaceState,
  type SectionBreakType,
} from "@/types/document"

const SettingsDrawer = dynamic(
  () =>
    import("@/components/settings/settings-drawer").then(
      (module) => module.SettingsDrawer
    ),
  { ssr: false }
)
const FileBackstage = dynamic(
  () =>
    import("@/components/chrome/file-backstage").then(
      (module) => module.FileBackstage
    ),
  { ssr: false }
)
const HistorySidebar = dynamic(
  () =>
    import("@/components/history/history-sidebar").then(
      (module) => module.HistorySidebar
    ),
  { ssr: false }
)
const VersionSidebar = dynamic(
  () =>
    import("@/components/history/version-sidebar").then(
      (module) => module.VersionSidebar
    ),
  { ssr: false }
)
const DraftComparison = dynamic(
  () =>
    import("@/components/canvas/draft-comparison").then(
      (module) => module.DraftComparison
    ),
  { ssr: false }
)
const ImmersiveReader = dynamic(
  () =>
    import("@/components/canvas/immersive-reader").then(
      (module) => module.ImmersiveReader
    ),
  { ssr: false }
)
const CitationSidebar = dynamic(
  () =>
    import("@/components/references/citation-sidebar").then(
      (module) => module.CitationSidebar
    ),
  { ssr: false }
)
const FootnoteSidebar = dynamic(
  () =>
    import("@/components/references/footnote-sidebar").then(
      (module) => module.FootnoteSidebar
    ),
  { ssr: false }
)
const LayoutSidebar = dynamic(
  () =>
    import("@/components/layout/layout-sidebar").then(
      (module) => module.LayoutSidebar
    ),
  { ssr: false }
)
const ReviewSidebar = dynamic(
  () =>
    import("@/components/review/review-sidebar").then(
      (module) => module.ReviewSidebar
    ),
  { ssr: false }
)
const AccessibilitySidebar = dynamic(
  () =>
    import("@/components/review/accessibility-sidebar").then(
      (module) => module.AccessibilitySidebar
    ),
  { ssr: false }
)
const DocumentToolsSidebar = dynamic(
  () =>
    import("@/components/tools/document-tools-sidebar").then(
      (module) => module.DocumentToolsSidebar
    ),
  { ssr: false }
)

export type GenerationStatus = "idle" | "streaming" | "done" | "error"
export type EditorMode = "welcome" | "streaming" | "editing"
export type MessageKind = "chat" | "selection" | "document"

export type Attachment = AcademicAttachment

export interface ChatMessage {
  id: string
  role: "user" | "model"
  content: string
  kind?: MessageKind
  quotedFragment?: string
  quotedRange?: { from: number; to: number }
  status: "streaming" | "done" | "error"
  sources?: GroundingSource[]
  finishReason?: string
  editorActions?: EditorAssistantAction[]
  editorActionsApplied?: boolean
}

function slugifyFilename(name: string): string {
  const clean = name.trim().replace(/\.[^.]+$/, "") || "documento"
  return clean.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "documento"
}

function createLocalDocumentId() {
  return globalThis.crypto?.randomUUID?.() ?? `document-${Date.now()}-${Math.random()}`
}

function buildDraftLengthInstruction(
  preset: "auto" | "short" | "medium" | "long" | "very-long" | "custom",
  customWordCount: number
): string | undefined {
  switch (preset) {
    case "short":
      return "Extensión orientativa del borrador: entre 200 y 400 palabras, salvo que el enunciado exija otra cosa."
    case "medium":
      return "Extensión orientativa del borrador: entre 600 y 1.000 palabras, salvo que el enunciado exija otra cosa."
    case "long":
      return "Extensión orientativa del borrador: entre 1.500 y 3.000 palabras, salvo que el enunciado exija otra cosa."
    case "very-long":
      return "Extensión orientativa del borrador: entre 3.000 y 6.000 palabras, salvo que el enunciado exija otra cosa."
    case "custom":
      return `Extensión orientativa del borrador: aproximadamente ${customWordCount} palabras, salvo que el enunciado exija otra cosa.`
    default:
      return undefined
  }
}

export function AppShell() {
  const initialDocumentId = React.useRef(createLocalDocumentId())
  const initialWorkspaceRef = React.useRef<DocumentWorkspaceState | null>(null)
  if (!initialWorkspaceRef.current) {
    initialWorkspaceRef.current = createDefaultDocumentWorkspaceState()
  }
  const [prompt, setPrompt] = React.useState("")
  const [attachments, setAttachments] = React.useState<AcademicAttachment[]>([])
  const [exerciseAnalysis, setExerciseAnalysis] =
    React.useState<ExerciseAnalysis>(DEFAULT_EXERCISE_ANALYSIS)
  const [analysisStatus] =
    React.useState<ExerciseAnalysisStatus>("idle")
  const [generationPhase, setGenerationPhase] =
    React.useState<AiGenerationPhase>("idle")
  const [status, setStatus] = React.useState<GenerationStatus>("idle")
  const [mode, setMode] = React.useState<EditorMode>("welcome")
  const [responseText, setResponseText] = React.useState("")
  const [documentTextLength, setDocumentTextLength] = React.useState(0)
  const [findOpen, setFindOpen] = React.useState(false)
  const [findReplaceVisible, setFindReplaceVisible] = React.useState(false)
  const [formFillMode, setFormFillMode] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [docName, setDocName] = React.useState("Documento sin título")
  const [documentId, setDocumentId] = React.useState(initialDocumentId.current)
  const [documentPath, setDocumentPath] = React.useState<string | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)
  const [tabs, setTabs] = React.useState<DocumentTab[]>([
    {
      id: initialDocumentId.current,
      title: "Documento sin título",
      path: null,
      html: "",
      markdown: "",
      mode: "welcome",
      prompt: "",
      chatJson: "[]",
      documentJson: JSON.stringify(initialWorkspaceRef.current),
      dirty: false,
    },
  ])
  const [activeTabId, setActiveTabId] = React.useState(initialDocumentId.current)
  const [isExporting, setIsExporting] = React.useState(false)

  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [backstageOpen, setBackstageOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [versionsOpen, setVersionsOpen] = React.useState(false)
  const [draftComparisonOpen, setDraftComparisonOpen] = React.useState(false)
  const [immersiveReaderOpen, setImmersiveReaderOpen] = React.useState(false)
  const [draftVariant, setDraftVariant] = React.useState<DraftVariant | null>(null)
  const [referencesOpen, setReferencesOpen] = React.useState(false)
  const [footnotesOpen, setFootnotesOpen] = React.useState(false)
  const [layoutOpen, setLayoutOpen] = React.useState(false)
  const [layoutFocusSection, setLayoutFocusSection] =
    React.useState<LayoutFocusSection | undefined>(undefined)
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [reviewSelectionAvailable, setReviewSelectionAvailable] =
    React.useState(false)
  const [accessibilityOpen, setAccessibilityOpen] = React.useState(false)
  const [documentToolsOpen, setDocumentToolsOpen] = React.useState(false)
  const [documentToolsInitialTab, setDocumentToolsInitialTab] =
    React.useState<DocumentToolsTab>("navigate")
  const [focusMode, setFocusMode] = React.useState(false)
  const [documentState, setDocumentState] =
    React.useState<DocumentWorkspaceState>(initialWorkspaceRef.current)
  const [activeSectionId, setActiveSectionId] = React.useState(
    initialWorkspaceRef.current.sections[0].id
  )

  const [chatOpen, setChatOpen] = React.useState(false)
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([])
  const [pendingFragment, setPendingFragment] = React.useState<string | null>(null)
  const [pendingRange, setPendingRange] = React.useState<{ from: number; to: number } | null>(null)
  const [isChatSending, setIsChatSending] = React.useState(false)
  const [assistantProfileId, setAssistantProfileId] =
    React.useState<AssistantProfileId>(DEFAULT_ASSISTANT_PROFILE)
  const [profileProviderOverride, setProfileProviderOverride] = React.useState<
    Partial<Record<AssistantProfileId, AiProvider>>
  >({})

  const settings = useSettingsStore()
  const activeProvider = settings.provider
  const activeApiKey =
    activeProvider === "openrouter"
      ? settings.openRouterApiKey
      : settings.apiKey
  const activeModel =
    activeProvider === "openrouter"
      ? resolveOpenRouterFreeModel(
          settings.openRouterModel || OPENROUTER_FREE_MODEL_ID
        )
      : settings.model

  // --- Perfil activo del asistente y proveedor que le toca --------------------
  const assistantProfile = getAssistantProfile(assistantProfileId)
  const providerAvailability = React.useMemo(
    () => ({
      gemini: Boolean(settings.apiKey.trim()),
      openrouter: Boolean(settings.openRouterApiKey.trim()),
      global: settings.provider,
    }),
    [settings.apiKey, settings.openRouterApiKey, settings.provider]
  )
  const resolvedProfileProvider = resolveProfileProvider(
    assistantProfile,
    providerAvailability,
    profileProviderOverride[assistantProfileId]
  )
  const profileApiKey =
    resolvedProfileProvider.provider === "openrouter"
      ? settings.openRouterApiKey
      : settings.apiKey
  const profileModel =
    resolvedProfileProvider.provider === "openrouter"
      ? resolveOpenRouterFreeModel(
          settings.openRouterModel || OPENROUTER_FREE_MODEL_ID
        )
      : settings.model
  const profileModelLabel =
    [...AVAILABLE_MODELS, ...OPENROUTER_MODELS].find(
      (model) => model.id === profileModel
    )?.label ?? profileModel
  const workspaceMode = useAcademicStore((state) => state.mode)
  const setWorkspaceMode = useAcademicStore((state) => state.setMode)
  const professionalSettings = useAcademicStore(
    (state) => state.professionalSettings
  )
  const activeGenerationSettings =
    workspaceMode === "quick"
      ? {
          ...QUICK_GENERATION_SETTINGS,
          model: activeModel,
          temperature: settings.temperature,
          topP: settings.topP,
          systemPrompt: settings.systemPrompt,
          safetyPreset: settings.unrestrictedMode ? "academic" as const : "standard" as const,
        }
      : {
          ...professionalSettings,
          model: activeModel,
        }
  const addHistoryEntry = useHistoryStore((s) => s.add)
  const addRecentSystemPrompt = useSystemPromptStore((s) => s.addRecent)
  const recentDocuments = useRecentDocumentsStore((s) => s.entries)
  const recordRecentDocument = useRecentDocumentsStore((s) => s.record)
  const removeRecentDocument = useRecentDocumentsStore((s) => s.remove)
  const legacyBibliography = useCitationStore(
    (state) => state.documents[documentId]
  )

  const modelLabel =
    [...AVAILABLE_MODELS, ...OPENROUTER_MODELS].find(
      (model) => model.id === activeGenerationSettings.model
    )?.label ??
    activeGenerationSettings.model
  const friendlyAiErrorMessage = (error: unknown) =>
    activeProvider === "openrouter"
      ? friendlyOpenRouterErrorMessage(error)
      : friendlyGeminiErrorMessage(error)
  const activeSection = (
    documentState.sections.find((section) => section.id === activeSectionId) ??
    documentState.sections[0]
  ) as DocumentSection
  const documentLayout = activeSection?.layout ?? documentState.layout

  const markdownSyncTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const markdownSyncIdle = React.useRef<number | null>(null)
  const activeTabIdRef = React.useRef(activeTabId)
  const lastTextSelectionRef = React.useRef<{
    from: number
    to: number
  } | null>(null)
  const saveConflictPathRef = React.useRef<string | null>(null)
  const generationAbortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    activeTabIdRef.current = activeTabId
  }, [activeTabId])

  React.useEffect(
    () => () => {
      generationAbortRef.current?.abort()
    },
    []
  )

  React.useEffect(() => {
    if (!focusMode) return
    const exitFocusMode = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setFocusMode(false)
    }
    document.addEventListener("keydown", exitFocusMode)
    return () => document.removeEventListener("keydown", exitFocusMode)
  }, [focusMode])

  React.useEffect(() => {
    if (mode !== "editing") return
    let waitingForViewCommand = false
    let resetSequence = 0
    const onViewShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLocaleLowerCase()
      if (event.altKey && key === "w") {
        event.preventDefault()
        waitingForViewCommand = true
        window.clearTimeout(resetSequence)
        resetSequence = window.setTimeout(() => {
          waitingForViewCommand = false
        }, 1_500)
        return
      }
      if (waitingForViewCommand && key === "o") {
        event.preventDefault()
        waitingForViewCommand = false
        window.clearTimeout(resetSequence)
        setFocusMode((value) => !value)
        return
      }
      if (!["alt", "shift", "control", "meta"].includes(key)) {
        waitingForViewCommand = false
        window.clearTimeout(resetSequence)
      }
    }
    document.addEventListener("keydown", onViewShortcut)
    return () => {
      window.clearTimeout(resetSequence)
      document.removeEventListener("keydown", onViewShortcut)
    }
  }, [mode])

  React.useEffect(() => {
    const openFileBackstage = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLocaleLowerCase() !== "f") return
      event.preventDefault()
      setBackstageOpen(true)
    }
    document.addEventListener("keydown", openFileBackstage)
    return () => document.removeEventListener("keydown", openFileBackstage)
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    content: "",
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      DocumentImage.configure({ allowBase64: true }),
      ProofingLanguageMark,
      BookmarkMark,
      AutoCorrectExtension,
      TableKit.configure({
        table: { resizable: true, lastColumnResizable: true },
      }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Escribe aquí o pídele al asistente que redacte por ti…" }),
      // Se excluyen mutuamente: activar uno debe desactivar el otro, como en Word.
      Superscript.extend({ excludes: "subscript" }),
      Subscript.extend({ excludes: "superscript" }),
      NamedStyle,
      DocumentStructure,
      PageBreakNode,
      SectionBreakNode,
      TabStopNode,
      FootnoteReferenceNode,
      EndnoteReferenceNode,
      CitationNode,
      BibliographyNode,
      TableOfContentsNode,
      TextBoxNode,
      DocumentShapeNode,
      CaptionNode,
      CrossReferenceNode,
      EquationNode,
      CommentMark,
      TrackedInsertionMark,
      TrackedDeletionMark,
      TrackChanges,
      Pagination,
      SearchHighlight,
      PinnedSelection,
      FormCheckbox,
      FormTextField,
      FormDropdown,
      DocumentChart,
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-slate dark:prose-invert max-w-none font-serif text-[1.05rem] leading-[1.9] prose-p:my-4 prose-headings:font-sans focus:outline-none",
        lang: "es-ES",
        spellcheck: "true",
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html") ?? ""
        if (
          /urn:schemas-microsoft-com:office:(?:office|word)|\bmso-/i.test(
            html
          )
        ) {
          toast.info("Texto de Word pegado", {
            description:
              "El portapapeles de Word no incluye encabezados, pies ni numeración de páginas. Para conservarlos, abre el archivo DOCX desde la aplicación.",
          })
        }
        return false
      },
      // Por defecto, pegar fusiona el formato con el del documento actual
      // (como Word/Google Docs): descarta fuente/tamaño/color ajenos y
      // conserva negrita/cursiva/listas/enlaces. "Pegar solo texto"
      // (Ctrl+Mayús+V) sigue disponible para quitar todo el formato.
      transformPastedHTML: (html) => mergePastedFormatting(html),
    },
    onSelectionUpdate: ({ editor: selectedEditor }) => {
      const { from, to, empty } = selectedEditor.state.selection
      if (!empty) lastTextSelectionRef.current = { from, to }
    },
    onUpdate: ({ editor: updatedEditor }) => {
      setIsDirty(true)
      // Serializar el documento a HTML y Markdown cuesta ~117 ms en un
      // documento de 2.000 párrafos, casi todo en Turndown. Hacerlo tras cada
      // ráfaga de escritura congelaba la ventana justo al levantar las manos
      // del teclado, y el coste crecía con el tamaño del documento — la misma
      // queja que se le hace a Word. Ahora solo se recalcula cuando alguien
      // lee de verdad la serialización (IA, exportar, cambiar de pestaña,
      // guardar), con `getSerializedDocument`.
      //
      // Lo único que sigue siendo continuo es la longitud del texto, que la
      // interfaz necesita durante el render; cuesta ~4 ms y va en tiempo
      // ocioso.
      if (markdownSyncTimeout.current) clearTimeout(markdownSyncTimeout.current)
      if (markdownSyncIdle.current && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(markdownSyncIdle.current)
        markdownSyncIdle.current = null
      }
      markdownSyncTimeout.current = setTimeout(() => {
        const syncDocumentLength = () => {
          markdownSyncIdle.current = null
          const length = updatedEditor.getText().length
          setDocumentTextLength((current) =>
            current === length ? current : length
          )
        }
        if ("requestIdleCallback" in window) {
          markdownSyncIdle.current = window.requestIdleCallback(
            syncDocumentLength,
            { timeout: 900 }
          )
        } else {
          syncDocumentLength()
        }
      }, 450)
    },
  })

  /**
   * Caché de la serialización del documento. Los documentos de ProseMirror son
   * inmutables, así que la identidad del objeto `doc` basta como clave: si no
   * ha cambiado, el HTML y el Markdown anteriores siguen siendo exactos.
   */
  const serializedDocumentRef = React.useRef<{
    doc: unknown
    html: string
    markdown: string
  } | null>(null)

  const getSerializedDocument = React.useCallback(() => {
    if (!editor) return { html: "", markdown: "" }
    const doc = editor.state.doc
    const cached = serializedDocumentRef.current
    if (cached && cached.doc === doc) return cached
    const html = editor.getHTML()
    const markdown = htmlToMarkdown(html)
    const serialized = { doc, html, markdown }
    serializedDocumentRef.current = serialized
    return serialized
  }, [editor])

  /**
   * Modo rellenar. Word obliga a proteger el documento para poder usar sus
   * campos de formulario, y si olvidas quitar la protección el archivo se
   * queda bloqueado. Aquí es solo un modo de vista: el editor deja de aceptar
   * escritura, pero los campos siguen funcionando porque sus controles son DOM
   * propio dentro de `contentEditable=false`, no texto del documento.
   */
  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(!formFillMode)
    return () => {
      editor.setEditable(true)
    }
  }, [editor, formFillMode])

  /**
   * Abrir un archivo, cambiar de pestaña o aceptar un borrador reemplazan el
   * contenido sin pasar por `onUpdate`, así que la longitud se vuelve a medir
   * también cuando cambia el documento activo.
   */
  React.useEffect(() => {
    if (!editor) return
    const length = editor.getText().length
    setDocumentTextLength((current) => (current === length ? current : length))
  }, [activeTabId, documentId, editor, mode])

  React.useEffect(() => {
    lastTextSelectionRef.current = null
  }, [documentId])

  React.useEffect(
    () => () => {
      if (markdownSyncTimeout.current) {
        clearTimeout(markdownSyncTimeout.current)
      }
      if (markdownSyncIdle.current && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(markdownSyncIdle.current)
      }
    },
    []
  )

  React.useEffect(() => {
    const storedSettings = useSettingsStore.getState()
    const configuredKey =
      storedSettings.provider === "openrouter"
        ? storedSettings.openRouterApiKey
        : storedSettings.apiKey
    if (configuredKey.trim()) return
    setSettingsOpen(true)
    toast.info("Configura un proveedor para activar la asistencia de IA", {
      description:
        "Puedes usar Gemini o el enrutador gratuito de OpenRouter.",
    })
  }, [])

  React.useEffect(() => {
    if (!editor) return
    editor.commands.setTrackChangesEnabled(
      documentState.trackChanges.enabled,
      documentState.trackChanges.author
    )
  }, [
    documentState.trackChanges.author,
    documentState.trackChanges.enabled,
    editor,
  ])

  React.useEffect(() => {
    if (!editor) return
    editor.view.dom.setAttribute("lang", documentState.proofingLanguage)
    editor.view.dom.setAttribute("spellcheck", "true")
  }, [documentState.proofingLanguage, editor])

  React.useEffect(() => {
    if (!editor) return
    editor.commands.setAutoCorrectSettings(documentState.autocorrect)
  }, [documentState.autocorrect, editor])

  React.useEffect(() => {
    if (
      !legacyBibliography ||
      legacyBibliography.sources.length === 0 ||
      documentState.bibliography.sources.length > 0
    ) {
      return
    }
    setDocumentState((current) => ({
      ...current,
      bibliography: legacyBibliography,
    }))
    setIsDirty(true)
    toast.info("Referencias actualizadas a la biblioteca del documento", {
      description:
        "Las fuentes creadas con la v0.3 ya se guardarán dentro de este archivo.",
    })
  }, [documentState.bibliography.sources.length, legacyBibliography])

  React.useEffect(() => {
    if (!editor) return
    // Con una sola sección (el caso normal: sin saltos de sección) no hay
    // nada que localizar recorriendo el documento en cada tecla.
    if (documentState.sections.length <= 1) {
      const onlySectionId = documentState.sections[0]?.id
      if (onlySectionId) setActiveSectionId(onlySectionId)
      return
    }
    let frame = 0
    const updateActiveSection = () => {
      let sectionId = documentState.sections[0]?.id
      const selectionPosition = editor.state.selection.from
      editor.state.doc.forEach((node, offset) => {
        if (
          node.type.name === "sectionBreak" &&
          offset < selectionPosition &&
          node.attrs.sectionId
        ) {
          sectionId = String(node.attrs.sectionId)
        }
      })
      if (sectionId) setActiveSectionId(sectionId)
    }
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateActiveSection)
    }
    updateActiveSection()
    editor.on("selectionUpdate", scheduleUpdate)
    editor.on("update", scheduleUpdate)
    return () => {
      cancelAnimationFrame(frame)
      editor.off("selectionUpdate", scheduleUpdate)
      editor.off("update", scheduleUpdate)
    }
  }, [documentState.sections, editor])

  // Atajo de teclado: Ctrl/⌘ + J alterna el panel de Gemini.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setChatOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  /**
   * Atajos de búsqueda, con las mismas teclas que Word: `Ctrl+F` para buscar,
   * `Ctrl+H` para reemplazar y `F3` para ir a la siguiente coincidencia. El
   * navegador tiene su propio `Ctrl+F`, inútil aquí porque solo ve el trozo de
   * documento que hay pintado en pantalla, así que se intercepta.
   */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLowerCase() === "f") {
        event.preventDefault()
        setFindReplaceVisible(false)
        setFindOpen(true)
        return
      }
      if (modifier && event.key.toLowerCase() === "h") {
        event.preventDefault()
        setFindReplaceVisible(true)
        setFindOpen(true)
        return
      }
      if (event.key === "F3") {
        event.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Confirmación explícita antes de cerrar si hay cambios sin guardar, en
  // vez de perderlos en silencio (queja habitual: Word ya no siempre
  // pregunta al cerrar si guarda en la nube). Funciona igual en el
  // navegador y en la ventana de Electron (Chromium respeta beforeunload).
  React.useEffect(() => {
    const hasUnsavedChanges = isDirty || tabs.some((tab) => tab.dirty)
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty, tabs])

  const hasReadyAttachment = attachments.some((a) => a.status === "ready")

  const handleFilesSelected = (files: File[]) => {
    const pending: AcademicAttachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      kind:
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|webp)$/i.test(file.name)
          ? "image"
          : file.type === "application/pdf" || /\.pdf$/i.test(file.name)
            ? "pdf"
            : "text",
      role: "auto",
      status: "extracting",
      text: "",
    }))
    setAttachments((prev) => [...prev, ...pending])

    files.forEach((file, index) => {
      const attachmentId = pending[index].id
      prepareAiAttachment(file)
        .then((prepared) => {
          setAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === attachmentId
                ? {
                    ...attachment,
                    ...prepared,
                    status: "ready",
                    error: undefined,
                  }
                : attachment
            )
          )
        })
        .catch((error: Error) => {
          setAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === attachmentId
                ? {
                    ...attachment,
                    status: "error",
                    error: error.message,
                  }
                : attachment
            )
          )
          toast.error(`No se pudo procesar "${file.name}"`, { description: error.message })
        })
    })
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleAttachmentRoleChange = (id: string, role: AttachmentRole) => {
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === id ? { ...attachment, role } : attachment
      )
    )
  }

  const resetChat = () => {
    setChatMessages([])
    setPendingFragment(null)
    setPendingRange(null)
  }

  const requireApiKey = () => {
    if (!activeApiKey.trim()) {
      toast.error(
        activeProvider === "openrouter"
          ? "Falta la API Key de OpenRouter"
          : "Falta la API Key de Google AI Studio",
        { description: "Configúrala en los ajustes de IA." }
      )
      setSettingsOpen(true)
      return false
    }
    return true
  }

  /** El asistente puede correr en un proveedor distinto al global según el perfil. */
  const requireProfileApiKey = () => {
    if (!profileApiKey.trim()) {
      toast.error(
        resolvedProfileProvider.provider === "openrouter"
          ? "Falta la API Key de OpenRouter"
          : "Falta la API Key de Google AI Studio",
        { description: "Configúrala en los ajustes de IA." }
      )
      setSettingsOpen(true)
      return false
    }
    return true
  }

  /**
   * Esqueleto del documento para el perfil Diseñar: le interesa la estructura,
   * no la prosa, y así el catálogo de acciones cabe sin inflar la petición.
   */
  const getDocumentOutline = React.useCallback(() => {
    if (!editor) return ""
    const lines: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading") {
        const level = Number(node.attrs?.level ?? 1)
        lines.push(`${"#".repeat(level)} ${node.textContent.trim()}`)
        return false
      }
      return true
    })
    return lines.length
      ? lines.join("\n")
      : "(el documento no tiene títulos todavía)"
  }, [editor])

  const handleGenerate = async () => {
    if (!requireApiKey()) return
    if (!prompt.trim() && !hasReadyAttachment) return

    setStatus("streaming")
    setMode("streaming")
    setGenerationPhase("drafting")
    setResponseText("")
    setErrorMessage(null)
    resetChat()
    const abortController = new AbortController()
    generationAbortRef.current = abortController
    const contextText = attachments
      .filter((attachment) => attachment.status === "ready" && attachment.text.trim())
      .map((attachment) => `[Archivo: ${attachment.name}]\n${attachment.text}`)
      .join("\n\n---\n\n")

    try {
      const { generateStableAnswerStream } = await import("@/lib/gemini-stable")
      const finalText = await generateStableAnswerStream(
        {
          provider: activeProvider,
          apiKey: activeApiKey,
          model: activeGenerationSettings.model,
          systemPrompt: activeGenerationSettings.systemPrompt,
          thinkingLevel: activeGenerationSettings.thinkingLevel,
          temperature: activeGenerationSettings.temperature,
          topP: activeGenerationSettings.topP,
          unrestrictedMode:
            activeGenerationSettings.safetyPreset === "academic",
          prompt,
          contextText,
          lengthInstruction: buildDraftLengthInstruction(
            activeGenerationSettings.lengthPreset,
            activeGenerationSettings.customWordCount
          ),
        },
        (accumulated) => setResponseText(accumulated),
        abortController.signal
      )
      if (abortController.signal.aborted) {
        throw new DOMException("Operación cancelada", "AbortError")
      }

      if (!finalText.trim()) {
        throw new Error("El modelo no devolvió contenido. Inténtalo de nuevo.")
      }

      setResponseText(finalText)
      setGenerationPhase("complete")
      setStatus("done")
      setMode("editing")
      setIsDirty(true)
      editor?.commands.setContent(markdownToHtml(finalText), { emitUpdate: false })
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTabId
              ? {
                  ...tab,
                  title: docName,
                  html: markdownToHtml(finalText),
                markdown: finalText,
                mode: "editing",
                prompt,
                dirty: true,
              }
            : tab
        )
      )
      addHistoryEntry({
        title: "",
        prompt,
        attachmentNames: attachments.map((a) => a.name),
        response: finalText,
        model: activeGenerationSettings.model,
      })
      addRecentSystemPrompt(activeGenerationSettings.systemPrompt)
    } catch (error) {
      if (abortController.signal.aborted) {
        setGenerationPhase("idle")
      } else {
        setGenerationPhase("error")
        setStatus("error")
        setMode("welcome")
        setErrorMessage(
          friendlyAiErrorMessage(error)
        )
        toast.error("Error al generar la respuesta")
      }
    } finally {
      generationAbortRef.current = null
    }
  }

  const handleStartBlank = () => {
    setStatus("idle")
    setGenerationPhase("idle")
    setErrorMessage(null)
    setMode("editing")
    editor?.commands.setContent("", { emitUpdate: false })
    setResponseText("")
    setIsDirty(true)
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, html: "", markdown: "", mode: "editing", dirty: true }
          : tab
      )
    )
    requestAnimationFrame(() => editor?.commands.focus("start"))
  }

  const handleStartTemplate = (templateId: DocumentTemplateId) => {
    const template = getDocumentTemplate(templateId)
    if (!template) return
    const html = template.html.trim()
    const markdown = htmlToMarkdown(html)
    setStatus("idle")
    setGenerationPhase("idle")
    setErrorMessage(null)
    setMode("editing")
    setDocName(template.title)
    editor?.commands.setContent(html, { emitUpdate: false })
    setResponseText(markdown)
    setIsDirty(true)
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              title: template.title,
              html,
              markdown,
              mode: "editing",
              dirty: true,
            }
          : tab
      )
    )
    requestAnimationFrame(() => editor?.commands.focus("start"))
    toast.success(`${template.name} preparado`, {
      description:
        "La estructura usa estilos reales: puedes reorganizarla sin romper el formato.",
    })
  }

  const handleLoadHistoryEntry = (entry: HistoryEntry) => {
    snapshotActiveTab()
    const nextDocumentId = createLocalDocumentId()
    const nextDocumentState = createDefaultDocumentWorkspaceState()
    setPrompt(entry.prompt)
    setResponseText(entry.response)
    setStatus("done")
    setMode("editing")
    setErrorMessage(null)
    setAttachments([])
    resetChat()
    setHistoryOpen(false)
    setDocName(entry.title?.trim() || "Documento sin título")
    setDocumentId(nextDocumentId)
    setDocumentPath(null)
    setActiveTabId(nextDocumentId)
    setIsDirty(true)
    setDocumentState(nextDocumentState)
    setActiveSectionId(nextDocumentState.sections[0].id)
    editor?.commands.setContent(markdownToHtml(entry.response), { emitUpdate: false })
    setTabs((currentTabs) => [
      ...currentTabs,
      {
        id: nextDocumentId,
        title: entry.title?.trim() || "Documento sin título",
        path: null,
        html: markdownToHtml(entry.response),
        markdown: entry.response,
        mode: "editing",
        prompt: entry.prompt,
        chatJson: "[]",
        documentJson: JSON.stringify(nextDocumentState),
        dirty: true,
      },
    ])
  }

  const openPanelWithFragment = (fragment: string, range: { from: number; to: number }) => {
    setPendingFragment(fragment)
    setPendingRange(range)
    setChatOpen(true)
  }

  // Mantiene marcado en el documento el fragmento que el asistente tiene fijado,
  // aunque el foco esté en el panel y la selección nativa haya desaparecido.
  React.useEffect(() => {
    if (!editor) return
    editor.commands.setPinnedSelection(
      pendingFragment && pendingRange ? pendingRange : null
    )
  }, [editor, pendingFragment, pendingRange])

  const handleSelectFragment = (fragment: string, range: { from: number; to: number }) => {
    openPanelWithFragment(fragment, range)
  }

  // Núcleo común: añade el turno de usuario + placeholder del modelo y transmite la respuesta.
  const streamChatTurn = async (
    userMessage: string,
    quotedFragment: string | undefined,
    range: { from: number; to: number } | undefined,
    kind: MessageKind,
    options: { directApply: boolean; context?: AiContextOptions } = {
      directApply: false,
      context: DEFAULT_AI_CONTEXT_OPTIONS,
    }
  ) => {
    if (!requireProfileApiKey()) return
    const contextOptions = options.context ?? DEFAULT_AI_CONTEXT_OPTIONS
    const profile = assistantProfile
    const resolvedProvider = resolvedProfileProvider

    const history: StableChatTurn[] = contextOptions.includeHistory
      ? chatMessages
          .filter((m) => m.status === "done")
          .map((m) => ({ role: m.role, content: m.content }))
      : []

    const referenceContext = contextOptions.includeAttachments
      ? attachments
          .filter((a) => a.status === "ready" && a.text.trim())
          .map((a) => `[Documento: ${a.name}]\n${a.text}`)
          .join("\n\n---\n\n")
      : ""
    const assistantContext = contextOptions.includeEditorState
      ? buildEditorAssistantContext(
          editor?.getJSON(),
          documentState,
          Boolean(range || (editor && !editor.state.selection.empty)),
          editor?.isActive("image")
            ? "image"
            : editor?.isActive("table")
              ? "table"
              : editor?.isActive("textBox")
                ? "textBox"
              : range || (editor && !editor.state.selection.empty)
                ? "text"
                : "none",
          {
            detail: profile.editorContext,
            proactive: profile.id === "design",
          }
        )
      : ""
    const userChatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      kind,
      quotedFragment,
      quotedRange: range,
      status: "done",
    }
    const modelMessageId = crypto.randomUUID()
    setChatMessages((prev) => [
      ...prev,
      userChatMessage,
      { id: modelMessageId, role: "model", content: "", kind, quotedFragment, quotedRange: range, status: "streaming" },
    ])
    setIsChatSending(true)
    const abortController = new AbortController()
    generationAbortRef.current = abortController

    try {
      const chatParams = {
        provider: resolvedProvider.provider,
        apiKey: profileApiKey,
        model: profileModel,
        systemPrompt: [
          activeGenerationSettings.systemPrompt,
          buildProfileOverlay(profile, resolvedProvider),
          assistantContext,
        ]
          .filter(Boolean)
          .join("\n\n"),
        thinkingLevel: activeGenerationSettings.thinkingLevel,
        temperature: activeGenerationSettings.temperature,
        topP: activeGenerationSettings.topP,
        unrestrictedMode:
          activeGenerationSettings.safetyPreset === "academic",
        documentText: contextOptions.includeDocument
          ? profile.documentScope === "outline"
            ? getDocumentOutline()
            : getSerializedDocument().markdown
          : "",
        history,
        userMessage,
        quotedFragment,
        attachmentsContext: referenceContext || undefined,
        editTarget:
          kind === "selection"
            ? ("selection" as const)
            : kind === "document"
              ? ("document" as const)
              : ("chat" as const),
      }
      const onStreamChunk = (accumulated: string) => {
        const parsed = parseEditorAssistantResponse(accumulated)
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === modelMessageId ? { ...m, content: parsed.content } : m
          )
        )
      }

      // Investigar con Gemini usa el módulo con búsqueda web, que vive aparte
      // para no rozar el flujo protegido de borradores.
      let finalText: string
      let groundingSources: GroundingSource[] = []
      if (resolvedProvider.grounding) {
        const { researchChatStream } = await import("@/lib/assistant-research")
        const result = await researchChatStream(
          chatParams,
          onStreamChunk,
          abortController.signal
        )
        finalText = result.text
        groundingSources = result.sources
      } else {
        const { chatStableStream } = await import("@/lib/gemini-stable")
        finalText = await chatStableStream(
          chatParams,
          onStreamChunk,
          abortController.signal
        )
      }
      const parsedResponse = parseEditorAssistantResponse(finalText)
      const visibleContent =
        parsedResponse.content ||
        (parsedResponse.actions.length > 0
          ? `${parsedResponse.actions.length === 1 ? "Acción preparada" : "Acciones preparadas"} para revisar.`
          : finalText)
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                content: visibleContent,
                status: "done",
                sources: groundingSources,
                finishReason: undefined,
                editorActions: parsedResponse.actions,
              }
            : m
        )
      )
      if (options.directApply) {
        if (parsedResponse.actions.length > 0) {
          await handleApplyEditorActions(parsedResponse.actions, range)
        } else if (finalText.trim()) {
          if (kind === "selection" && quotedFragment) {
            handleApplyEdit(quotedFragment, finalText, range)
          } else if (kind === "document") {
            handleReplaceAll(finalText)
          }
        }
      }
    } catch (error) {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                content:
                  resolvedProvider.provider === "openrouter"
                    ? friendlyOpenRouterErrorMessage(error)
                    : friendlyGeminiErrorMessage(error),
                status: "error",
              }
            : m
        )
      )
      toast.error("Error en la conversación con el asistente")
    } finally {
      setIsChatSending(false)
      generationAbortRef.current = null
    }
  }

  /**
   * Envío desde el panel. El fragmento NO se suelta al enviar: así un "ahora más
   * corto" sigue apuntando al mismo sitio. Se suelta a mano o al seleccionar otro.
   */
  const handleSendChatMessage = (
    userMessage: string,
    quotedFragment: string | undefined,
    kind: MessageKind,
    options: { directApply: boolean; context: AiContextOptions }
  ) => {
    const range = quotedFragment ? pendingRange ?? undefined : undefined
    void streamChatTurn(userMessage, quotedFragment, range, kind, options)
  }

  // Acción rápida desde la burbuja de selección: cita el fragmento con su rango y dispara la instrucción.
  const handleFragmentAction = (
    fragment: string,
    range: { from: number; to: number },
    instruction: string
  ) => {
    setChatOpen(true)
    void streamChatTurn(instruction, fragment, range, "selection")
  }

  // Acciones IA desde la cinta (ribbon).
  const handleRibbonAiAction = (actionId: string) => {
    setChatOpen(true)
    if (actionId === "rewrite") {
      if (!editor) return
      const { from, to, empty } = editor.state.selection
      if (empty) {
        toast.info("Selecciona primero el texto que quieres reescribir")
        return
      }
      const text = editor.state.doc.textBetween(from, to, " ").trim()
      if (!text) return
      const instruction = SELECTION_ACTIONS.find((a) => a.id === "rewrite")!.instruction()
      void streamChatTurn(instruction, text, { from, to }, "selection")
      return
    }
    const docAction = DOCUMENT_ACTIONS.find((a) => a.id === actionId)
    if (docAction) {
      void streamChatTurn(docAction.instruction(), undefined, undefined, "document")
    }
  }

  const createRecoveryCheckpoint = (reason: string) => {
    if (!editor || !window.editorDesktop) return
    void window.editorDesktop.documents.saveRecovery({
      documentId,
      path: documentPath,
      title: docName,
      html: editor.getHTML(),
      markdown: htmlToMarkdown(editor.getHTML()),
      chatJson: JSON.stringify(chatMessages),
      documentJson: JSON.stringify(documentState),
      createVersion: true,
      versionReason: reason,
    })
  }

  const handleApplyEdit = (
    quotedFragment: string,
    replacement: string,
    quotedRange?: { from: number; to: number }
  ) => {
    if (!editor) return
    createRecoveryCheckpoint("Antes de aplicar un cambio de IA")
    const replacementHtml = markdownToHtml(replacement.trim())

    const docSize = editor.state.doc.content.size
    if (
      quotedRange &&
      quotedRange.to <= docSize &&
      editor.state.doc.textBetween(quotedRange.from, quotedRange.to, " ") === quotedFragment
    ) {
      editor.chain().focus().insertContentAt(quotedRange, replacementHtml).run()
      setIsDirty(true)
      toast.success("Fragmento actualizado en el documento")
      return
    }

    if (quotedRange) {
      toast.error("El fragmento cambió desde que la IA preparó la propuesta", {
        description: "Vuelve a seleccionarlo para evitar aplicar el cambio en un lugar incorrecto.",
      })
      return
    }

    const matches: Array<{ from: number; to: number }> = []
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return true
      const idx = node.text.indexOf(quotedFragment)
      if (idx !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + quotedFragment.length })
      }
      return true
    })

    if (matches.length === 1) {
      editor.chain().focus().insertContentAt(matches[0], replacementHtml).run()
      setIsDirty(true)
      toast.success("Fragmento actualizado en el documento")
    } else {
      toast.error("No se puede aplicar la propuesta de forma inequívoca", {
        description:
          matches.length > 1
            ? "El mismo texto aparece varias veces. Selecciona el fragmento exacto."
            : "El texto pudo cambiar desde que lo seleccionaste.",
      })
    }
  }

  const handleInsert = (text: string) => {
    if (!editor) return
    createRecoveryCheckpoint("Antes de insertar contenido de IA")
    const html = markdownToHtml(text.trim())
    editor.chain().focus().insertContentAt(editor.state.doc.content.size, html).run()
    setIsDirty(true)
    toast.success("Insertado en el documento")
  }

  const handleReplaceAll = (text: string) => {
    if (!editor) return
    createRecoveryCheckpoint("Antes de reemplazar el documento con IA")
    editor.commands.setContent(markdownToHtml(text.trim()))
    editor.commands.focus("start")
    setIsDirty(true)
    toast.success("Documento reemplazado")
  }

  const handleReplaceDocumentContent = (
    content: JSONContent,
    checkpointLabel: string
  ) => {
    if (!editor) return
    createRecoveryCheckpoint(checkpointLabel)
    editor.commands.setContent(content)
    editor.commands.focus("start")
    setIsDirty(true)
    toast.success("Cambios combinados en el documento")
  }

  const handleApplyEditorActions = async (
    actions: EditorAssistantAction[],
    quotedRange?: { from: number; to: number }
  ) => {
    if (!editor || actions.length === 0) return
    if (actions.some((action) => action.type !== "openPanel")) {
      createRecoveryCheckpoint("Antes de ejecutar acciones de IA")
    }
    let applied = 0
    let skipped = 0
    let documentChanged = false

    for (const action of actions) {
      if (action.type === "formatSelection") {
        const currentSelection = editor.state.selection
        const targetRange =
          quotedRange ??
          (!currentSelection.empty
            ? { from: currentSelection.from, to: currentSelection.to }
            : null)
        if (
          !targetRange ||
          targetRange.from < 0 ||
          targetRange.to > editor.state.doc.content.size ||
          targetRange.from >= targetRange.to
        ) {
          skipped += 1
          continue
        }

        editor.commands.setTextSelection(targetRange)
        if (action.clearFormatting) {
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
        const style = action.styleId
          ? documentState.styles.find((candidate) => candidate.id === action.styleId)
          : undefined
        const styleHeadingMatch = action.styleId?.match(/^Heading([1-6])$/)
        const headingLevel =
          action.headingLevel ??
          (styleHeadingMatch
            ? (Number(styleHeadingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6)
            : undefined)

        if (headingLevel === 0) {
          editor.chain().focus().setParagraph().run()
        } else if (headingLevel) {
          editor.chain().focus().setHeading({ level: headingLevel }).run()
        } else if (action.styleId) {
          editor.chain().focus().setParagraph().run()
        }
        if (action.styleId) {
          const nodeType = headingLevel && headingLevel > 0 ? "heading" : "paragraph"
          editor
            .chain()
            .focus()
            .updateAttributes(nodeType, {
              styleId: action.styleId,
              styleName: style?.name ?? action.styleId,
            })
            .run()
        }
        if (action.bold !== undefined) {
          const chain = editor.chain().focus()
          if (action.bold) chain.setBold().run()
          else chain.unsetBold().run()
        }
        if (action.italic !== undefined) {
          const chain = editor.chain().focus()
          if (action.italic) chain.setItalic().run()
          else chain.unsetItalic().run()
        }
        if (action.underline !== undefined) {
          const chain = editor.chain().focus()
          if (action.underline) chain.setUnderline().run()
          else chain.unsetUnderline().run()
        }
        if (action.strike !== undefined) {
          const chain = editor.chain().focus()
          if (action.strike) chain.setStrike().run()
          else chain.unsetStrike().run()
        }
        if (action.superscript !== undefined) {
          const chain = editor.chain().focus()
          if (action.superscript) chain.setSuperscript().run()
          else chain.unsetSuperscript().run()
        }
        if (action.subscript !== undefined) {
          const chain = editor.chain().focus()
          if (action.subscript) chain.setSubscript().run()
          else chain.unsetSubscript().run()
        }
        if (action.fontFamily) {
          editor.chain().focus().setFontFamily(action.fontFamily).run()
        }
        if (action.fontSize) {
          editor.chain().focus().setFontSize(`${action.fontSize}pt`).run()
        }
        if (action.textColor) {
          editor.chain().focus().setColor(action.textColor).run()
        }
        if (action.highlightColor) {
          editor
            .chain()
            .focus()
            .setHighlight({ color: action.highlightColor })
            .run()
        }
        if (action.listType === "bullet" && !editor.isActive("bulletList")) {
          editor.chain().focus().toggleBulletList().run()
        }
        if (action.listType === "ordered" && !editor.isActive("orderedList")) {
          editor.chain().focus().toggleOrderedList().run()
        }
        if (action.textAlign) {
          editor.chain().focus().setTextAlign(action.textAlign).run()
        }
        if (action.lineHeight) {
          editor.chain().focus().setLineHeight(action.lineHeight).run()
        }
        applied += 1
        documentChanged = true
        continue
      }

      if (action.type === "formatParagraph") {
        if (quotedRange) {
          if (
            quotedRange.from < 0 ||
            quotedRange.to > editor.state.doc.content.size ||
            quotedRange.from >= quotedRange.to
          ) {
            skipped += 1
            continue
          }
          editor.commands.setTextSelection(quotedRange)
        }
        const changed = editor
          .chain()
          .focus()
          .setParagraphFormat({
            ...(action.leftIndent !== undefined
              ? { leftIndent: action.leftIndent }
              : {}),
            ...(action.rightIndent !== undefined
              ? { rightIndent: action.rightIndent }
              : {}),
            ...(action.firstLineIndent !== undefined
              ? { firstLineIndent: action.firstLineIndent }
              : {}),
            ...(action.spacingBefore !== undefined
              ? { spacingBefore: action.spacingBefore }
              : {}),
            ...(action.spacingAfter !== undefined
              ? { spacingAfter: action.spacingAfter }
              : {}),
            ...(action.keepWithNext !== undefined
              ? { keepWithNext: action.keepWithNext }
              : {}),
            ...(action.keepLinesTogether !== undefined
              ? { keepLinesTogether: action.keepLinesTogether }
              : {}),
            ...(action.widowOrphanControl !== undefined
              ? { widowOrphanControl: action.widowOrphanControl }
              : {}),
            ...(action.pageBreakBefore !== undefined
              ? { pageBreakBefore: action.pageBreakBefore }
              : {}),
            ...(action.suppressLineNumbers !== undefined
              ? { suppressLineNumbers: action.suppressLineNumbers }
              : {}),
          })
          .run()
        if (!changed) {
          skipped += 1
          continue
        }
        applied += 1
        documentChanged = true
        continue
      }

      if (action.type === "insertTable") {
        editor
          .chain()
          .focus()
          .insertTable({
            rows: action.rows,
            cols: action.columns,
            withHeaderRow: action.headerRow,
          })
          .run()
      } else if (action.type === "insertTableOfContents") {
        handleInsertTableOfContents()
      } else if (action.type === "insertPageBreak") {
        handleInsertPageBreak()
      } else if (action.type === "insertHorizontalRule") {
        editor.chain().focus().setHorizontalRule().run()
      } else if (action.type === "insertSectionBreak") {
        handleInsertSectionBreak(action.breakType)
      } else if (action.type === "insertEquation") {
        handleInsertEquation(action.latex)
      } else if (action.type === "insertSymbol") {
        editor.chain().focus().insertContent(action.symbol).run()
      } else if (action.type === "insertTextBox") {
        const preset = getTextBoxPreset(action.preset)
        editor
          .chain()
          .focus()
          .insertContent({
            type: "textBox",
            attrs: {
              width: action.width ?? 360,
              minHeight: action.minHeight ?? 96,
              align: action.align ?? "center",
              boxPosition: action.position ?? "inline",
              padding: 16,
              background: action.background ?? preset.background,
              borderColor: action.borderColor ?? preset.borderColor,
              borderStyle: action.borderStyle ?? preset.borderStyle,
            },
            content: action.text.split(/\n{2,}/).map((paragraph) => ({
              type: "paragraph",
              content: paragraph
                ? [{ type: "text", text: paragraph }]
                : undefined,
            })),
          })
          .run()
      } else if (action.type === "formatTextBox") {
        if (!editor.isActive("textBox")) {
          skipped += 1
          continue
        }
        const preset = action.preset
          ? getTextBoxPreset(action.preset)
          : null
        editor
          .chain()
          .focus()
          .updateAttributes("textBox", {
            ...(preset
              ? {
                  background: preset.background,
                  borderColor: preset.borderColor,
                  borderStyle: preset.borderStyle,
                }
              : {}),
            ...(action.width ? { width: action.width } : {}),
            ...(action.minHeight ? { minHeight: action.minHeight } : {}),
            ...(action.align ? { align: action.align } : {}),
            ...(action.position
              ? { boxPosition: action.position }
              : {}),
            ...(action.background
              ? { background: action.background }
              : {}),
            ...(action.borderColor
              ? { borderColor: action.borderColor }
              : {}),
            ...(action.borderStyle
              ? { borderStyle: action.borderStyle }
              : {}),
            ...(action.padding ? { padding: action.padding } : {}),
          })
          .run()
      } else if (action.type === "insertCaption") {
        handleInsertCaption(action.kind, action.title)
      } else if (action.type === "insertFootnote") {
        handleInsertFootnote(action.text)
      } else if (action.type === "insertEndnote") {
        handleInsertEndnote(action.text)
      } else if (action.type === "insertComment") {
        handleAddComment(action.text)
      } else if (action.type === "replyToComment") {
        const exists = documentState.comments.some(
          (comment) => comment.id === action.commentId
        )
        if (!exists) {
          skipped += 1
          continue
        }
        handleReplyComment(action.commentId, action.text)
      } else if (action.type === "resolveComment") {
        const exists = documentState.comments.some(
          (comment) => comment.id === action.commentId
        )
        if (!exists) {
          skipped += 1
          continue
        }
        handleResolveComment(action.commentId, action.resolved)
      } else if (action.type === "setHeaderFooter") {
        updateWorkspaceState((current) => ({
          ...current,
          sections: current.sections.map((section) =>
            section.id === activeSectionId
              ? {
                  ...section,
                  [action.target]: {
                    ...section[action.target],
                    [action.variant]: action.content,
                  },
                }
              : section
          ),
        }))
      } else if (action.type === "insertCrossReference") {
        let targetExists = [
          "heading",
          "caption",
          "equation",
        ].some((nodeType) => {
          let found = false
          editor.state.doc.descendants((node) => {
            if (node.type.name !== nodeType) return true
            const targetId =
              nodeType === "heading"
                ? node.attrs.anchorId
                : nodeType === "caption"
                  ? node.attrs.captionId
                  : node.attrs.equationId
            if (String(targetId ?? "") === action.targetId) {
              found = true
              return false
            }
            return true
          })
          return found
        })
        if (!targetExists) {
          editor.state.doc.descendants((node) => {
            if (
              node.isText &&
              node.marks.some(
                (mark) =>
                  mark.type.name === "bookmark" &&
                  String(mark.attrs.bookmarkId ?? "") === action.targetId
              )
            ) {
              targetExists = true
              return false
            }
            return true
          })
        }
        if (!targetExists) {
          skipped += 1
          continue
        }
        handleInsertCrossReference(action.targetId)
      } else if (action.type === "addBookmark") {
        if (editor.state.selection.empty) {
          skipped += 1
          continue
        }
        editor
          .chain()
          .focus()
          .setBookmark({
            bookmarkId: `bookmark-${createLocalDocumentId()}`,
            name: action.name,
          })
          .run()
      } else if (action.type === "removeBookmark") {
        const markType = editor.schema.marks.bookmark
        if (!markType) {
          skipped += 1
          continue
        }
        const transaction = editor.state.tr
        editor.state.doc.descendants((node, position) => {
          if (
            node.isText &&
            node.marks.some(
              (mark) =>
                mark.type === markType &&
                mark.attrs.bookmarkId === action.bookmarkId
            )
          ) {
            transaction.removeMark(
              position,
              position + node.nodeSize,
              markType
            )
          }
        })
        if (!transaction.docChanged) {
          skipped += 1
          continue
        }
        editor.view.dispatch(transaction)
      } else if (action.type === "insertCitation") {
        const sourceIds = action.sourceIds.filter((sourceId) =>
          documentState.bibliography.sources.some(
            (source) => source.id === sourceId
          )
        )
        if (sourceIds.length === 0) {
          skipped += 1
          setReferencesOpen(true)
          continue
        }
        const cluster: CitationCluster = {
          id: createLocalDocumentId(),
          mode: action.mode,
          items: sourceIds.map((sourceId) => ({ sourceId })),
        }
        void handleInsertCitation(cluster, "")
      } else if (action.type === "insertBibliography") {
        const entries = documentState.bibliography.sources.map((source) =>
          formatBibliographyEntry(source, documentState.bibliography.style)
        )
        if (entries.length === 0) {
          skipped += 1
          setReferencesOpen(true)
          continue
        }
        handleInsertBibliography(
          "Bibliografía",
          entries,
          documentState.bibliography.style
        )
      } else if (action.type === "insertMailMergeField") {
        editor
          .chain()
          .focus()
          .insertContent(`{{${action.field}}}`)
          .run()
      } else if (action.type === "formatSelectedImage") {
        if (!editor.isActive("image")) {
          skipped += 1
          continue
        }
        const imageAttributes = editor.getAttributes("image")
        const currentWidth = Math.max(
          1,
          Number(imageAttributes.width) || action.width || 320
        )
        const currentHeight = Math.max(
          1,
          Number(imageAttributes.height) || 240
        )
        const hasPixelChanges =
          Boolean(action.crop) ||
          action.brightness !== undefined ||
          action.contrast !== undefined ||
          action.saturation !== undefined ||
          action.grayscale !== undefined ||
          action.maxDimension !== undefined ||
          action.imageFormat !== undefined
        let processedAttributes: Record<string, unknown> = {}
        if (hasPixelChanges) {
          try {
            const result = await processImage(String(imageAttributes.src), {
              ...DEFAULT_IMAGE_PROCESSING_OPTIONS,
              ...(action.crop ? { crop: action.crop } : {}),
              ...(action.brightness !== undefined
                ? { brightness: action.brightness }
                : {}),
              ...(action.contrast !== undefined
                ? { contrast: action.contrast }
                : {}),
              ...(action.saturation !== undefined
                ? { saturation: action.saturation }
                : {}),
              ...(action.grayscale !== undefined
                ? { grayscale: action.grayscale }
                : {}),
              ...(action.maxDimension
                ? { maxDimension: action.maxDimension }
                : {}),
              ...(action.imageFormat
                ? { format: action.imageFormat }
                : {}),
            })
            const nextWidth = action.width ?? currentWidth
            processedAttributes = {
              src: result.src,
              width: nextWidth,
              height: Math.max(
                1,
                Math.round(nextWidth * (result.height / result.width))
              ),
            }
          } catch (error) {
            console.error(error)
            skipped += 1
            continue
          }
        }
        editor
          .chain()
          .focus()
          .updateAttributes("image", {
            ...(action.width
              ? {
                  width: action.width,
                  height: Math.max(
                    1,
                    Math.round(
                      action.width * (currentHeight / currentWidth)
                    )
                  ),
                }
              : {}),
            ...(action.align ? { align: action.align } : {}),
            ...(action.alt ? { alt: action.alt } : {}),
            ...(action.wrap ? { wrap: action.wrap } : {}),
            ...(action.spacing !== undefined
              ? { spacing: action.spacing }
              : {}),
            ...processedAttributes,
          })
          .run()
      } else if (action.type === "editTable") {
        if (!editor.isActive("table")) {
          skipped += 1
          continue
        }
        if (action.operation === "addRow") {
          editor.chain().focus().addRowAfter().run()
        } else if (action.operation === "deleteRow") {
          editor.chain().focus().deleteRow().run()
        } else if (action.operation === "addColumn") {
          editor.chain().focus().addColumnAfter().run()
        } else if (action.operation === "deleteColumn") {
          editor.chain().focus().deleteColumn().run()
        } else if (action.operation === "mergeCells") {
          editor.chain().focus().mergeCells().run()
        } else if (action.operation === "splitCell") {
          editor.chain().focus().splitCell().run()
        } else if (action.operation === "toggleHeaderRow") {
          editor.chain().focus().toggleHeaderRow().run()
        } else if (
          action.operation === "toggleRepeatHeader" ||
          action.operation === "toggleAllowRowBreak"
        ) {
          const attribute =
            action.operation === "toggleRepeatHeader"
              ? "repeatHeader"
              : "allowRowBreak"
          const currentValue = editor.getAttributes("table")[attribute] !== false
          editor
            .chain()
            .focus()
            .updateAttributes("table", { [attribute]: !currentValue })
            .run()
        } else if (
          action.operation === "sortAscending" ||
          action.operation === "sortDescending"
        ) {
          const sorted = sortSelectedTable(
            editor,
            action.operation === "sortAscending"
              ? "ascending"
              : "descending",
            documentState.proofingLanguage
          )
          if (!sorted) {
            skipped += 1
            continue
          }
        } else if (action.operation === "applyFormula") {
          const result = applySelectedTableFormula(
            editor,
            action.formulaOperation ?? "SUM",
            action.formulaDirection ?? "ABOVE",
            documentState.proofingLanguage
          )
          if (!result) {
            skipped += 1
            continue
          }
        } else if (action.operation === "setStyle") {
          editor
            .chain()
            .focus()
            .updateAttributes("table", {
              tableStyle: action.tableStyle ?? "grid",
            })
            .run()
        }
      } else if (action.type === "setPageNumbering") {
        updateWorkspaceState((current) => ({
          ...current,
          sections: current.sections.map((section) =>
            section.id === activeSectionId
              ? {
                  ...section,
                  ...(action.format
                    ? { pageNumberFormat: action.format }
                    : {}),
                  ...(action.position
                    ? { pageNumberPosition: action.position }
                    : {}),
                  pageNumberStart: action.continueFromPrevious
                    ? undefined
                    : (action.start ?? section.pageNumberStart),
                }
              : section
          ),
        }))
      } else if (action.type === "setLineNumbering") {
        setDocumentLayout({
          ...documentLayout,
          lineNumbers: {
            ...documentLayout.lineNumbers,
            mode: action.mode,
            ...(action.start ? { start: action.start } : {}),
            ...(action.countBy ? { countBy: action.countBy } : {}),
            ...(action.distance !== undefined
              ? { distance: action.distance }
              : {}),
          },
        })
      } else if (action.type === "createThesisStructure") {
        handleCreateThesisStructure()
      } else if (action.type === "setProofingLanguage") {
        if (action.scope === "selection") {
          if (editor.state.selection.empty) {
            skipped += 1
            continue
          }
          editor
            .chain()
            .focus()
            .setMark("proofingLanguage", { language: action.language })
            .run()
        } else {
          updateWorkspaceState((current) => ({
            ...current,
            proofingLanguage: action.language,
          }))
        }
      } else if (action.type === "configureWritingAssistant") {
        const thresholdByProfile = {
          strict: 45,
          academic: 60,
          flexible: 75,
          mechanical: null,
        } as const
        updateWorkspaceState((current) => ({
          ...current,
          writingAssistant: {
            ...current.writingAssistant,
            ...(action.profile
              ? {
                  longSentenceThreshold:
                    thresholdByProfile[action.profile],
                }
              : {}),
            ...(action.disabledRules
              ? { disabledRules: action.disabledRules }
              : {}),
          },
        }))
      } else if (action.type === "configureAutocorrect") {
        updateWorkspaceState((current) => {
          let replacements = current.autocorrect.replacements
          if (action.removeReplacement) {
            replacements = replacements.filter(
              (replacement) =>
                replacement.from.toLocaleLowerCase() !==
                action.removeReplacement?.toLocaleLowerCase()
            )
          }
          if (action.replacement) {
            replacements = [
              ...replacements.filter(
                (replacement) =>
                  replacement.from.toLocaleLowerCase() !==
                  action.replacement?.from.toLocaleLowerCase()
              ),
              {
                id: createLocalDocumentId(),
                ...action.replacement,
              },
            ].slice(-200)
          }
          return {
            ...current,
            autocorrect: {
              ...current.autocorrect,
              ...(action.enabled !== undefined
                ? { enabled: action.enabled }
                : {}),
              ...(action.capitalizeSentences !== undefined
                ? {
                    capitalizeSentences:
                      action.capitalizeSentences,
                  }
                : {}),
              ...(action.smartQuotes !== undefined
                ? { smartQuotes: action.smartQuotes }
                : {}),
              ...(action.smartDashes !== undefined
                ? { smartDashes: action.smartDashes }
                : {}),
              replacements,
            },
          }
        })
      } else if (action.type === "setLayout") {
        setDocumentLayout({
          ...documentLayout,
          ...(action.pageSize ? { pageSize: action.pageSize } : {}),
          ...(action.orientation ? { orientation: action.orientation } : {}),
          ...(action.columns ? { columns: action.columns } : {}),
          ...(action.zoom ? { zoom: action.zoom } : {}),
          ...(action.margin
            ? {
                margin: action.margin,
                margins: {
                  ...documentLayout.margins,
                  top: action.margin,
                  right: action.margin,
                  bottom: action.margin,
                  left: action.margin,
                },
              }
            : {}),
          ...(action.columnGap ? { columnGap: action.columnGap } : {}),
          ...(action.showRuler !== undefined
            ? { showRuler: action.showRuler }
            : {}),
          ...(action.showFormattingMarks !== undefined
            ? { showFormattingMarks: action.showFormattingMarks }
            : {}),
        })
      } else if (action.type === "setPageAppearance") {
        updateWorkspaceState((current) => ({
          ...current,
          pageAppearance: {
            ...current.pageAppearance,
            ...(action.color ? { color: action.color } : {}),
            ...(action.borderStyle
              ? { borderStyle: action.borderStyle }
              : {}),
            ...(action.borderColor
              ? { borderColor: action.borderColor }
              : {}),
            ...(action.borderWidth !== undefined
              ? { borderWidth: action.borderWidth }
              : {}),
            ...(action.watermarkText !== undefined
              ? { watermarkText: action.watermarkText }
              : {}),
            ...(action.watermarkColor
              ? { watermarkColor: action.watermarkColor }
              : {}),
            ...(action.watermarkOpacity !== undefined
              ? { watermarkOpacity: action.watermarkOpacity }
              : {}),
            ...(action.watermarkAngle !== undefined
              ? { watermarkAngle: action.watermarkAngle }
              : {}),
            ...(action.hyphenation !== undefined
              ? { hyphenation: action.hyphenation }
              : {}),
          },
        }))
      } else if (action.type === "setOutlineNumbering") {
        updateWorkspaceState((current) => ({
          ...current,
          outlineNumbering: {
            enabled: action.enabled,
            maxLevel:
              action.maxLevel ?? current.outlineNumbering.maxLevel,
            separator:
              action.separator ?? current.outlineNumbering.separator,
          },
        }))
      } else if (action.type === "setTrackChanges") {
        updateWorkspaceState((current) => ({
          ...current,
          trackChanges: {
            ...current.trackChanges,
            enabled: action.enabled,
          },
        }))
      } else if (action.type === "applyStyleTheme") {
        updateWorkspaceState((current) => ({
          ...current,
          styles: applyDocumentStyleTheme(current.styles, action.theme),
        }))
      } else if (action.type === "openPanel") {
        if (action.panel === "references") setReferencesOpen(true)
        if (action.panel === "footnotes") setFootnotesOpen(true)
        if (action.panel === "layout") setLayoutOpen(true)
        if (action.panel === "review") setReviewOpen(true)
        if (action.panel === "documentTools") {
          setDocumentToolsInitialTab("navigate")
          setDocumentToolsOpen(true)
        }
        if (action.panel === "mailMerge") {
          setDocumentToolsInitialTab("mailMerge")
          setDocumentToolsOpen(true)
        }
        if (action.panel === "writing") {
          setDocumentToolsInitialTab("writing")
          setDocumentToolsOpen(true)
        }
        if (action.panel === "versions") setVersionsOpen(true)
        if (action.panel === "accessibility") setAccessibilityOpen(true)
        if (action.panel === "reader") setImmersiveReaderOpen(true)
      }
      if (action.type !== "openPanel") documentChanged = true
      applied += 1
    }

    if (applied > 0) {
      if (documentChanged) setIsDirty(true)
      toast.success(
        applied === 1
          ? "Acción de IA aplicada"
          : `${applied} acciones de IA aplicadas`
      )
    }
    if (skipped > 0) {
      toast.info(
        skipped === 1
          ? "Una acción necesita más contexto"
          : `${skipped} acciones necesitan más contexto`,
        {
          description:
            "Selecciona el fragmento o añade las fuentes necesarias y vuelve a intentarlo.",
        }
      )
    }
  }

  const handleExport = async (format: ExportFormat) => {
    if (!editor) return
    const base = slugifyFilename(docName)

    if (format === "md" || format === "txt") {
      downloadBlob(
        `${base}.${format}`,
        new Blob([getSerializedDocument().markdown], {
          type: "text/plain;charset=utf-8",
        })
      )
      return
    }

    setIsExporting(true)
    try {
      const ast = buildDocumentAst(editor.getJSON())
      if (format === "pdf") {
        const { exportDocumentToPdf } = await import("@/lib/export/exportPdf")
        await exportDocumentToPdf(ast, `${base}.pdf`, documentState)
      } else if (format === "odt") {
        const { exportDocumentToOdt } = await import("@/lib/export/exportOdt")
        await exportDocumentToOdt(ast, `${base}.odt`, documentState)
      } else {
        const { exportDocumentToDocx } = await import("@/lib/export/exportDocx")
        await exportDocumentToDocx(ast, `${base}.docx`, documentState)
      }
    } catch (error) {
      console.error(error)
      toast.error(
        format === "pdf"
          ? "No se pudo generar el PDF"
          : format === "odt"
            ? "No se pudo generar el documento OpenDocument"
            : "No se pudo generar el documento Word"
      )
    } finally {
      setIsExporting(false)
    }
  }

  const refreshBibliographyFields = async (
    bibliography: DocumentBibliography,
    replacements: Record<string, string> = {}
  ) => {
    if (!editor) return
    const sourceById = new Map(
      bibliography.sources.map((source) => [source.id, source])
    )
    const clusters: CitationCluster[] = []
    const changes: Array<
      | {
          type: "citation"
          position: number
          nodeSize: number
          cluster: CitationCluster
          label: string
        }
      | { type: "bibliography"; position: number; heading: string }
    > = []

    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "citation") {
        const legacyId = String(node.attrs.sourceId ?? "")
        const rawItems = Array.isArray(node.attrs.items)
          ? node.attrs.items
          : legacyId
            ? [{ sourceId: legacyId }]
            : []
        const cluster: CitationCluster = {
          id: String(node.attrs.clusterId || legacyId || createLocalDocumentId()),
          mode:
            node.attrs.mode === "narrative" || node.attrs.mode === "note"
              ? node.attrs.mode
              : "parenthetical",
          items: rawItems.map((item: { sourceId?: unknown }) => ({
            ...item,
            sourceId:
              replacements[String(item.sourceId ?? "")] ??
              String(item.sourceId ?? ""),
          })),
        }
        clusters.push(cluster)
        changes.push({
          type: "citation",
          position,
          nodeSize: node.nodeSize,
          cluster,
          label: formatCitationClusterFallback(
            cluster,
            bibliography.sources,
            bibliography.style
          ),
        })
      } else if (node.type.name === "bibliography") {
        changes.push({
          type: "bibliography",
          position,
          heading: String(node.attrs.heading || "Bibliografía"),
        })
      }
      return true
    })

    let bibliographyEntries = bibliography.sources.map((source) =>
      formatBibliographyEntry(source, bibliography.style)
    )
    const cslLabels: Record<string, string> = {}
    if (window.editorDesktop && bibliography.sources.length > 0) {
      try {
        const formatted = await window.editorDesktop.csl.format({
          styleId: bibliography.style,
          styleXml: bibliography.cslXml,
          locale: bibliography.locale ?? "es-ES",
          sources: bibliography.sources,
          clusters,
        })
        bibliographyEntries = formatted.bibliography
        Object.assign(cslLabels, formatted.citations)
      } catch (error) {
        console.warn("CSL fallback:", error)
      }
    }

    const transaction = editor.state.tr
    for (const change of changes.sort(
      (left, right) => right.position - left.position
    )) {
      if (change.type === "bibliography") {
        transaction.setNodeMarkup(change.position, undefined, {
          heading: change.heading,
          style: bibliography.style,
          entries: bibliographyEntries,
        })
        continue
      }
      const validItems = change.cluster.items.filter((item) =>
        sourceById.has(item.sourceId)
      )
      if (validItems.length > 0) {
        transaction.setNodeMarkup(change.position, undefined, {
          sourceId: validItems[0].sourceId,
          clusterId: change.cluster.id,
          items: validItems,
          mode: change.cluster.mode,
          style: bibliography.style,
          label: cslLabels[change.cluster.id] ?? change.label,
        })
      } else {
        transaction.replaceWith(
          change.position,
          change.position + change.nodeSize,
          editor.state.schema.text(change.label)
        )
      }
    }
    if (transaction.docChanged) {
      transaction.setMeta("etiDynamicFields", true)
      editor.view.dispatch(transaction)
    }
  }

  const handleBibliographyChange = (
    bibliography: DocumentBibliography,
    replacements: Record<string, string> = {}
  ) => {
    setDocumentState((current) => ({ ...current, bibliography }))
    void refreshBibliographyFields(bibliography, replacements)
    setIsDirty(true)
  }

  const handleInsertCitation = async (
    cluster: CitationCluster,
    fallbackLabel: string
  ) => {
    if (!editor) return
    const fallback = formatCitationClusterFallback(
      cluster,
      documentState.bibliography.sources,
      documentState.bibliography.style
    )
    let label = fallback || fallbackLabel
    if (window.editorDesktop) {
      try {
        const result = await window.editorDesktop.csl.format({
          styleId: documentState.bibliography.style,
          styleXml: documentState.bibliography.cslXml,
          locale: documentState.bibliography.locale ?? "es-ES",
          sources: documentState.bibliography.sources,
          clusters: [cluster],
        })
        label = result.citations[cluster.id] ?? label
      } catch {
        // La cita sigue siendo utilizable con el formateador integrado.
      }
    }
    if (
      cluster.mode === "note" ||
      documentState.bibliography.styleClass === "note"
    ) {
      handleInsertFootnote(label)
      toast.success("Cita insertada como nota al pie")
      return
    }
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "citation",
          attrs: {
            sourceId: cluster.items[0]?.sourceId,
            clusterId: cluster.id,
            items: cluster.items,
            mode: cluster.mode,
            style: documentState.bibliography.style,
            label,
          },
        },
        { type: "text", text: " " },
      ])
      .run()
    setIsDirty(true)
    toast.success(
      cluster.items.length > 1
        ? "Cita múltiple vinculada insertada"
        : "Cita vinculada insertada"
    )
  }

  const handleInsertBibliography = (
    heading: string,
    entries: string[],
    style: CitationStyle
  ) => {
    if (!editor || entries.length === 0) return
    let existingPosition: number | null = null
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "bibliography") {
        existingPosition = position
        return false
      }
      return true
    })
    if (existingPosition !== null) {
      const transaction = editor.state.tr.setNodeMarkup(
        existingPosition,
        undefined,
        { heading, entries, style }
      )
      editor.view.dispatch(transaction)
    } else {
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.doc.content.size, {
          type: "bibliography",
          attrs: { heading, entries, style },
        })
        .run()
    }
    setIsDirty(true)
    toast.success(
      existingPosition === null
        ? "Bibliografía vinculada insertada"
        : "Bibliografía vinculada actualizada"
    )
  }

  const refreshDynamicFields = React.useCallback(() => {
    if (!editor) return
    const headings: Array<{
      position: number
      id: string
      level: number
      number: string
      text: string
    }> = []
    const captions: Array<{
      position: number
      id: string
      kind: string
      number: number
      label: string
      title: string
    }> = []
    const counters = [0, 0, 0, 0, 0, 0]
    const captionCounters = new Map<string, number>()
    const bookmarks = new Map<string, string>()
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "heading") {
        const level = Math.min(6, Math.max(1, Number(node.attrs.level ?? 1)))
        counters[level - 1] += 1
        for (let index = level; index < counters.length; index += 1) {
          counters[index] = 0
        }
        const number =
          documentState.outlineNumbering.enabled &&
          level <= documentState.outlineNumbering.maxLevel
            ? counters
                .slice(0, level)
                .filter((value) => value > 0)
                .join(documentState.outlineNumbering.separator)
            : ""
        headings.push({
          position,
          id: String(node.attrs.anchorId || `heading-${position}`),
          level,
          number,
          text: node.textContent,
        })
      } else if (node.type.name === "caption") {
        const kind = String(node.attrs.kind ?? "figure")
        const number = (captionCounters.get(kind) ?? 0) + 1
        captionCounters.set(kind, number)
        captions.push({
          position,
          id: String(node.attrs.captionId || `caption-${position}`),
          kind,
          number,
          label: String(node.attrs.label ?? "Figura"),
          title: String(node.attrs.title ?? ""),
        })
      } else if (node.type.name === "equation") {
        const kind = "equation"
        const number = (captionCounters.get(kind) ?? 0) + 1
        captionCounters.set(kind, number)
        captions.push({
          position,
          id: String(node.attrs.equationId || `equation-${position}`),
          kind,
          number,
          label: "Ecuación",
          title: "",
        })
      } else if (node.isText) {
        const bookmark = node.marks.find(
          (mark) => mark.type.name === "bookmark"
        )
        const bookmarkId = String(bookmark?.attrs.bookmarkId ?? "")
        if (bookmarkId && !bookmarks.has(bookmarkId)) {
          bookmarks.set(
            bookmarkId,
            String(bookmark?.attrs.name || node.text || "Marcador")
          )
        }
      }
      return true
    })
    const targetLabels = new Map<string, string>()
    for (const heading of headings) {
      targetLabels.set(
        heading.id,
        `${heading.number ? `${heading.number} ` : ""}${heading.text}`
      )
    }
    for (const caption of captions) {
      targetLabels.set(caption.id, `${caption.label} ${caption.number}`)
    }
    for (const [bookmarkId, label] of bookmarks) {
      targetLabels.set(bookmarkId, label)
    }
    const transaction = editor.state.tr
    for (const heading of headings) {
      const node = transaction.doc.nodeAt(heading.position)
      if (
        node &&
        (node.attrs.anchorId !== heading.id ||
          node.attrs.outlineNumber !== (heading.number || null))
      ) {
        transaction.setNodeMarkup(heading.position, undefined, {
          ...node.attrs,
          anchorId: heading.id,
          outlineNumber: heading.number || null,
        })
      }
    }
    for (const caption of captions) {
      const node = transaction.doc.nodeAt(caption.position)
      if (!node) continue
      const identityAttribute =
        caption.kind === "equation" ? "equationId" : "captionId"
      if (
        node.attrs[identityAttribute] !== caption.id ||
        node.attrs.number !== caption.number
      ) {
        transaction.setNodeMarkup(caption.position, undefined, {
          ...node.attrs,
          [identityAttribute]: caption.id,
          number: caption.number,
        })
      }
    }
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === "tableOfContents") {
        const entries = headings
          .filter((heading) => heading.level <= Number(node.attrs.maxLevel ?? 3))
          .map(({ id, level, number, text }) => ({
            id,
            level,
            number,
            text,
          }))
        if (JSON.stringify(node.attrs.entries ?? []) !== JSON.stringify(entries)) {
          transaction.setNodeMarkup(position, undefined, {
            ...node.attrs,
            entries,
          })
        }
      } else if (node.type.name === "crossReference") {
        const text =
          targetLabels.get(String(node.attrs.targetId ?? "")) ??
          "Referencia no disponible"
        if (node.attrs.text !== text) {
          transaction.setNodeMarkup(position, undefined, {
            ...node.attrs,
            text,
          })
        }
      }
      return true
    })
    if (transaction.docChanged) editor.view.dispatch(transaction)
  }, [documentState.outlineNumbering, editor])

  React.useEffect(() => {
    if (!editor) return
    let timeout: ReturnType<typeof setTimeout> | null = null
    let idleHandle: number | null = null
    const schedule = (event?: {
      transaction?: { getMeta: (key: string) => unknown }
    }) => {
      if (event?.transaction?.getMeta("etiDynamicFields")) return
      if (timeout) clearTimeout(timeout)
      if (idleHandle !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
        idleHandle = null
      }
      timeout = setTimeout(() => {
        timeout = null
        if ("requestIdleCallback" in window) {
          idleHandle = window.requestIdleCallback(
            () => {
              idleHandle = null
              refreshDynamicFields()
            },
            { timeout: 1_000 }
          )
        } else {
          refreshDynamicFields()
        }
      }, 300)
    }
    editor.on("update", schedule)
    schedule()
    return () => {
      if (timeout) clearTimeout(timeout)
      if (idleHandle !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
      }
      editor.off("update", schedule)
    }
  }, [editor, refreshDynamicFields])

  const handleInsertTableOfContents = () => {
    if (!editor) return
    if (
      !editor.state.doc.content.content.some(
        (node) => node.type.name === "heading"
      )
    ) {
      toast.info("Añade títulos al documento antes de generar el índice.")
      return
    }
    editor
      .chain()
      .focus()
      .insertContentAt(0, {
        type: "tableOfContents",
        attrs: { title: "Índice", maxLevel: 3, entries: [] },
      })
      .run()
    refreshDynamicFields()
    setIsDirty(true)
    toast.success("Índice dinámico insertado")
  }

  const handleInsertCaption = (
    kind: "figure" | "table",
    title: string
  ) => {
    if (!editor) return
    editor
      .chain()
      .focus()
      .insertContent({
        type: "caption",
        attrs: {
          captionId: createLocalDocumentId(),
          kind,
          number: 1,
          label: kind === "table" ? "Tabla" : "Figura",
          title: title.trim(),
        },
      })
      .run()
    refreshDynamicFields()
  }

  const handleInsertEquation = (latex: string) => {
    if (!editor || !latex.trim()) return
    editor
      .chain()
      .focus()
      .insertContent({
        type: "equation",
        attrs: {
          equationId: createLocalDocumentId(),
          latex: latex.trim(),
          number: 1,
        },
      })
      .run()
    refreshDynamicFields()
  }

  const handleInsertCrossReference = (targetId: string) => {
    if (!editor || !targetId) return
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "crossReference",
          attrs: { targetId, text: "Referencia" },
        },
        { type: "text", text: " " },
      ])
      .run()
    refreshDynamicFields()
  }

  const updateWorkspaceState = (
    updater:
      | DocumentWorkspaceState
      | ((current: DocumentWorkspaceState) => DocumentWorkspaceState)
  ) => {
    setDocumentState((current) =>
      typeof updater === "function" ? updater(current) : updater
    )
    setIsDirty(true)
  }

  const setDocumentLayout = (layout: DocumentLayoutSettings) => {
    updateWorkspaceState((current) => ({
      ...current,
      layout:
        current.sections[0]?.id === activeSectionId ? layout : current.layout,
      sections: current.sections.map((section) =>
        section.id === activeSectionId ? { ...section, layout } : section
      ),
    }))
  }

  const isBuiltInStyle = (styleId: string) =>
    BUILT_IN_DOCUMENT_STYLES.some((style) => style.id === styleId)

  const addCustomStyle = (style: Omit<DocumentStyleDefinition, "id">) => {
    const id = `custom-${crypto.randomUUID()}`
    updateWorkspaceState((current) => ({
      ...current,
      styles: [...current.styles, { ...style, id }],
    }))
    return id
  }

  const updateStyle = (
    styleId: string,
    patch: Partial<Omit<DocumentStyleDefinition, "id">>
  ) => {
    updateWorkspaceState((current) => ({
      ...current,
      styles: current.styles.map((style) =>
        style.id === styleId ? { ...style, ...patch } : style
      ),
    }))
  }

  const deleteStyle = (styleId: string) => {
    if (isBuiltInStyle(styleId)) return
    updateWorkspaceState((current) => ({
      ...current,
      styles: current.styles.filter((style) => style.id !== styleId),
    }))
  }

  const handleOpenReview = (
    preservedSelection: { from: number; to: number } | null = null
  ) => {
    if (
      editor &&
      preservedSelection &&
      preservedSelection.from >= 0 &&
      preservedSelection.to <= editor.state.doc.content.size
    ) {
      lastTextSelectionRef.current = preservedSelection
    } else if (editor && !editor.state.selection.empty) {
      lastTextSelectionRef.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      }
    }
    setReviewSelectionAvailable(Boolean(lastTextSelectionRef.current))
    setReviewOpen(true)
  }

  const handleInsertPageBreak = () => {
    if (!editor) return
    editor.chain().focus().insertContent({ type: "pageBreak" }).run()
    setIsDirty(true)
    toast.success("Salto de página insertado")
  }

  const handleInsertSectionBreak = (breakType: SectionBreakType) => {
    if (!editor || !activeSection) return
    const sectionId = `section-${createLocalDocumentId()}`
    const nextSection: DocumentSection = {
      ...activeSection,
      id: sectionId,
      name: `Sección ${documentState.sections.length + 1}`,
      breakType,
      layout: {
        ...activeSection.layout,
        margins: { ...activeSection.layout.margins },
      },
      header: { ...activeSection.header },
      footer: { ...activeSection.footer },
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "sectionBreak",
        attrs: {
          sectionId,
          breakType,
          label: `Salto de sección · ${nextSection.name}`,
        },
      })
      .run()
    updateWorkspaceState((current) => {
      const activeIndex = Math.max(
        0,
        current.sections.findIndex((section) => section.id === activeSectionId)
      )
      const sections = [...current.sections]
      sections.splice(activeIndex + 1, 0, nextSection)
      return { ...current, sections }
    })
    setActiveSectionId(sectionId)
    toast.success(`${nextSection.name} creada`)
  }

  const handleCreateThesisStructure = () => {
    if (!editor || !activeSection) return
    const sectionId = `section-${createLocalDocumentId()}`
    const preliminarySection: DocumentSection = {
      ...activeSection,
      name: "Preliminares",
      pageNumberPosition: "footer-center",
      pageNumberFormat: "lowerRoman",
      pageNumberStart: 1,
    }
    const bodySection: DocumentSection = {
      ...activeSection,
      id: sectionId,
      name: "Cuerpo principal",
      breakType: "nextPage",
      layout: {
        ...activeSection.layout,
        margins: { ...activeSection.layout.margins },
      },
      header: { ...activeSection.header },
      footer: { ...activeSection.footer },
      pageNumberPosition: "footer-center",
      pageNumberFormat: "decimal",
      pageNumberStart: 1,
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "sectionBreak",
        attrs: {
          sectionId,
          breakType: "nextPage",
          label: "Salto de sección · Cuerpo principal",
        },
      })
      .run()
    updateWorkspaceState((current) => {
      const activeIndex = current.sections.findIndex(
        (section) => section.id === activeSectionId
      )
      if (activeIndex < 0) return current
      const sections = [...current.sections]
      sections[activeIndex] = preliminarySection
      sections.splice(activeIndex + 1, 0, bodySection)
      return {
        ...current,
        sections,
        layout:
          activeIndex === 0 ? preliminarySection.layout : current.layout,
      }
    })
    setActiveSectionId(sectionId)
    toast.success("Estructura académica creada: preliminares y cuerpo desde 1")
  }

  const handleInsertFootnote = (text: string) => {
    if (!editor || !text.trim()) return
    const footnoteId = createLocalDocumentId()
    const number =
      Math.max(0, ...documentState.footnotes.map((footnote) => footnote.number)) +
      1
    editor
      .chain()
      .focus()
      .insertContent({
        type: "footnoteReference",
        attrs: { footnoteId, number },
      })
      .run()
    updateWorkspaceState((current) => ({
      ...current,
      footnotes: [
        ...current.footnotes,
        { id: footnoteId, number, text: text.trim() },
      ],
    }))
    toast.success(`Nota ${number} insertada`)
  }

  const handleUpdateFootnote = (id: string, text: string) => {
    updateWorkspaceState((current) => ({
      ...current,
      footnotes: current.footnotes.map((footnote) =>
        footnote.id === id ? { ...footnote, text } : footnote
      ),
    }))
  }

  const handleDeleteFootnote = (id: string) => {
    if (!editor) return
    const positions: number[] = []
    editor.state.doc.descendants((node, position) => {
      if (
        node.type.name === "footnoteReference" &&
        node.attrs.footnoteId === id
      ) {
        positions.push(position)
      }
      return true
    })
    const transaction = editor.state.tr
    for (const position of positions.reverse()) {
      transaction.delete(position, position + 1)
    }
    if (transaction.docChanged) editor.view.dispatch(transaction)

    updateWorkspaceState((current) => {
      const footnotes = current.footnotes
        .filter((footnote) => footnote.id !== id)
        .map((footnote, index) => ({ ...footnote, number: index + 1 }))
      const numberById = new Map(
        footnotes.map((footnote) => [footnote.id, footnote.number])
      )
      const renumberTransaction = editor.state.tr
      editor.state.doc.descendants((node, position) => {
        if (node.type.name !== "footnoteReference") return true
        const number = numberById.get(String(node.attrs.footnoteId))
        if (number) {
          renumberTransaction.setNodeMarkup(position, undefined, {
            ...node.attrs,
            number,
          })
        }
        return true
      })
      if (renumberTransaction.docChanged) {
        editor.view.dispatch(renumberTransaction)
      }
      return { ...current, footnotes }
    })
    toast.success("Nota eliminada")
  }

  const handleInsertEndnote = (text: string) => {
    if (!editor || !text.trim()) return
    const endnoteId = createLocalDocumentId()
    const number =
      Math.max(0, ...documentState.endnotes.map((endnote) => endnote.number)) +
      1
    editor
      .chain()
      .focus()
      .insertContent({
        type: "endnoteReference",
        attrs: { endnoteId, number },
      })
      .run()
    updateWorkspaceState((current) => ({
      ...current,
      endnotes: [
        ...current.endnotes,
        { id: endnoteId, number, text: text.trim() },
      ],
    }))
    toast.success(`Nota final ${number} insertada`)
  }

  const handleUpdateEndnote = (id: string, text: string) => {
    updateWorkspaceState((current) => ({
      ...current,
      endnotes: current.endnotes.map((endnote) =>
        endnote.id === id ? { ...endnote, text } : endnote
      ),
    }))
  }

  const handleDeleteEndnote = (id: string) => {
    if (!editor) return
    const positions: number[] = []
    editor.state.doc.descendants((node, position) => {
      if (
        node.type.name === "endnoteReference" &&
        node.attrs.endnoteId === id
      ) {
        positions.push(position)
      }
      return true
    })
    const transaction = editor.state.tr
    for (const position of positions.reverse()) {
      transaction.delete(position, position + 1)
    }
    if (transaction.docChanged) editor.view.dispatch(transaction)

    updateWorkspaceState((current) => {
      const endnotes = current.endnotes
        .filter((endnote) => endnote.id !== id)
        .map((endnote, index) => ({ ...endnote, number: index + 1 }))
      const numberById = new Map(
        endnotes.map((endnote) => [endnote.id, endnote.number])
      )
      const renumberTransaction = editor.state.tr
      editor.state.doc.descendants((node, position) => {
        if (node.type.name !== "endnoteReference") return true
        const number = numberById.get(String(node.attrs.endnoteId))
        if (number) {
          renumberTransaction.setNodeMarkup(position, undefined, {
            ...node.attrs,
            number,
          })
        }
        return true
      })
      if (renumberTransaction.docChanged) {
        editor.view.dispatch(renumberTransaction)
      }
      return { ...current, endnotes }
    })
    toast.success("Nota final eliminada")
  }

  const handleAddComment = (text: string) => {
    if (!editor || !text.trim()) return
    const liveSelection = editor.state.selection.empty
      ? null
      : {
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        }
    const selection = liveSelection ?? lastTextSelectionRef.current
    if (!selection) {
      toast.info("Selecciona el texto al que quieres añadir el comentario")
      return
    }
    const id = createLocalDocumentId()
    const author = documentState.trackChanges.author.trim() || "Autor"
    const { from, to } = selection
    const anchorText = editor.state.doc.textBetween(from, to, " ").trim()
    editor
      .chain()
      .focus()
      .setTextSelection(selection)
      .setMark("comment", { commentId: id })
      .run()
    lastTextSelectionRef.current = null
    updateWorkspaceState((current) => ({
      ...current,
      comments: [
        ...current.comments,
        {
          id,
          author,
          initials: author
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join(""),
          text: text.trim(),
          createdAt: new Date().toISOString(),
          resolved: false,
          replies: [],
          anchorText,
          orphaned: false,
        },
      ],
    }))
    toast.success("Comentario añadido")
  }

  const handleResolveComment = (id: string, resolved: boolean) => {
    updateWorkspaceState((current) => ({
      ...current,
      comments: current.comments.map((comment) =>
        comment.id === id ? { ...comment, resolved } : comment
      ),
    }))
  }

  const handleReplyComment = (id: string, text: string) => {
    if (!text.trim()) return
    updateWorkspaceState((current) => ({
      ...current,
      comments: current.comments.map((comment) =>
        comment.id === id
          ? {
              ...comment,
              replies: [
                ...comment.replies,
                {
                  id: createLocalDocumentId(),
                  author: current.trackChanges.author.trim() || "Autor",
                  text: text.trim(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : comment
      ),
    }))
  }

  const removeCommentMark = (id: string) => {
    if (!editor) return
    const markType = editor.schema.marks.comment
    if (!markType) return
    const transaction = editor.state.tr
    editor.state.doc.descendants((node, position) => {
      if (
        node.isText &&
        node.marks.some(
          (mark) => mark.type === markType && mark.attrs.commentId === id
        )
      ) {
        transaction.removeMark(position, position + node.nodeSize, markType)
      }
      return true
    })
    if (transaction.docChanged) editor.view.dispatch(transaction)
  }

  const handleDeleteComment = (id: string) => {
    removeCommentMark(id)
    updateWorkspaceState((current) => ({
      ...current,
      comments: current.comments.filter((comment) => comment.id !== id),
    }))
  }

  const handleSelectComment = (id: string) => {
    if (!editor) return
    let from: number | null = null
    let to: number | null = null
    editor.state.doc.descendants((node, position) => {
      if (
        node.isText &&
        node.marks.some(
          (mark) =>
            mark.type.name === "comment" && mark.attrs.commentId === id
        )
      ) {
        from ??= position
        to = position + node.nodeSize
      }
      return true
    })
    if (from !== null && to !== null) {
      editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run()
    } else {
      toast.info("El comentario se conserva, pero su texto original ya no existe", {
        description: "Selecciona otro fragmento y usa Reanclar.",
      })
    }
  }

  const handleDetachComments = (ids: string[]) => {
    const detached = new Set(ids)
    if (detached.size === 0) return
    updateWorkspaceState((current) => ({
      ...current,
      comments: current.comments.map((comment) =>
        detached.has(comment.id) ? { ...comment, orphaned: true } : comment
      ),
    }))
    toast.warning(
      `${detached.size} ${
        detached.size === 1 ? "comentario preservado" : "comentarios preservados"
      } sin anclaje`,
      {
        description:
          "El texto revisado se eliminó, pero los comentarios pueden reanclarse.",
      }
    )
  }

  const handleReanchorComment = (id: string) => {
    if (!editor) return
    const liveSelection = editor.state.selection.empty
      ? null
      : {
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        }
    const selection = liveSelection ?? lastTextSelectionRef.current
    if (!selection) {
      toast.info("Selecciona el nuevo texto para reanclar el comentario")
      return
    }
    const { from, to } = selection
    const anchorText = editor.state.doc.textBetween(from, to, " ").trim()
    editor
      .chain()
      .focus()
      .setTextSelection(selection)
      .setMark("comment", { commentId: id })
      .run()
    lastTextSelectionRef.current = null
    updateWorkspaceState((current) => ({
      ...current,
      comments: current.comments.map((comment) =>
        comment.id === id
          ? { ...comment, anchorText, orphaned: false }
          : comment
      ),
    }))
    toast.success("Comentario reanclado")
  }

  const snapshotActiveTab = () => {
    const { html, markdown } = getSerializedDocument()
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              title: docName,
              path: documentPath,
              html,
              markdown,
              mode,
              prompt,
              chatJson: JSON.stringify(chatMessages),
              documentJson: JSON.stringify(documentState),
              dirty: isDirty,
            }
          : tab
      )
    )
  }

  const loadDocumentTab = (tab: DocumentTab) => {
    const workspace = parseDocumentWorkspaceState(tab.documentJson)
    setActiveTabId(tab.id)
    setDocumentId(tab.id)
    setDocumentPath(tab.path)
    setDocName(tab.title)
    setPrompt(tab.prompt)
    setResponseText(tab.markdown)
    setMode(tab.mode)
    setStatus(tab.mode === "editing" ? "done" : "idle")
    setIsDirty(tab.dirty)
    setDocumentState(workspace)
    setActiveSectionId(workspace.sections[0].id)
    setChatMessages(() => {
      try {
        return JSON.parse(tab.chatJson) as ChatMessage[]
      } catch {
        return []
      }
    })
    setPendingFragment(null)
    setPendingRange(null)
    editor?.commands.setContent(
      normalizeImportedDocxHtml(tab.html || "", workspace),
      { emitUpdate: false }
    )
    editor?.commands.setTrackChangesEnabled(
      workspace.trackChanges.enabled,
      workspace.trackChanges.author
    )
  }

  const handleSwitchTab = (id: string) => {
    if (id === activeTabId) return
    const target = tabs.find((tab) => tab.id === id)
    if (!target) return
    snapshotActiveTab()
    loadDocumentTab(target)
  }

  const handleNewDocument = () => {
    snapshotActiveTab()
    const id = createLocalDocumentId()
    const newTab: DocumentTab = {
      id,
      title: "Documento sin título",
      path: null,
      html: "",
      markdown: "",
      mode: "welcome",
      prompt: "",
      chatJson: "[]",
      documentJson: JSON.stringify(createDefaultDocumentWorkspaceState()),
      dirty: false,
    }
    setTabs((currentTabs) => [...currentTabs, newTab])
    loadDocumentTab(newTab)
    setAttachments([])
    setErrorMessage(null)
  }

  const handleCreateDocumentFromHtml = (html: string, title: string) => {
    snapshotActiveTab()
    const id = createLocalDocumentId()
    const workspace = parseDocumentWorkspaceState(
      JSON.stringify(documentState)
    )
    const tab: DocumentTab = {
      id,
      title: title.trim() || "Combinación de correspondencia",
      path: null,
      html,
      markdown: htmlToMarkdown(html),
      mode: "editing",
      prompt: "",
      chatJson: "[]",
      documentJson: JSON.stringify(workspace),
      dirty: true,
    }
    setTabs((currentTabs) => [...currentTabs, tab])
    loadDocumentTab(tab)
    setAttachments([])
    setErrorMessage(null)
    toast.success("Lote combinado creado en una pestaña nueva")
  }

  const handleOpenDocument = async (requestedPath?: string) => {
    if (!window.editorDesktop) {
      toast.info(
        "La apertura directa de DOCX y ODT está disponible en la aplicación de Windows."
      )
      return
    }
    try {
      const opened = await window.editorDesktop.documents.open(requestedPath)
      if (!opened) return
      snapshotActiveTab()
      const existing = tabs.find((tab) => tab.id === opened.documentId)
      const tab: DocumentTab = {
        id: opened.documentId,
        title: opened.title,
        path: opened.path,
        html: opened.html,
        markdown: opened.markdown,
        mode: "editing",
        prompt: "",
        chatJson: opened.chatJson ?? existing?.chatJson ?? "[]",
        documentJson: opened.documentJson ?? existing?.documentJson ?? "{}",
        dirty: false,
      }
      setTabs((currentTabs) => [
        ...currentTabs.filter((current) => current.id !== opened.documentId),
        tab,
      ])
      loadDocumentTab(tab)
      setAttachments([])
      setErrorMessage(null)
      if (opened.path) {
        recordRecentDocument({ path: opened.path, title: opened.title })
      }
      if (opened.warnings.length > 0) {
        toast.warning("Documento abierto con avisos de compatibilidad", {
          description: opened.warnings.slice(0, 2).join(" · "),
        })
      } else {
        toast.success(`Abierto: ${opened.title}`)
      }
    } catch (error) {
      toast.error("No se pudo abrir el documento", {
        description: error instanceof Error ? error.message : "Error desconocido",
      })
    }
  }

  const createDesktopSaveInput = async (
    saveAs: boolean,
    createVersion = true,
    versionReason = "Guardado manual"
  ) => {
    if (!editor || !window.editorDesktop) return null
    const ast = buildDocumentAst(editor.getJSON())
    const format: "odt" | "docx" = documentPath
      ?.toLowerCase()
      .endsWith(".odt")
      ? "odt"
      : "docx"
    const blob =
      format === "odt"
        ? await import("@/lib/export/exportOdt").then(
            ({ createDocumentOdtBlob }) =>
              createDocumentOdtBlob(ast, documentState, docName)
          )
        : await import("@/lib/export/exportDocx").then(
            ({ createDocumentDocxBlob }) =>
              createDocumentDocxBlob(ast, documentState)
          )
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return {
      documentId,
      path: saveAs ? null : documentPath,
      title: docName,
      html: editor.getHTML(),
      markdown: htmlToMarkdown(editor.getHTML()),
      bytes,
      format,
      chatJson: JSON.stringify(chatMessages),
      documentJson: JSON.stringify(documentState),
      createVersion,
      versionReason,
      conflictResolution: "abort" as const,
    }
  }

  const handleSaveDocument = async (saveAs = false) => {
    if (!editor) return
    if (!window.editorDesktop) {
      await handleExport("docx")
      return
    }
    setIsExporting(true)
    try {
      const saveInput = await createDesktopSaveInput(saveAs)
      if (!saveInput) return
      let result = await window.editorDesktop.documents.save(saveInput)
      if (!result) return
      if (result.status === "conflict") {
        saveConflictPathRef.current = result.path
        const modifiedAt = result.externalModifiedAt
          ? new Date(result.externalModifiedAt).toLocaleString()
          : "una fecha desconocida"
        const overwrite = window.confirm(
          `Otro programa modificó este documento en disco (${modifiedAt}).\n\n` +
            "Aceptar: conservar una copia de seguridad del archivo externo y sobrescribirlo.\n" +
            "Cancelar: abrir «Guardar como» para conservar las dos versiones."
        )
        result = overwrite
          ? await window.editorDesktop.documents.save({
              ...saveInput,
              conflictResolution: "overwrite",
            })
          : await window.editorDesktop.documents.save({
              ...saveInput,
              path: null,
              title: `${docName} - copia`,
              conflictResolution: "abort",
              versionReason: "Copia guardada tras conflicto externo",
            })
        if (!result || result.status === "conflict") return
      }
      saveConflictPathRef.current = null
      setDocumentPath(result.path)
      setDocName(result.title)
      setIsDirty(false)
      if (result.path) {
        recordRecentDocument({ path: result.path, title: result.title })
      }
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                path: result.path,
                title: result.title,
                html: editor.getHTML(),
                markdown: htmlToMarkdown(editor.getHTML()),
                documentJson: JSON.stringify(documentState),
                dirty: false,
              }
            : tab
        )
      )
      toast.success("Documento guardado", {
        description: result.conflictBackupPath
          ? `${result.path} · copia externa protegida en ${result.conflictBackupPath}`
          : result.path,
      })
    } catch (error) {
      toast.error("No se pudo guardar el documento", {
        description: error instanceof Error ? error.message : "Error desconocido",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleCloseTab = (id: string) => {
    const tab = tabs.find((candidate) => candidate.id === id)
    if (!tab) return
    const dirty = id === activeTabId ? isDirty : tab.dirty
    if (dirty && !window.confirm(`«${tab.title}» tiene cambios pendientes. ¿Cerrar igualmente?`)) return
    if (tabs.length === 1) {
      const replacementId = createLocalDocumentId()
      const replacement: DocumentTab = {
        id: replacementId,
        title: "Documento sin título",
        path: null,
        html: "",
        markdown: "",
        mode: "welcome",
        prompt: "",
        chatJson: "[]",
        documentJson: JSON.stringify(createDefaultDocumentWorkspaceState()),
        dirty: false,
      }
      setTabs([replacement])
      loadDocumentTab(replacement)
      return
    }
    const remaining = tabs.filter((candidate) => candidate.id !== id)
    setTabs(remaining)
    if (id === activeTabId) loadDocumentTab(remaining[Math.max(0, tabs.indexOf(tab) - 1)])
  }

  const handleRestoreVersion = (version: DocumentVersion) => {
    if (!editor) return
    createRecoveryCheckpoint("Antes de restaurar una versión")
    const workspace = parseDocumentWorkspaceState(version.documentJson)
    editor.commands.setContent(
      normalizeImportedDocxHtml(version.html, workspace),
      { emitUpdate: false }
    )
    setDocumentState(workspace)
    setActiveSectionId(workspace.sections[0].id)
    setResponseText(version.markdown)
    setMode("editing")
    setIsDirty(true)
    toast.success("Versión restaurada", {
      description: "Revisa el documento y guárdalo cuando estés conforme.",
    })
  }

  const handleCancelGeneration = () => {
    generationAbortRef.current?.abort()
    window.editorDesktop?.ai.cancel()
    setGenerationPhase("idle")
    setIsChatSending(false)
    if (status === "streaming") {
      setStatus("done")
      setMode(responseText.trim() ? "editing" : "welcome")
      if (responseText.trim()) editor?.commands.setContent(markdownToHtml(responseText), { emitUpdate: false })
    }
    toast.info("Generación detenida")
  }

  const generateAlternateDraft = async () => {
    const currentDocument = getSerializedDocument().markdown
    if (!requireApiKey() || !currentDocument.trim()) return
    const variantId = createLocalDocumentId()
    setDraftVariant({
      id: variantId,
      title: `Borrador alternativo ${new Date().toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      content: "",
      status: "streaming",
    })
    setDraftComparisonOpen(true)
    const abortController = new AbortController()
    generationAbortRef.current = abortController
    try {
      const { generateStableAnswerStream } = await import("@/lib/gemini-stable")
      const finalText = await generateStableAnswerStream(
        {
          provider: activeProvider,
          apiKey: activeApiKey,
          model: activeGenerationSettings.model,
          systemPrompt: activeGenerationSettings.systemPrompt,
          thinkingLevel: activeGenerationSettings.thinkingLevel,
          temperature: activeGenerationSettings.temperature,
          topP: activeGenerationSettings.topP,
          unrestrictedMode:
            activeGenerationSettings.safetyPreset === "academic",
          prompt:
            "Crea un borrador completo alternativo del documento. Mantén sus ideas y requisitos, pero mejora de forma sustancial la estructura, la argumentación, la cohesión y la calidad de la prosa. Devuelve únicamente el nuevo documento.",
          contextText: currentDocument,
        },
        (accumulated) =>
          setDraftVariant((current) =>
            current?.id === variantId ? { ...current, content: accumulated } : current
          ),
        abortController.signal
      )
      setDraftVariant((current) =>
        current?.id === variantId
          ? { ...current, content: finalText, status: "done" }
          : current
      )
    } catch (error) {
      setDraftVariant((current) =>
        current?.id === variantId
          ? {
              ...current,
              status: "error",
              content: error instanceof Error ? error.message : "No se pudo crear el borrador.",
            }
          : current
      )
    } finally {
      generationAbortRef.current = null
    }
  }

  const createDesktopSaveInputEffect =
    React.useEffectEvent(createDesktopSaveInput)
  const createRecoveryCheckpointEffect = React.useEffectEvent(createRecoveryCheckpoint)
  const handleDesktopMenuCommand = React.useEffectEvent(
    (command: import("@/types/desktop").DesktopMenuCommand, payload?: string) => {
      if (command === "file:new") handleNewDocument()
      if (command === "file:open") void handleOpenDocument(payload)
      if (command === "file:save") void handleSaveDocument(false)
      if (command === "file:saveAs") void handleSaveDocument(true)
      if (command === "file:print") window.print()
      if (command === "file:close") handleCloseTab(activeTabId)
      if (command === "view:history") setVersionsOpen(true)
      if (command === "view:assistant") setChatOpen((value) => !value)
      if (
        command === "view:documentTools" ||
        command === "edit:find" ||
        command === "insert:equation"
      ) {
        setDocumentToolsOpen(true)
      }
      if (command === "insert:pageBreak") handleInsertPageBreak()
      if (command === "insert:sectionBreak") handleInsertSectionBreak("nextPage")
      if (command === "insert:footnote") setFootnotesOpen(true)
      if (command === "insert:references") setReferencesOpen(true)
      if (command === "insert:toc") handleInsertTableOfContents()
      if (command === "review:comment") {
        setReviewOpen(true)
      }
      if (command === "review:trackChanges") {
        updateWorkspaceState((current) => ({
          ...current,
          trackChanges: {
            ...current.trackChanges,
            enabled: !current.trackChanges.enabled,
          },
        }))
        setReviewOpen(true)
      }
      if (command === "ai:newDraft") void generateAlternateDraft()
      if (command === "ai:research") {
        setChatOpen(true)
        void streamChatTurn(
          "Investiga y verifica los principales argumentos del documento. Señala mejoras y aporta fuentes fiables y actuales.",
          undefined,
          undefined,
          "chat",
          { directApply: false }
        )
      }
    }
  )
  const handleAppCommand = React.useEffectEvent((command: AppCommandId) => {
    if (command === "file:new") handleNewDocument()
    if (command === "file:open") void handleOpenDocument()
    if (command === "file:save") void handleSaveDocument(false)
    if (command === "file:saveAs") void handleSaveDocument(true)
    if (command === "file:print") window.print()
    if (command === "file:exportDocx") void handleExport("docx")
    if (command === "file:exportPdf") void handleExport("pdf")

    if (command === "edit:find" || command === "view:documentTools") {
      setDocumentToolsInitialTab("navigate")
      setDocumentToolsOpen(true)
    }
    if (command === "view:mailMerge") {
      setDocumentToolsInitialTab("mailMerge")
      setDocumentToolsOpen(true)
    }
    if (command === "edit:selectAll") {
      editor?.chain().focus().selectAll().run()
    }
    if (command === "edit:clearFormatting") {
      editor?.chain().focus().unsetAllMarks().clearNodes().run()
    }
    if (command === "insert:table") {
      editor
        ?.chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
    }
    if (command === "insert:textBox") {
      const preset = getTextBoxPreset("plain")
      editor
        ?.chain()
        .focus()
        .insertContent({
          type: "textBox",
          attrs: {
            width: 360,
            minHeight: 96,
            align: "center",
            boxPosition: "inline",
            padding: 16,
            background: preset.background,
            borderColor: preset.borderColor,
            borderStyle: preset.borderStyle,
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Escribe aquí" }],
            },
          ],
        })
        .run()
    }
    if (command === "insert:pageBreak") handleInsertPageBreak()
    if (command === "insert:sectionBreak") {
      handleInsertSectionBreak("nextPage")
    }
    if (command === "insert:footnote" || command === "insert:endnote") {
      setFootnotesOpen(true)
    }
    if (command === "insert:toc") handleInsertTableOfContents()
    if (command === "insert:equation") {
      setDocumentToolsInitialTab("academic")
      setDocumentToolsOpen(true)
    }

    if (command === "view:layout") setLayoutOpen(true)
    if (command === "view:references") setReferencesOpen(true)
    if (command === "view:review") handleOpenReview()
    if (command === "view:versions") setVersionsOpen(true)
    if (command === "view:assistant") setChatOpen((value) => !value)
    if (command === "view:accessibility") setAccessibilityOpen(true)
    if (command === "view:focus") setFocusMode((value) => !value)
    if (command === "view:immersiveReader") setImmersiveReaderOpen(true)
    if (command === "view:settings") setSettingsOpen(true)
    if (command === "review:trackChanges") {
      updateWorkspaceState((current) => ({
        ...current,
        trackChanges: {
          ...current.trackChanges,
          enabled: !current.trackChanges.enabled,
        },
      }))
      setReviewOpen(true)
    }

    if (command === "ai:rewrite") handleRibbonAiAction("rewrite")
    if (command === "ai:reviewDocument") {
      setChatOpen(true)
      void streamChatTurn(
        "Audita el documento completo sin reescribirlo todavía. Revisa claridad, estructura, coherencia, tono, precisión, formato y adecuación a su finalidad. Prioriza los cambios por impacto y explica qué función nativa del editor usarías para cada uno.",
        undefined,
        undefined,
        "chat",
        { directApply: false }
      )
    }
    if (command === "ai:research") {
      setChatOpen(true)
      void streamChatTurn(
        "Investiga y verifica las afirmaciones importantes del documento. Señala posibles errores, distingue hechos de opiniones y aporta fuentes fiables y actuales. No modifiques el documento todavía.",
        undefined,
        undefined,
        "chat",
        { directApply: false }
      )
    }
    if (command === "ai:formatDocument") {
      setChatOpen(true)
      void streamChatTurn(
        "Analiza el tipo y propósito de este documento y prepara una propuesta de formato profesional usando únicamente las acciones nativas disponibles: estilos, títulos, párrafos, diseño de página, tablas, secciones, encabezados, pies, numeración y campos. No cambies el contenido ni apliques nada automáticamente; presenta acciones revisables.",
        undefined,
        undefined,
        "chat",
        { directApply: false }
      )
    }
  })

  const handleApplyStyleTheme = (themeId: DocumentStyleThemeId) => {
    updateWorkspaceState((current) => ({
      ...current,
      styles: applyDocumentStyleTheme(current.styles, themeId),
    }))
    setIsDirty(true)
    toast.success("Tema del documento aplicado", {
      description:
        "Los estilos siguen siendo editables y se conservarán al exportar a Word.",
    })
  }
  const loadDetachedDocument = React.useEffectEvent((detachedDocumentId: string) => {
    if (!window.editorDesktop) return
    void window.editorDesktop.documents.loadRecovery(detachedDocumentId).then((recovery) => {
      if (!recovery) return
      const tab: DocumentTab = {
        id: recovery.documentId,
        title: recovery.title,
        path: recovery.path ?? null,
        html: recovery.html,
        markdown: recovery.markdown,
        mode: "editing",
        prompt: "",
        chatJson: recovery.chatJson ?? "[]",
        documentJson: recovery.documentJson ?? "{}",
        dirty: false,
      }
      setTabs([tab])
      loadDocumentTab(tab)
    })
  })

  React.useEffect(() => {
    if (!window.editorDesktop || !editor || mode !== "editing") return
    let timeout = 0
    let idleHandle = 0
    let disposed = false

    const persistAfterTyping = async () => {
      const html = editor.getHTML()
      const markdown = htmlToMarkdown(html)
      await window.editorDesktop?.documents.saveRecovery({
        documentId,
        path: documentPath,
        title: docName,
        html,
        markdown,
        chatJson: JSON.stringify(chatMessages),
        documentJson: JSON.stringify(documentState),
      })
      if (disposed) return
      if (isDirty && documentPath && !isExporting) {
        try {
          const saveInput = await createDesktopSaveInputEffect(
            false,
            false,
            "Autoguardado"
          )
          const result = saveInput
            ? await window.editorDesktop?.documents.save(saveInput)
            : null
          if (disposed) return
          if (result?.status === "saved") {
            saveConflictPathRef.current = null
            setIsDirty(false)
            setTabs((currentTabs) =>
              currentTabs.map((tab) =>
                tab.id === activeTabId
                  ? {
                      ...tab,
                      dirty: false,
                      html,
                      markdown,
                      documentJson: JSON.stringify(documentState),
                    }
                  : tab
              )
            )
          } else if (
            result?.status === "conflict" &&
            saveConflictPathRef.current !== result.path
          ) {
            saveConflictPathRef.current = result.path
            toast.warning("Autoguardado detenido por un cambio externo", {
              description:
                "La recuperación local está a salvo. Usa Guardar para elegir entre conservar ambas versiones o sobrescribir con copia de seguridad.",
            })
          }
        } catch {
          // La recuperación local ya quedó guardada; el siguiente intento volverá a escribir el DOCX.
        }
      }
    }

    const schedule = () => {
      window.clearTimeout(timeout)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
        idleHandle = 0
      }
      timeout = window.setTimeout(() => {
        timeout = 0
        if ("requestIdleCallback" in window) {
          idleHandle = window.requestIdleCallback(
            () => {
              idleHandle = 0
              void persistAfterTyping()
            },
            { timeout: 1_500 }
          )
        } else {
          void persistAfterTyping()
        }
      }, 2_000)
    }

    schedule()
    editor.on("update", schedule)
    return () => {
      disposed = true
      window.clearTimeout(timeout)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
      }
      editor.off("update", schedule)
    }
  }, [
    activeTabId,
    chatMessages,
    docName,
    documentId,
    documentPath,
    editor,
    isDirty,
    isExporting,
    mode,
    documentState,
  ])

  React.useEffect(() => {
    if (!window.editorDesktop || !editor || mode !== "editing") return
    const interval = window.setInterval(() => {
      if (isDirty) createRecoveryCheckpointEffect("Punto de restauración periódico")
    }, 10 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [editor, isDirty, mode])

  React.useEffect(() => {
    if (!window.editorDesktop) return
    return window.editorDesktop.onMenuCommand(handleDesktopMenuCommand)
  }, [])

  React.useEffect(() => {
    if (!window.editorDesktop || !editor) return
    const detachedDocumentId = new URLSearchParams(window.location.search).get("document")
    if (!detachedDocumentId || detachedDocumentId === documentId) return
    loadDetachedDocument(detachedDocumentId)
  }, [documentId, editor])

  /**
   * Controladores de identidad estable para la cinta. Sin ellos `React.memo`
   * no serviría de nada: una función creada en línea es una prop nueva en cada
   * render, así que la comparación superficial fallaría siempre.
   */
  const ribbonOpenBackstage = useStableCallback(() => setBackstageOpen(true))
  const ribbonOpenAi = useStableCallback(() => setChatOpen(true))
  const ribbonAiAction = useStableCallback((actionId: string) =>
    handleRibbonAiAction(actionId)
  )
  const ribbonOpenReferences = useStableCallback(() => setReferencesOpen(true))
  const ribbonOpenVersions = useStableCallback(() => setVersionsOpen(true))
  const ribbonOpenLayout = useStableCallback((section?: LayoutFocusSection) => {
    setLayoutFocusSection(section)
    setLayoutOpen(true)
  })
  const ribbonOpenReview = useStableCallback(
    (preservedSelection: { from: number; to: number } | null = null) =>
      handleOpenReview(preservedSelection)
  )
  const ribbonOpenAccessibility = useStableCallback(() =>
    setAccessibilityOpen(true)
  )
  const ribbonOpenImmersiveReader = useStableCallback(() =>
    setImmersiveReaderOpen(true)
  )
  const ribbonInsertTableOfContents = useStableCallback(() =>
    handleInsertTableOfContents()
  )
  const ribbonOpenFootnotes = useStableCallback(() => setFootnotesOpen(true))
  const ribbonInsertPageBreak = useStableCallback(() => handleInsertPageBreak())
  const ribbonOpenDocumentTools = useStableCallback((tab?: DocumentToolsTab) => {
    setDocumentToolsInitialTab(tab ?? "navigate")
    setDocumentToolsOpen(true)
  })
  const ribbonOpenFind = useStableCallback(() => {
    setFindReplaceVisible(false)
    setFindOpen(true)
  })
  const ribbonToggleFormFillMode = useStableCallback(() =>
    setFormFillMode((value) => !value)
  )

  /**
   * Crea el gráfico con los datos de la tabla donde está el cursor. Sin
   * asistente ni rejilla: los datos ya los ha escrito el usuario, y pedirle que
   * los vuelva a teclear en un cuadro de diálogo es justo la fricción que hace
   * que en Word casi nadie inserte un gráfico.
   */
  const ribbonInsertChartFromTable = useStableCallback(
    async (kind: "bar" | "line" | "pie") => {
      if (!editor) return
      const rows = selectedTableRows(editor)
      if (!rows) {
        toast.info("Coloca el cursor dentro de una tabla", {
          description: "El gráfico toma sus datos de la tabla donde escribes.",
        })
        return
      }
      const { extractChartDataFromRows } = await import("@/lib/chart")
      const data = extractChartDataFromRows(rows)
      if (!data) {
        toast.warning("No se han encontrado datos numéricos", {
          description:
            "La tabla necesita una fila de cabecera, nombres en la primera columna y una columna de números.",
        })
        return
      }
      editor
        .chain()
        .focus()
        .insertDocumentChart({ ...data, kind, title: data.seriesName })
        .run()
      setIsDirty(true)
      toast.success(
        `Gráfico creado con ${data.values.length} valores de «${data.seriesName}»`
      )
    }
  )

  /**
   * Empaqueta una combinación de correspondencia con un archivo por
   * destinatario. Va en un ZIP y no en descargas sueltas porque treinta
   * descargas seguidas son treinta avisos del navegador, y porque lo que el
   * usuario quiere mover de sitio es la tanda entera.
   */
  const exportMergedDocuments = useStableCallback(
    async (
      documents: Array<{ name: string; html: string }>,
      format: "docx" | "pdf",
      batchName: string
    ) => {
      if (!editor || documents.length === 0) return
      const [{ default: JSZip }, { buildDocumentAst: buildAst }] =
        await Promise.all([
          import("jszip"),
          import("@/lib/export/document-ast"),
        ])
      const createBlob =
        format === "docx"
          ? (await import("@/lib/export/exportDocx")).createDocumentDocxBlob
          : (await import("@/lib/export/exportPdf")).createDocumentPdfBlob

      const zip = new JSZip()
      const container = document.createElement("div")
      for (const item of documents) {
        container.innerHTML = item.html
        const json = ProseMirrorDOMParser.fromSchema(editor.schema)
          .parse(container)
          .toJSON() as JSONContent
        const blob = await createBlob(buildAst(json), documentState)
        zip.file(`${item.name}.${format}`, await blob.arrayBuffer())
      }

      downloadBlob(
        `${slugifyFilename(batchName)}.zip`,
        await zip.generateAsync({ type: "blob" })
      )
    }
  )
  const ribbonOpenWritingTools = useStableCallback(() => {
    setDocumentToolsInitialTab("writing")
    setDocumentToolsOpen(true)
  })
  const ribbonOpenMailMerge = useStableCallback(() => {
    setDocumentToolsInitialTab("mailMerge")
    setDocumentToolsOpen(true)
  })
  const ribbonToggleFocusMode = useStableCallback(() =>
    setFocusMode((value) => !value)
  )
  const ribbonAddStyle = useStableCallback(
    (style: Omit<DocumentStyleDefinition, "id">) => addCustomStyle(style)
  )
  const ribbonUpdateStyle = useStableCallback(
    (
      styleId: string,
      patch: Partial<Omit<DocumentStyleDefinition, "id">>
    ) => updateStyle(styleId, patch)
  )
  const ribbonDeleteStyle = useStableCallback((styleId: string) =>
    deleteStyle(styleId)
  )
  const ribbonLayoutChange = useStableCallback((layout: DocumentLayoutSettings) =>
    setDocumentLayout(layout)
  )
  const ribbonPageAppearanceChange = useStableCallback(
    (pageAppearance: DocumentWorkspaceState["pageAppearance"]) =>
      updateWorkspaceState((current) => ({ ...current, pageAppearance }))
  )
  const ribbonApplyStyleTheme = useStableCallback((themeId: DocumentStyleThemeId) =>
    handleApplyStyleTheme(themeId)
  )

  const canExport = mode === "editing" && documentTextLength > 0
  const aiContextPreview: AiContextPreview = {
    documentCharacters: documentTextLength,
    selectionCharacters: pendingFragment?.length ?? 0,
    editorStateCharacters: JSON.stringify({
      layout: documentState.layout,
      sections: documentState.sections,
      styles: documentState.styles,
      comments: documentState.comments,
      footnotes: documentState.footnotes,
      endnotes: documentState.endnotes,
      bibliography: documentState.bibliography.sources,
      writingAssistant: documentState.writingAssistant,
      autocorrect: documentState.autocorrect,
      outlineNumbering: documentState.outlineNumbering,
      trackChanges: documentState.trackChanges,
    }).length,
    attachmentCount: attachments.filter(
      (attachment) => attachment.status === "ready" && attachment.text.trim()
    ).length,
    attachmentCharacters: attachments
      .filter(
        (attachment) =>
          attachment.status === "ready" && attachment.text.trim()
      )
      .reduce((total, attachment) => total + attachment.text.length, 0),
    historyTurns: chatMessages.filter((message) => message.status === "done")
      .length,
  }

  return (
    <div
      className={`relative flex h-screen flex-col bg-background${
        formFillMode ? " form-fill-mode" : ""
      }`}
      data-focus-mode={focusMode ? "true" : "false"}
    >
      <React.Activity mode={focusMode ? "hidden" : "visible"}>
      <TitleBar
        documentTabs={
          <DocumentTabs
            tabs={tabs.map((tab) =>
              tab.id === activeTabId
                ? { ...tab, title: docName, path: documentPath, dirty: isDirty }
                : tab
            )}
            activeId={activeTabId}
            onSelect={handleSwitchTab}
            onClose={handleCloseTab}
            onNew={handleNewDocument}
            onRename={(_, title) => setDocName(title)}
            onDetach={
              window.editorDesktop
                ? (id) => {
                    snapshotActiveTab()
                    createRecoveryCheckpoint("Documento separado a otra ventana")
                    void window.editorDesktop?.windows.detachDocument(id)
                  }
                : undefined
            }
          />
        }
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenDocument={window.editorDesktop ? () => void handleOpenDocument() : undefined}
        onSaveDocument={window.editorDesktop ? () => void handleSaveDocument(false) : undefined}
        onUndo={
          editor ? () => editor.chain().focus().undo().run() : undefined
        }
        onRedo={
          editor ? () => editor.chain().focus().redo().run() : undefined
        }
        canUndo={Boolean(editor?.can().undo())}
        canRedo={Boolean(editor?.can().redo())}
        onToggleAi={() => setChatOpen((v) => !v)}
        aiOpen={chatOpen}
        canExport={canExport}
        isDirty={isDirty}
        editing={mode === "editing"}
        desktop={Boolean(window.editorDesktop)}
        onCommand={handleAppCommand}
      />

      {mode === "editing" && (
        <EditorToolbar
          key={activeTabId}
          editor={editor}
          onOpenBackstage={ribbonOpenBackstage}
          onAiOpen={ribbonOpenAi}
          onAiAction={ribbonAiAction}
          onOpenReferences={ribbonOpenReferences}
          onOpenVersions={ribbonOpenVersions}
          onOpenLayout={ribbonOpenLayout}
          onOpenReview={ribbonOpenReview}
          onOpenAccessibility={ribbonOpenAccessibility}
          onOpenImmersiveReader={ribbonOpenImmersiveReader}
          onInsertTableOfContents={ribbonInsertTableOfContents}
          onOpenFootnotes={ribbonOpenFootnotes}
          onInsertPageBreak={ribbonInsertPageBreak}
          onOpenDocumentTools={ribbonOpenDocumentTools}
          onOpenFind={ribbonOpenFind}
          onInsertChartFromTable={ribbonInsertChartFromTable}
          formFillMode={formFillMode}
          onToggleFormFillMode={ribbonToggleFormFillMode}
          onOpenWritingTools={ribbonOpenWritingTools}
          onOpenMailMerge={ribbonOpenMailMerge}
          onToggleFocusMode={ribbonToggleFocusMode}
          focusMode={focusMode}
          trackChanges={documentState.trackChanges.enabled}
          styles={documentState.styles}
          onAddStyle={ribbonAddStyle}
          onUpdateStyle={ribbonUpdateStyle}
          onDeleteStyle={ribbonDeleteStyle}
          layout={documentLayout}
          pageAppearance={documentState.pageAppearance}
          onLayoutChange={ribbonLayoutChange}
          onPageAppearanceChange={ribbonPageAppearanceChange}
          onApplyStyleTheme={ribbonApplyStyleTheme}
        />
      )}
      </React.Activity>

      <div className="flex min-h-0 flex-1">
        <DocumentCanvas
          editor={editor}
          mode={mode}
          responseText={responseText}
          generationPhase={generationPhase}
          starter={{
            prompt,
            onPromptChange: setPrompt,
            attachments,
            onFilesSelected: handleFilesSelected,
            onRemoveAttachment: handleRemoveAttachment,
            onAttachmentRoleChange: handleAttachmentRoleChange,
            onGenerate: handleGenerate,
            onStartBlank: handleStartBlank,
            onStartTemplate: handleStartTemplate,
            isGenerating: status === "streaming",
            canGenerate: prompt.trim().length > 0 || hasReadyAttachment,
            errorMessage,
            workspaceMode,
            onWorkspaceModeChange: setWorkspaceMode,
            analysis: exerciseAnalysis,
            analysisStatus,
            onAnalysisChange: setExerciseAnalysis,
            onAnalyze: () => {
              toast.info(
                "El análisis separado está desactivado en el núcleo estable; el modelo interpretará los requisitos dentro de la única llamada de generación."
              )
            },
            geminiConfigured: Boolean(activeApiKey.trim()),
            onConfigureGemini: () => setSettingsOpen(true),
            modelLabel,
            recentDocuments,
            onOpenRecent: (path: string) => void handleOpenDocument(path),
            onRemoveRecent: removeRecentDocument,
            onBrowseDocuments: window.editorDesktop
              ? () => void handleOpenDocument()
              : undefined,
          }}
          onSelectFragment={handleSelectFragment}
          onFragmentAction={handleFragmentAction}
          layout={documentLayout}
          pageAppearance={documentState.pageAppearance}
          section={activeSection}
          styles={documentState.styles}
          showMarkup={documentState.trackChanges.showMarkup}
          overlay={
            mode === "editing" && findOpen ? (
              <FindBar
                editor={editor}
                showReplace={findReplaceVisible}
                onClose={() => setFindOpen(false)}
                onToggleReplace={() =>
                  setFindReplaceVisible((visible) => !visible)
                }
                onReplaced={(count) => {
                  setIsDirty(true)
                  toast.success(
                    count === 1
                      ? "1 coincidencia reemplazada"
                      : `${count} coincidencias reemplazadas`
                  )
                }}
              />
            ) : null
          }
        />

        <React.Activity mode={focusMode ? "hidden" : "visible"}>
        <AiSidePanel expanded={chatOpen} onToggle={() => setChatOpen((v) => !v)} modelLabel={modelLabel}>
          <GeminiPanel
            messages={chatMessages}
            pendingFragment={pendingFragment}
            onClearPendingFragment={() => {
              setPendingFragment(null)
              setPendingRange(null)
            }}
            onSend={handleSendChatMessage}
            onApplyEdit={handleApplyEdit}
            onInsert={handleInsert}
            onReplaceAll={handleReplaceAll}
            onApplyEditorActions={async (messageId, actions, quotedRange) => {
              await handleApplyEditorActions(actions, quotedRange)
              setChatMessages((current) =>
                current.map((message) =>
                  message.id === messageId
                    ? { ...message, editorActionsApplied: true }
                    : message
                )
              )
            }}
            attachments={attachments}
            onFilesSelected={handleFilesSelected}
            onRemoveAttachment={handleRemoveAttachment}
            isSending={isChatSending}
            onCancel={handleCancelGeneration}
            onNewChat={() => {
              if (chatMessages.length === 0 || window.confirm("¿Empezar una conversación nueva?")) {
                resetChat()
              }
            }}
            contextPreview={aiContextPreview}
            profileId={assistantProfileId}
            onProfileChange={setAssistantProfileId}
            providerState={resolvedProfileProvider}
            providerModelLabel={profileModelLabel}
            canSwitchProvider={
              providerAvailability.gemini && providerAvailability.openrouter
            }
            onSwitchProvider={() =>
              setProfileProviderOverride((current) => ({
                ...current,
                [assistantProfileId]:
                  resolvedProfileProvider.provider === "openrouter"
                    ? "gemini"
                    : "openrouter",
              }))
            }
            onRevealFragment={() => {
              if (!editor || !pendingRange) return
              const { from, to } = pendingRange
              if (from < 0 || to > editor.state.doc.content.size) {
                toast.info("El fragmento ya no existe en el documento")
                return
              }
              editor.chain().focus().setTextSelection({ from, to }).run()
              editor.view.dispatch(
                editor.state.tr.scrollIntoView()
              )
            }}
            onAddResearchSource={(source) => {
              const incoming = createCitationSource({
                author: "",
                title: source.title,
                year: "",
                publisher: "",
                url: source.url,
              })
              const result = deduplicateCitationSources(
                [...documentState.bibliography.sources, incoming],
                92
              )
              handleBibliographyChange(
                {
                  ...documentState.bibliography,
                  sources: result.sources,
                },
                result.replacements
              )
              toast.success(
                result.mergedCount > 0
                  ? "La fuente ya existía y se ha unificado"
                  : "Fuente añadida sin duplicados",
                {
                  description:
                    "Completa autor, año y publicación desde Referencias.",
                }
              )
            }}
          />
        </AiSidePanel>
        </React.Activity>
      </div>

      {focusMode && mode === "editing" && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="absolute right-4 top-4 z-40 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Salir del modo Enfoque"
          title="Salir del modo Enfoque (Esc)"
        >
          Salir de Enfoque · Esc
        </button>
      )}

      <React.Activity mode={focusMode ? "hidden" : "visible"}>
      <StatusBar
        editor={editor}
        status={status}
        modelLabel={modelLabel}
        proofingLanguage={documentState.proofingLanguage}
        layout={documentLayout}
        onLayoutChange={setDocumentLayout}
        immersiveReaderOpen={immersiveReaderOpen}
        onImmersiveReaderChange={setImmersiveReaderOpen}
        onProofingLanguageChange={(proofingLanguage, scope, range) => {
          if (scope === "selection") {
            if (!editor || !range) return
            editor
              .chain()
              .setTextSelection(range)
              .setMark("proofingLanguage", { language: proofingLanguage })
              .focus()
              .run()
            return
          }
          updateWorkspaceState((current) => ({
            ...current,
            proofingLanguage,
          }))
        }}
      />
      </React.Activity>

      {settingsOpen && (
        <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}
      {backstageOpen && (
        <FileBackstage
          open={backstageOpen}
          onOpenChange={setBackstageOpen}
          documentTitle={docName}
          documentPath={documentPath}
          isDirty={isDirty}
          editing={mode === "editing"}
          desktop={Boolean(window.editorDesktop)}
          canExport={canExport}
          onCommand={handleAppCommand}
          onExport={handleExport}
          onOpenVersions={() => setVersionsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {historyOpen && (
        <HistorySidebar
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          onLoad={handleLoadHistoryEntry}
        />
      )}
      {versionsOpen && (
        <VersionSidebar
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
          documentId={documentId}
          onRestore={handleRestoreVersion}
        />
      )}
      {draftComparisonOpen && (
        <DraftComparison
          open={draftComparisonOpen}
          onOpenChange={setDraftComparisonOpen}
          currentText={getSerializedDocument().markdown}
          variant={draftVariant}
          onRegenerate={() => void generateAlternateDraft()}
          onAccept={(content) => {
            handleReplaceAll(content)
            setDraftComparisonOpen(false)
            toast.success("Borrador alternativo aplicado")
          }}
        />
      )}
      {immersiveReaderOpen && (
        <ImmersiveReader
          open={immersiveReaderOpen}
          onOpenChange={setImmersiveReaderOpen}
          editor={editor}
          documentTitle={docName}
        />
      )}
      {referencesOpen && <CitationSidebar
        open={referencesOpen}
        onOpenChange={setReferencesOpen}
        bibliography={documentState.bibliography}
        onBibliographyChange={handleBibliographyChange}
        onInsertCitation={handleInsertCitation}
        onInsertBibliography={handleInsertBibliography}
      />}
      {footnotesOpen && <FootnoteSidebar
        open={footnotesOpen}
        onOpenChange={setFootnotesOpen}
        footnotes={documentState.footnotes}
        onInsert={handleInsertFootnote}
        onUpdate={handleUpdateFootnote}
        onDelete={handleDeleteFootnote}
        endnotes={documentState.endnotes}
        onInsertEndnote={handleInsertEndnote}
        onUpdateEndnote={handleUpdateEndnote}
        onDeleteEndnote={handleDeleteEndnote}
      />}
      {layoutOpen && <LayoutSidebar
        key={activeSectionId}
        open={layoutOpen}
        onOpenChange={(open) => {
          setLayoutOpen(open)
          if (!open) setLayoutFocusSection(undefined)
        }}
        state={documentState}
        activeSectionId={activeSectionId}
        onChange={updateWorkspaceState}
        onInsertSectionBreak={handleInsertSectionBreak}
        onCreateThesisStructure={handleCreateThesisStructure}
        focusSection={layoutFocusSection}
      />}
      {reviewOpen && <ReviewSidebar
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open)
          if (!open) setReviewSelectionAvailable(false)
        }}
        editor={editor}
        comments={documentState.comments}
        author={documentState.trackChanges.author}
        trackChanges={documentState.trackChanges.enabled}
        showMarkup={documentState.trackChanges.showMarkup}
        hasPreservedSelection={reviewSelectionAvailable}
        importedRevisionSummary={documentState.importedRevisionSummary}
        onAuthorChange={(author) =>
          updateWorkspaceState((current) => ({
            ...current,
            trackChanges: { ...current.trackChanges, author },
          }))
        }
        onTrackChangesChange={(enabled) =>
          updateWorkspaceState((current) => ({
            ...current,
            trackChanges: { ...current.trackChanges, enabled },
          }))
        }
        onShowMarkupChange={(showMarkup) =>
          updateWorkspaceState((current) => ({
            ...current,
            trackChanges: { ...current.trackChanges, showMarkup },
          }))
        }
        onAddComment={handleAddComment}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
        onReplyComment={handleReplyComment}
        onSelectComment={handleSelectComment}
        onDetachComments={handleDetachComments}
        onReanchorComment={handleReanchorComment}
      />}
      {accessibilityOpen && <AccessibilitySidebar
        open={accessibilityOpen}
        onOpenChange={setAccessibilityOpen}
        editor={editor}
        documentTitle={docName}
        language={documentState.proofingLanguage}
      />}
      {documentToolsOpen && <DocumentToolsSidebar
        open={documentToolsOpen}
        onOpenChange={(open) => {
          setDocumentToolsOpen(open)
          if (!open) setDocumentToolsInitialTab("navigate")
        }}
        initialTab={documentToolsInitialTab}
        editor={editor}
        outlineNumbering={documentState.outlineNumbering}
        proofingLanguage={documentState.proofingLanguage}
        writingAssistant={documentState.writingAssistant}
        autocorrect={documentState.autocorrect}
        onOutlineNumberingChange={(outlineNumbering) =>
          updateWorkspaceState((current) => ({
            ...current,
            outlineNumbering,
          }))
        }
        onWritingAssistantChange={(writingAssistant) =>
          updateWorkspaceState((current) => ({
            ...current,
            writingAssistant,
          }))
        }
        onAutoCorrectChange={(autocorrect) =>
          updateWorkspaceState((current) => ({
            ...current,
            autocorrect,
          }))
        }
        onInsertCaption={handleInsertCaption}
        onInsertEquation={handleInsertEquation}
        onInsertCrossReference={handleInsertCrossReference}
        onReplaceDocument={handleReplaceDocumentContent}
        onCreateDocument={handleCreateDocumentFromHtml}
        onExportMergedDocuments={exportMergedDocuments}
      />}
    </div>
  )
}
