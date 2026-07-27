import {
  EMPTY_BIBLIOGRAPHY,
  type CitationSource,
  type CitationStyle,
  type DocumentBibliography,
} from "./citation"

export type PageSize = "a4" | "letter"
export type PageOrientation = "portrait" | "landscape"
export type SectionBreakType = "nextPage" | "continuous" | "evenPage" | "oddPage"
export type LineNumberRestartMode =
  | "none"
  | "continuous"
  | "newPage"
  | "newSection"
export type PageNumberPosition = "none" | "header-left" | "header-center" | "header-right" | "footer-left" | "footer-center" | "footer-right"
export type PageNumberFormat =
  | "decimal"
  | "lowerRoman"
  | "upperRoman"
  | "lowerLetter"
  | "upperLetter"

export const PROOFING_LANGUAGE_OPTIONS = [
  { value: "es-ES", label: "Español (España)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "ca-ES", label: "Català" },
  { value: "gl-ES", label: "Galego" },
  { value: "eu-ES", label: "Euskara" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "it-IT", label: "Italiano" },
  { value: "pt-PT", label: "Português" },
] as const

export interface PageMargins {
  top: number
  right: number
  bottom: number
  left: number
  header: number
  footer: number
}

export interface LineNumberSettings {
  mode: LineNumberRestartMode
  start: number
  countBy: number
  distance: number
}

export type PageBorderStyle = "none" | "solid" | "double" | "dashed"

export interface PageAppearanceSettings {
  color: string
  borderStyle: PageBorderStyle
  borderColor: string
  borderWidth: number
  watermarkText: string
  watermarkColor: string
  watermarkOpacity: number
  watermarkAngle: number
  hyphenation: boolean
}

export interface DocumentLayoutSettings {
  pageSize: PageSize
  orientation: PageOrientation
  /**
   * Compatibilidad con documentos de la v0.1. Para documentos nuevos se
   * utilizan `margins`; al cambiar un preset se actualizan ambos valores.
   */
  margin: number
  margins: PageMargins
  columns: 1 | 2 | 3
  columnGap: number
  zoom: number
  showRuler: boolean
  showFormattingMarks: boolean
  lineNumbers: LineNumberSettings
}

export interface HeaderFooterContent {
  default: string
  first: string
  even: string
}

export interface DocumentSection {
  id: string
  name: string
  breakType: SectionBreakType
  layout: DocumentLayoutSettings
  header: HeaderFooterContent
  footer: HeaderFooterContent
  differentFirstPage: boolean
  differentOddEven: boolean
  pageNumberPosition: PageNumberPosition
  pageNumberFormat: PageNumberFormat
  pageNumberStart?: number
}

export interface DocumentCommentReply {
  id: string
  author: string
  text: string
  createdAt: string
}

export interface DocumentComment {
  id: string
  author: string
  initials: string
  text: string
  createdAt: string
  resolved: boolean
  replies: DocumentCommentReply[]
  anchorText?: string
  orphaned?: boolean
}

export interface DocumentFootnote {
  id: string
  number: number
  text: string
}

export interface DocumentEndnote {
  id: string
  number: number
  text: string
}

export interface DocumentStyleDefinition {
  id: string
  name: string
  basedOn?: string
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  color?: string
  spacingBefore?: number
  spacingAfter?: number
  lineHeight?: number
  keepWithNext?: boolean
}

export interface TrackChangesSettings {
  enabled: boolean
  author: string
  showMarkup: boolean
}

export interface OutlineNumberingSettings {
  enabled: boolean
  maxLevel: 1 | 2 | 3 | 4 | 5 | 6
  separator: "." | "-"
}

export type WritingRuleId =
  | "repeated-word"
  | "multiple-spaces"
  | "space-before-punctuation"
  | "long-sentence"

export interface WritingAssistantSettings {
  disabledRules: WritingRuleId[]
  ignoredIssues: string[]
  longSentenceThreshold: 45 | 60 | 75 | null
}

export interface AutoCorrectReplacement {
  id: string
  from: string
  to: string
  caseSensitive: boolean
}

export interface AutoCorrectSettings {
  enabled: boolean
  capitalizeSentences: boolean
  smartQuotes: boolean
  smartDashes: boolean
  replacements: AutoCorrectReplacement[]
}

export interface ImportedRevisionSummary {
  insertions: number
  deletions: number
}

export interface DocumentWorkspaceState {
  schemaVersion: 8
  proofingLanguage: string
  layout: DocumentLayoutSettings
  pageAppearance: PageAppearanceSettings
  sections: DocumentSection[]
  comments: DocumentComment[]
  footnotes: DocumentFootnote[]
  endnotes: DocumentEndnote[]
  styles: DocumentStyleDefinition[]
  bibliography: DocumentBibliography
  outlineNumbering: OutlineNumberingSettings
  writingAssistant: WritingAssistantSettings
  autocorrect: AutoCorrectSettings
  trackChanges: TrackChangesSettings
  importedRevisionSummary?: ImportedRevisionSummary
}

export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 72,
  right: 72,
  bottom: 72,
  left: 72,
  header: 36,
  footer: 36,
}

export const DEFAULT_DOCUMENT_LAYOUT: DocumentLayoutSettings = {
  pageSize: "a4",
  orientation: "portrait",
  margin: 72,
  margins: DEFAULT_PAGE_MARGINS,
  columns: 1,
  columnGap: 36,
  zoom: 1,
  showRuler: true,
  showFormattingMarks: false,
  lineNumbers: {
    mode: "none",
    start: 1,
    countBy: 1,
    distance: 24,
  },
}

export const DEFAULT_PAGE_APPEARANCE: PageAppearanceSettings = {
  color: "#ffffff",
  borderStyle: "none",
  borderColor: "#808080",
  borderWidth: 1,
  watermarkText: "",
  watermarkColor: "#808080",
  watermarkOpacity: 0.16,
  watermarkAngle: -35,
  hyphenation: false,
}

export const DEFAULT_AUTOCORRECT_SETTINGS: AutoCorrectSettings = {
  enabled: true,
  capitalizeSentences: true,
  smartQuotes: true,
  smartDashes: true,
  replacements: [
    {
      id: "autocorrect-copyright",
      from: "(c)",
      to: "©",
      caseSensitive: false,
    },
    {
      id: "autocorrect-registered",
      from: "(r)",
      to: "®",
      caseSensitive: false,
    },
    {
      id: "autocorrect-trademark",
      from: "(tm)",
      to: "™",
      caseSensitive: false,
    },
  ],
}

export const BUILT_IN_DOCUMENT_STYLES: DocumentStyleDefinition[] = [
  {
    id: "Normal",
    name: "Normal",
    fontFamily: "Calibri",
    fontSize: 11,
    spacingAfter: 8,
    lineHeight: 1.15,
  },
  {
    id: "NoSpacing",
    name: "Sin espacio",
    basedOn: "Normal",
    fontFamily: "Calibri",
    fontSize: 11,
    spacingAfter: 0,
    lineHeight: 1,
  },
  {
    id: "Title",
    name: "Título",
    basedOn: "Normal",
    fontFamily: "Calibri Light",
    fontSize: 28,
    color: "2F5496",
    spacingAfter: 12,
    keepWithNext: true,
  },
  {
    id: "Subtitle",
    name: "Subtítulo",
    basedOn: "Normal",
    fontFamily: "Calibri",
    fontSize: 14,
    italic: true,
    color: "666666",
    spacingAfter: 12,
    keepWithNext: true,
  },
  {
    id: "Heading1",
    name: "Título 1",
    basedOn: "Normal",
    fontFamily: "Calibri Light",
    fontSize: 18,
    bold: true,
    color: "2F5496",
    spacingBefore: 12,
    spacingAfter: 4,
    keepWithNext: true,
  },
  {
    id: "Heading2",
    name: "Título 2",
    basedOn: "Normal",
    fontFamily: "Calibri Light",
    fontSize: 15,
    bold: true,
    color: "2F5496",
    spacingBefore: 10,
    spacingAfter: 3,
    keepWithNext: true,
  },
  {
    id: "Heading3",
    name: "Título 3",
    basedOn: "Normal",
    fontFamily: "Calibri",
    fontSize: 13,
    bold: true,
    color: "1F3763",
    spacingBefore: 8,
    spacingAfter: 2,
    keepWithNext: true,
  },
  {
    id: "Quote",
    name: "Cita",
    basedOn: "Normal",
    fontFamily: "Georgia",
    fontSize: 11,
    italic: true,
    color: "555555",
    spacingBefore: 8,
    spacingAfter: 8,
  },
  {
    id: "Bibliography",
    name: "Bibliografía",
    basedOn: "Normal",
    fontFamily: "Times New Roman",
    fontSize: 12,
    spacingAfter: 6,
    lineHeight: 1.15,
  },
]

function cloneLayout(layout: DocumentLayoutSettings): DocumentLayoutSettings {
  return {
    ...layout,
    margins: { ...layout.margins },
  }
}

export function createDefaultDocumentWorkspaceState(): DocumentWorkspaceState {
  const layout = cloneLayout(DEFAULT_DOCUMENT_LAYOUT)
  return {
    schemaVersion: 8,
    proofingLanguage: "es-ES",
    layout,
    pageAppearance: { ...DEFAULT_PAGE_APPEARANCE },
    sections: [
      {
        id: "section-default",
        name: "Sección 1",
        breakType: "nextPage",
        layout: cloneLayout(layout),
        header: { default: "", first: "", even: "" },
        footer: { default: "", first: "", even: "" },
        differentFirstPage: false,
        differentOddEven: false,
        pageNumberPosition: "footer-center",
        pageNumberFormat: "decimal",
      },
    ],
    comments: [],
    footnotes: [],
    endnotes: [],
    styles: BUILT_IN_DOCUMENT_STYLES.map((style) => ({ ...style })),
    bibliography: {
      style: EMPTY_BIBLIOGRAPHY.style,
      styleTitle: EMPTY_BIBLIOGRAPHY.styleTitle,
      styleClass: EMPTY_BIBLIOGRAPHY.styleClass,
      locale: EMPTY_BIBLIOGRAPHY.locale,
      sources: [],
      zoteroSync: {},
    },
    outlineNumbering: {
      enabled: false,
      maxLevel: 3,
      separator: ".",
    },
    writingAssistant: {
      disabledRules: [],
      ignoredIssues: [],
      longSentenceThreshold: 60,
    },
    autocorrect: {
      ...DEFAULT_AUTOCORRECT_SETTINGS,
      replacements: DEFAULT_AUTOCORRECT_SETTINGS.replacements.map(
        (replacement) => ({ ...replacement })
      ),
    },
    trackChanges: {
      enabled: false,
      author: "Autor",
      showMarkup: true,
    },
  }
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === "string" &&
    /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback
}

function normalizePageAppearance(
  input: Partial<PageAppearanceSettings> | undefined
): PageAppearanceSettings {
  const borderStyle = input?.borderStyle
  return {
    color: normalizeHexColor(input?.color, DEFAULT_PAGE_APPEARANCE.color),
    borderStyle:
      borderStyle === "solid" ||
      borderStyle === "double" ||
      borderStyle === "dashed"
        ? borderStyle
        : "none",
    borderColor: normalizeHexColor(
      input?.borderColor,
      DEFAULT_PAGE_APPEARANCE.borderColor
    ),
    borderWidth: Math.min(
      8,
      Math.max(
        0.5,
        numberOr(
          input?.borderWidth,
          DEFAULT_PAGE_APPEARANCE.borderWidth
        )
      )
    ),
    watermarkText:
      typeof input?.watermarkText === "string"
        ? input.watermarkText.trim().slice(0, 120)
        : "",
    watermarkColor: normalizeHexColor(
      input?.watermarkColor,
      DEFAULT_PAGE_APPEARANCE.watermarkColor
    ),
    watermarkOpacity: Math.min(
      0.8,
      Math.max(
        0.04,
        numberOr(
          input?.watermarkOpacity,
          DEFAULT_PAGE_APPEARANCE.watermarkOpacity
        )
      )
    ),
    watermarkAngle: Math.min(
      180,
      Math.max(
        -180,
        numberOr(
          input?.watermarkAngle,
          DEFAULT_PAGE_APPEARANCE.watermarkAngle
        )
      )
    ),
    hyphenation: Boolean(input?.hyphenation),
  }
}

function normalizeAutoCorrectSettings(
  input: Partial<AutoCorrectSettings> | undefined
): AutoCorrectSettings {
  const replacements = Array.isArray(input?.replacements)
    ? input.replacements
        .filter(
          (replacement): replacement is AutoCorrectReplacement =>
            Boolean(
              replacement &&
                typeof replacement.from === "string" &&
                replacement.from.trim() &&
                typeof replacement.to === "string"
            )
        )
        .slice(0, 200)
        .map((replacement, index) => ({
          id:
            typeof replacement.id === "string" && replacement.id
              ? replacement.id.slice(0, 100)
              : `autocorrect-${index + 1}`,
          from: replacement.from.trim().slice(0, 40),
          to: replacement.to.slice(0, 100),
          caseSensitive: Boolean(replacement.caseSensitive),
        }))
    : DEFAULT_AUTOCORRECT_SETTINGS.replacements.map((replacement) => ({
        ...replacement,
      }))
  return {
    enabled: input?.enabled ?? DEFAULT_AUTOCORRECT_SETTINGS.enabled,
    capitalizeSentences:
      input?.capitalizeSentences ??
      DEFAULT_AUTOCORRECT_SETTINGS.capitalizeSentences,
    smartQuotes: input?.smartQuotes ?? DEFAULT_AUTOCORRECT_SETTINGS.smartQuotes,
    smartDashes: input?.smartDashes ?? DEFAULT_AUTOCORRECT_SETTINGS.smartDashes,
    replacements,
  }
}

function normalizeLayout(
  input: Partial<DocumentLayoutSettings> | undefined,
  fallback = DEFAULT_DOCUMENT_LAYOUT
): DocumentLayoutSettings {
  const legacyMargin = numberOr(input?.margin, fallback.margin)
  const inputMargins = input?.margins
  const margins: PageMargins = {
    top: numberOr(inputMargins?.top, legacyMargin),
    right: numberOr(inputMargins?.right, legacyMargin),
    bottom: numberOr(inputMargins?.bottom, legacyMargin),
    left: numberOr(inputMargins?.left, legacyMargin),
    header: numberOr(inputMargins?.header, fallback.margins.header),
    footer: numberOr(inputMargins?.footer, fallback.margins.footer),
  }
  const columns = input?.columns === 2 || input?.columns === 3 ? input.columns : 1
  const lineNumberMode = input?.lineNumbers?.mode
  const lineNumbers: LineNumberSettings = {
    mode:
      lineNumberMode === "continuous" ||
      lineNumberMode === "newPage" ||
      lineNumberMode === "newSection"
        ? lineNumberMode
        : "none",
    start: Math.min(
      9999,
      Math.max(
        1,
        Math.trunc(
          numberOr(input?.lineNumbers?.start, fallback.lineNumbers.start)
        )
      )
    ),
    countBy: Math.min(
      100,
      Math.max(
        1,
        Math.trunc(
          numberOr(input?.lineNumbers?.countBy, fallback.lineNumbers.countBy)
        )
      )
    ),
    distance: Math.min(
      240,
      Math.max(
        0,
        numberOr(input?.lineNumbers?.distance, fallback.lineNumbers.distance)
      )
    ),
  }
  return {
    pageSize: input?.pageSize === "letter" ? "letter" : "a4",
    orientation: input?.orientation === "landscape" ? "landscape" : "portrait",
    margin: legacyMargin,
    margins,
    columns,
    columnGap: numberOr(input?.columnGap, fallback.columnGap),
    zoom: numberOr(input?.zoom, fallback.zoom),
    showRuler: input?.showRuler ?? fallback.showRuler,
    showFormattingMarks: input?.showFormattingMarks ?? fallback.showFormattingMarks,
    lineNumbers,
  }
}

export function normalizeDocumentWorkspaceState(
  raw: unknown
): DocumentWorkspaceState {
  const defaults = createDefaultDocumentWorkspaceState()
  if (!raw || typeof raw !== "object") return defaults
  const input = raw as Partial<DocumentWorkspaceState>
  const proofingLanguage =
    typeof input.proofingLanguage === "string" &&
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.proofingLanguage)
      ? input.proofingLanguage
      : "es-ES"
  const layout = normalizeLayout(input.layout)
  const sections =
    Array.isArray(input.sections) && input.sections.length > 0
      ? input.sections.map((section, index) => {
          const value = section as Partial<DocumentSection>
          return {
            id: typeof value.id === "string" && value.id ? value.id : `section-${index + 1}`,
            name:
              typeof value.name === "string" && value.name
                ? value.name
                : `Sección ${index + 1}`,
            breakType:
              value.breakType === "continuous" ||
              value.breakType === "evenPage" ||
              value.breakType === "oddPage"
                ? value.breakType
                : "nextPage",
            layout: normalizeLayout(value.layout, layout),
            header: {
              default: value.header?.default ?? "",
              first: value.header?.first ?? "",
              even: value.header?.even ?? "",
            },
            footer: {
              default: value.footer?.default ?? "",
              first: value.footer?.first ?? "",
              even: value.footer?.even ?? "",
            },
            differentFirstPage: Boolean(value.differentFirstPage),
            differentOddEven: Boolean(value.differentOddEven),
            pageNumberPosition: value.pageNumberPosition ?? "footer-center",
            pageNumberFormat:
              value.pageNumberFormat === "lowerRoman" ||
              value.pageNumberFormat === "upperRoman" ||
              value.pageNumberFormat === "lowerLetter" ||
              value.pageNumberFormat === "upperLetter"
                ? value.pageNumberFormat
                : "decimal",
            pageNumberStart:
              typeof value.pageNumberStart === "number" &&
              Number.isFinite(value.pageNumberStart)
                ? Math.max(1, Math.trunc(value.pageNumberStart))
                : undefined,
          } satisfies DocumentSection
        })
      : defaults.sections

  const stylesById = new Map(
    defaults.styles.map((style) => [style.id, { ...style }])
  )
  for (const style of Array.isArray(input.styles) ? input.styles : []) {
    if (style?.id) {
      stylesById.set(style.id, {
        ...stylesById.get(style.id),
        ...style,
      })
    }
  }

  return {
    schemaVersion: 8,
    proofingLanguage,
    layout,
    pageAppearance: normalizePageAppearance(input.pageAppearance),
    sections,
    comments: Array.isArray(input.comments)
      ? input.comments
          .filter(
            (comment): comment is DocumentComment =>
              Boolean(
                comment &&
                  typeof comment.id === "string" &&
                  typeof comment.text === "string"
              )
          )
          .map((comment) => ({
            ...comment,
            anchorText:
              typeof comment.anchorText === "string"
                ? comment.anchorText
                : undefined,
            orphaned: Boolean(comment.orphaned),
            replies: Array.isArray(comment.replies) ? comment.replies : [],
          }))
      : [],
    footnotes: Array.isArray(input.footnotes) ? input.footnotes : [],
    endnotes: Array.isArray(input.endnotes)
      ? input.endnotes
          .filter(
            (endnote): endnote is DocumentEndnote =>
              Boolean(
                endnote &&
                  typeof endnote.id === "string" &&
                  typeof endnote.text === "string"
              )
          )
          .map((endnote, index) => ({
            ...endnote,
            number:
              typeof endnote.number === "number" &&
              Number.isFinite(endnote.number)
                ? Math.max(1, Math.trunc(endnote.number))
                : index + 1,
          }))
      : [],
    styles: [...stylesById.values()],
    bibliography: {
      style:
        typeof input.bibliography?.style === "string" &&
        input.bibliography.style.trim()
          ? input.bibliography.style.trim()
          : ("apa" satisfies CitationStyle),
      styleTitle:
        typeof input.bibliography?.styleTitle === "string"
          ? input.bibliography.styleTitle
          : defaults.bibliography.styleTitle,
      styleClass:
        input.bibliography?.styleClass === "note" ? "note" : "in-text",
      cslXml:
        typeof input.bibliography?.cslXml === "string"
          ? input.bibliography.cslXml
          : undefined,
      locale:
        typeof input.bibliography?.locale === "string"
          ? input.bibliography.locale
          : "es-ES",
      sources: Array.isArray(input.bibliography?.sources)
        ? input.bibliography.sources
            .filter(
              (source): source is CitationSource =>
                Boolean(source && typeof source.id === "string")
            )
            .map((source) => ({
              ...source,
              author: source.author ?? "",
              title: source.title ?? "",
              year: source.year ?? "",
              publisher: source.publisher ?? "",
              url: source.url ?? "",
            }))
        : [],
      zoteroSync:
        input.bibliography?.zoteroSync &&
        typeof input.bibliography.zoteroSync === "object"
          ? input.bibliography.zoteroSync
          : {},
    },
    outlineNumbering: {
      enabled: Boolean(input.outlineNumbering?.enabled),
      maxLevel:
        input.outlineNumbering?.maxLevel &&
        [1, 2, 3, 4, 5, 6].includes(input.outlineNumbering.maxLevel)
          ? input.outlineNumbering.maxLevel
          : 3,
      separator: input.outlineNumbering?.separator === "-" ? "-" : ".",
    },
    writingAssistant: {
      disabledRules: Array.isArray(input.writingAssistant?.disabledRules)
        ? input.writingAssistant.disabledRules.filter(
            (rule): rule is WritingRuleId =>
              rule === "repeated-word" ||
              rule === "multiple-spaces" ||
              rule === "space-before-punctuation" ||
              rule === "long-sentence"
          )
        : [],
      ignoredIssues: Array.isArray(input.writingAssistant?.ignoredIssues)
        ? input.writingAssistant.ignoredIssues
            .filter(
              (fingerprint): fingerprint is string =>
                typeof fingerprint === "string" && fingerprint.length <= 300
            )
            .slice(0, 500)
        : [],
      longSentenceThreshold:
        input.writingAssistant?.longSentenceThreshold === null
          ? null
          : input.writingAssistant?.longSentenceThreshold === 45 ||
              input.writingAssistant?.longSentenceThreshold === 75
            ? input.writingAssistant.longSentenceThreshold
            : 60,
    },
    autocorrect: normalizeAutoCorrectSettings(input.autocorrect),
    trackChanges: {
      enabled: Boolean(input.trackChanges?.enabled),
      author: input.trackChanges?.author?.trim() || "Autor",
      showMarkup: input.trackChanges?.showMarkup ?? true,
    },
    importedRevisionSummary: input.importedRevisionSummary,
  }
}

export function parseDocumentWorkspaceState(
  serialized: string | null | undefined
): DocumentWorkspaceState {
  if (!serialized) return createDefaultDocumentWorkspaceState()
  try {
    return normalizeDocumentWorkspaceState(JSON.parse(serialized))
  } catch {
    return createDefaultDocumentWorkspaceState()
  }
}
