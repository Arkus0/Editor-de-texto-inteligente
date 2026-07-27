import { auditDocumentAccessibility } from "@/lib/accessibility-checker"
import { DOCUMENT_STYLE_THEMES } from "@/lib/document-themes"
import type { DocumentStyleThemeId } from "@/lib/document-themes"
import { isEditorSymbol } from "@/lib/symbols"
import type {
  TableFormulaDirection,
  TableFormulaOperation,
} from "@/lib/table-tools"
import type { TableStyle } from "@/lib/export/document-ast"
import type {
  TextBoxAlign,
  TextBoxBorderStyle,
  TextBoxPosition,
  TextBoxPresetId,
} from "@/lib/text-box"
import type { DocumentWorkspaceState } from "@/types/document"

export type EditorPanel =
  | "references"
  | "footnotes"
  | "layout"
  | "review"
  | "documentTools"
  | "mailMerge"
  | "writing"
  | "versions"
  | "accessibility"
  | "reader"

export type EditorAssistantAction =
  | {
      type: "formatSelection"
      styleId?: string
      headingLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6
      bold?: boolean
      italic?: boolean
      underline?: boolean
      strike?: boolean
      superscript?: boolean
      subscript?: boolean
      fontFamily?: string
      fontSize?: number
      textColor?: string
      highlightColor?: string
      listType?: "bullet" | "ordered"
      clearFormatting?: boolean
      textAlign?: "left" | "center" | "right" | "justify"
      lineHeight?: "1" | "1.15" | "1.5" | "2"
    }
  | {
      type: "formatParagraph"
      leftIndent?: number
      rightIndent?: number
      firstLineIndent?: number
      spacingBefore?: number
      spacingAfter?: number
      keepWithNext?: boolean
      keepLinesTogether?: boolean
      widowOrphanControl?: boolean
      pageBreakBefore?: boolean
      suppressLineNumbers?: boolean
    }
  | { type: "insertTable"; rows: number; columns: number; headerRow: boolean }
  | { type: "insertTableOfContents" }
  | { type: "insertPageBreak" }
  | { type: "insertHorizontalRule" }
  | {
      type: "insertSectionBreak"
      breakType: "nextPage" | "continuous" | "evenPage" | "oddPage"
    }
  | { type: "insertEquation"; latex: string }
  | { type: "insertSymbol"; symbol: string }
  | {
      type: "insertTextBox"
      text: string
      preset: TextBoxPresetId
      width?: number
      minHeight?: number
      align?: TextBoxAlign
      position?: TextBoxPosition
      background?: string
      borderColor?: string
      borderStyle?: TextBoxBorderStyle
    }
  | {
      type: "formatTextBox"
      preset?: TextBoxPresetId
      width?: number
      minHeight?: number
      align?: TextBoxAlign
      position?: TextBoxPosition
      background?: string
      borderColor?: string
      borderStyle?: TextBoxBorderStyle
      padding?: number
    }
  | { type: "insertCaption"; kind: "figure" | "table"; title: string }
  | { type: "insertFootnote"; text: string }
  | { type: "insertEndnote"; text: string }
  | { type: "insertComment"; text: string }
  | { type: "replyToComment"; commentId: string; text: string }
  | { type: "resolveComment"; commentId: string; resolved: boolean }
  | {
      type: "setHeaderFooter"
      target: "header" | "footer"
      variant: "default" | "first" | "even"
      content: string
    }
  | { type: "insertCrossReference"; targetId: string }
  | { type: "addBookmark"; name: string }
  | { type: "removeBookmark"; bookmarkId: string }
  | {
      type: "insertCitation"
      sourceIds: string[]
      mode: "parenthetical" | "narrative" | "note"
    }
  | { type: "insertBibliography" }
  | { type: "insertMailMergeField"; field: string }
  | {
      type: "formatSelectedImage"
      width?: number
      align?: "left" | "center" | "right"
      alt?: string
      wrap?:
        | "none"
        | "square-left"
        | "square-right"
        | "tight-left"
        | "tight-right"
        | "behind"
        | "in-front"
      spacing?: number
      crop?: {
        top: number
        right: number
        bottom: number
        left: number
      }
      brightness?: number
      contrast?: number
      saturation?: number
      grayscale?: number
      maxDimension?: number
      imageFormat?: "preserve" | "jpeg" | "png"
    }
  | {
      type: "editTable"
      operation:
        | "addRow"
        | "deleteRow"
        | "addColumn"
        | "deleteColumn"
        | "mergeCells"
        | "splitCell"
        | "toggleHeaderRow"
        | "toggleRepeatHeader"
        | "toggleAllowRowBreak"
        | "sortAscending"
        | "sortDescending"
        | "applyFormula"
        | "setStyle"
      formulaOperation?: TableFormulaOperation
      formulaDirection?: TableFormulaDirection
      tableStyle?: TableStyle
    }
  | {
      type: "setPageNumbering"
      format?: "decimal" | "lowerRoman" | "upperRoman" | "lowerLetter" | "upperLetter"
      position?:
        | "none"
        | "header-left"
        | "header-center"
        | "header-right"
        | "footer-left"
        | "footer-center"
        | "footer-right"
      start?: number
      continueFromPrevious?: boolean
    }
  | {
      type: "setLineNumbering"
      mode: "none" | "continuous" | "newPage" | "newSection"
      start?: number
      countBy?: number
      distance?: number
    }
  | { type: "createThesisStructure" }
  | {
      type: "setProofingLanguage"
      language: string
      scope?: "document" | "selection"
    }
  | {
      type: "configureWritingAssistant"
      profile?: "strict" | "academic" | "flexible" | "mechanical"
      disabledRules?: Array<
        | "repeated-word"
        | "multiple-spaces"
        | "space-before-punctuation"
        | "long-sentence"
      >
    }
  | {
      type: "configureAutocorrect"
      enabled?: boolean
      capitalizeSentences?: boolean
      smartQuotes?: boolean
      smartDashes?: boolean
      replacement?: {
        from: string
        to: string
        caseSensitive: boolean
      }
      removeReplacement?: string
    }
  | {
      type: "setLayout"
      pageSize?: "a4" | "letter"
      orientation?: "portrait" | "landscape"
      columns?: 1 | 2 | 3
      zoom?: number
      margin?: number
      columnGap?: number
      showRuler?: boolean
      showFormattingMarks?: boolean
    }
  | {
      type: "setPageAppearance"
      color?: string
      borderStyle?: "none" | "solid" | "double" | "dashed"
      borderColor?: string
      borderWidth?: number
      watermarkText?: string
      watermarkColor?: string
      watermarkOpacity?: number
      watermarkAngle?: number
      hyphenation?: boolean
    }
  | {
      type: "setOutlineNumbering"
      enabled: boolean
      maxLevel?: 1 | 2 | 3 | 4 | 5 | 6
      separator?: "." | "-"
    }
  | { type: "setTrackChanges"; enabled: boolean }
  | { type: "applyStyleTheme"; theme: DocumentStyleThemeId }
  | { type: "openPanel"; panel: EditorPanel }

export interface ParsedEditorAssistantResponse {
  content: string
  actions: EditorAssistantAction[]
}

interface JsonDocumentNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>
  content?: JsonDocumentNode[]
}

const ACTIONS_OPEN = "<editor_actions>"
const ACTIONS_CLOSE = "</editor_actions>"
const ALIGNMENTS = new Set(["left", "center", "right", "justify"])
const LINE_HEIGHTS = new Set(["1", "1.15", "1.5", "2"])
const LIST_TYPES = new Set(["bullet", "ordered"])
const BREAK_TYPES = new Set(["nextPage", "continuous", "evenPage", "oddPage"])
const CITATION_MODES = new Set(["parenthetical", "narrative", "note"])
const IMAGE_ALIGNMENTS = new Set(["left", "center", "right"])
const IMAGE_WRAPS = new Set([
  "none",
  "square-left",
  "square-right",
  "tight-left",
  "tight-right",
  "behind",
  "in-front",
])
const WRITING_PROFILES = new Set([
  "strict",
  "academic",
  "flexible",
  "mechanical",
])
const WRITING_RULES = new Set([
  "repeated-word",
  "multiple-spaces",
  "space-before-punctuation",
  "long-sentence",
])
const TABLE_OPERATIONS = new Set([
  "addRow",
  "deleteRow",
  "addColumn",
  "deleteColumn",
  "mergeCells",
  "splitCell",
  "toggleHeaderRow",
  "toggleRepeatHeader",
  "toggleAllowRowBreak",
  "sortAscending",
  "sortDescending",
  "applyFormula",
  "setStyle",
])
const TABLE_FORMULA_OPERATIONS = new Set([
  "SUM",
  "AVERAGE",
  "COUNT",
  "MIN",
  "MAX",
])
const TABLE_FORMULA_DIRECTIONS = new Set(["ABOVE", "LEFT"])
const TABLE_STYLES = new Set([
  "plain",
  "grid",
  "header",
  "banded",
  "academic",
])
const TEXT_BOX_PRESETS = new Set(["plain", "highlight", "quote", "warning"])
const TEXT_BOX_POSITIONS = new Set(["inline", "float-left", "float-right"])
const TEXT_BOX_ALIGNMENTS = new Set(["left", "center", "right"])
const TEXT_BOX_BORDER_STYLES = new Set([
  "none",
  "solid",
  "dashed",
  "double",
])
const PAGE_NUMBER_FORMATS = new Set([
  "decimal",
  "lowerRoman",
  "upperRoman",
  "lowerLetter",
  "upperLetter",
])
const PAGE_NUMBER_POSITIONS = new Set([
  "none",
  "header-left",
  "header-center",
  "header-right",
  "footer-left",
  "footer-center",
  "footer-right",
])
const PAGE_BORDER_STYLES = new Set(["none", "solid", "double", "dashed"])
const STYLE_THEME_IDS = new Set<string>(
  DOCUMENT_STYLE_THEMES.map((theme) => theme.id)
)
const PANELS = new Set([
  "references",
  "footnotes",
  "layout",
  "review",
  "documentTools",
  "mailMerge",
  "writing",
  "versions",
  "accessibility",
  "reader",
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function boundedString(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximum)
    : undefined
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return Math.min(maximum, Math.max(minimum, value))
}

function boundedColor(value: unknown) {
  if (typeof value !== "string") return undefined
  const color = value.trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : undefined
}

function boundedStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number
) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => boundedString(item, maximumLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maximumItems)
}

function textBoxFormatting(action: Record<string, unknown>) {
  const preset =
    typeof action.preset === "string" && TEXT_BOX_PRESETS.has(action.preset)
      ? (action.preset as TextBoxPresetId)
      : undefined
  const width = boundedInteger(action.width, 160, 720)
  const minHeight = boundedInteger(action.minHeight, 48, 600)
  const align =
    typeof action.align === "string" &&
    TEXT_BOX_ALIGNMENTS.has(action.align)
      ? (action.align as TextBoxAlign)
      : undefined
  const position =
    typeof action.position === "string" &&
    TEXT_BOX_POSITIONS.has(action.position)
      ? (action.position as TextBoxPosition)
      : undefined
  const background = boundedColor(action.background)
  const borderColor = boundedColor(action.borderColor)
  const borderStyle =
    typeof action.borderStyle === "string" &&
    TEXT_BOX_BORDER_STYLES.has(action.borderStyle)
      ? (action.borderStyle as TextBoxBorderStyle)
      : undefined
  const padding = boundedInteger(action.padding, 4, 48)
  return {
    ...(preset ? { preset } : {}),
    ...(width ? { width } : {}),
    ...(minHeight ? { minHeight } : {}),
    ...(align ? { align } : {}),
    ...(position ? { position } : {}),
    ...(background ? { background } : {}),
    ...(borderColor ? { borderColor } : {}),
    ...(borderStyle ? { borderStyle } : {}),
    ...(padding ? { padding } : {}),
  }
}

function parseAction(value: unknown): EditorAssistantAction | null {
  const action = asRecord(value)
  if (!action || typeof action.type !== "string") return null

  switch (action.type) {
    case "formatSelection": {
      const headingLevel = boundedInteger(action.headingLevel, 0, 6) as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | undefined
      const styleId = boundedString(action.styleId, 80)
      const textAlign =
        typeof action.textAlign === "string" &&
        ALIGNMENTS.has(action.textAlign)
          ? (action.textAlign as "left" | "center" | "right" | "justify")
          : undefined
      const lineHeight =
        typeof action.lineHeight === "string" &&
        LINE_HEIGHTS.has(action.lineHeight)
          ? (action.lineHeight as "1" | "1.15" | "1.5" | "2")
          : undefined
      const fontFamily = boundedString(action.fontFamily, 80)
      const fontSize = boundedInteger(action.fontSize, 6, 96)
      const textColor = boundedColor(action.textColor)
      const highlightColor = boundedColor(action.highlightColor)
      const listType =
        typeof action.listType === "string" && LIST_TYPES.has(action.listType)
          ? (action.listType as "bullet" | "ordered")
          : undefined
      const parsed: EditorAssistantAction = {
        type: "formatSelection",
        ...(styleId ? { styleId } : {}),
        ...(headingLevel !== undefined ? { headingLevel } : {}),
        ...(typeof action.bold === "boolean" ? { bold: action.bold } : {}),
        ...(typeof action.italic === "boolean" ? { italic: action.italic } : {}),
        ...(typeof action.underline === "boolean"
          ? { underline: action.underline }
          : {}),
        ...(typeof action.strike === "boolean" ? { strike: action.strike } : {}),
        ...(typeof action.superscript === "boolean"
          ? { superscript: action.superscript }
          : {}),
        ...(typeof action.subscript === "boolean"
          ? { subscript: action.subscript }
          : {}),
        ...(fontFamily ? { fontFamily } : {}),
        ...(fontSize ? { fontSize } : {}),
        ...(textColor ? { textColor } : {}),
        ...(highlightColor ? { highlightColor } : {}),
        ...(listType ? { listType } : {}),
        ...(typeof action.clearFormatting === "boolean"
          ? { clearFormatting: action.clearFormatting }
          : {}),
        ...(textAlign ? { textAlign } : {}),
        ...(lineHeight ? { lineHeight } : {}),
      }
      return Object.keys(parsed).length > 1 ? parsed : null
    }
    case "formatParagraph": {
      const leftIndent = boundedInteger(action.leftIndent, 0, 720)
      const rightIndent = boundedInteger(action.rightIndent, 0, 720)
      const firstLineIndent = boundedInteger(
        action.firstLineIndent,
        -360,
        360
      )
      const spacingBefore = boundedInteger(action.spacingBefore, 0, 240)
      const spacingAfter = boundedInteger(action.spacingAfter, 0, 240)
      const booleanFields = [
        "keepWithNext",
        "keepLinesTogether",
        "widowOrphanControl",
        "pageBreakBefore",
        "suppressLineNumbers",
      ] as const
      const booleans = Object.fromEntries(
        booleanFields
          .filter((field) => typeof action[field] === "boolean")
          .map((field) => [field, action[field]])
      )
      return leftIndent !== undefined ||
        rightIndent !== undefined ||
        firstLineIndent !== undefined ||
        spacingBefore !== undefined ||
        spacingAfter !== undefined ||
        Object.keys(booleans).length > 0
        ? {
            type: "formatParagraph",
            ...(leftIndent !== undefined ? { leftIndent } : {}),
            ...(rightIndent !== undefined ? { rightIndent } : {}),
            ...(firstLineIndent !== undefined ? { firstLineIndent } : {}),
            ...(spacingBefore !== undefined ? { spacingBefore } : {}),
            ...(spacingAfter !== undefined ? { spacingAfter } : {}),
            ...booleans,
          }
        : null
    }
    case "insertTable": {
      const rows = boundedInteger(action.rows, 1, 30)
      const columns = boundedInteger(action.columns, 1, 12)
      if (!rows || !columns) return null
      return {
        type: "insertTable",
        rows,
        columns,
        headerRow: action.headerRow !== false,
      }
    }
    case "insertTableOfContents":
    case "insertPageBreak":
    case "insertHorizontalRule":
    case "insertBibliography":
    case "createThesisStructure":
      return { type: action.type }
    case "insertMailMergeField": {
      const field = boundedString(action.field, 120)
      return field ? { type: "insertMailMergeField", field } : null
    }
    case "insertSectionBreak":
      return typeof action.breakType === "string" &&
        BREAK_TYPES.has(action.breakType)
        ? {
            type: "insertSectionBreak",
            breakType: action.breakType as
              | "nextPage"
              | "continuous"
              | "evenPage"
              | "oddPage",
          }
        : null
    case "insertEquation": {
      const latex = boundedString(action.latex, 2_000)
      return latex ? { type: "insertEquation", latex } : null
    }
    case "insertSymbol":
      return isEditorSymbol(action.symbol)
        ? { type: "insertSymbol", symbol: action.symbol }
        : null
    case "insertTextBox": {
      const text = boundedString(action.text, 4_000)
      if (!text) return null
      const formatting = textBoxFormatting(action)
      return {
        type: "insertTextBox",
        text,
        preset: formatting.preset ?? "plain",
        ...formatting,
      }
    }
    case "formatTextBox": {
      const formatting = textBoxFormatting(action)
      return Object.keys(formatting).length > 0
        ? { type: "formatTextBox", ...formatting }
        : null
    }
    case "insertCaption": {
      const title = boundedString(action.title, 500)
      return title && (action.kind === "figure" || action.kind === "table")
        ? { type: "insertCaption", kind: action.kind, title }
        : null
    }
    case "insertFootnote": {
      const text = boundedString(action.text, 3_000)
      return text ? { type: "insertFootnote", text } : null
    }
    case "insertEndnote": {
      const text = boundedString(action.text, 3_000)
      return text ? { type: "insertEndnote", text } : null
    }
    case "insertComment": {
      const text = boundedString(action.text, 3_000)
      return text ? { type: "insertComment", text } : null
    }
    case "replyToComment": {
      const commentId = boundedString(action.commentId, 200)
      const text = boundedString(action.text, 3_000)
      return commentId && text
        ? { type: "replyToComment", commentId, text }
        : null
    }
    case "resolveComment": {
      const commentId = boundedString(action.commentId, 200)
      return commentId && typeof action.resolved === "boolean"
        ? {
            type: "resolveComment",
            commentId,
            resolved: action.resolved,
          }
        : null
    }
    case "setHeaderFooter": {
      const target =
        action.target === "header" || action.target === "footer"
          ? action.target
          : undefined
      const variant =
        action.variant === "first" || action.variant === "even"
          ? action.variant
          : "default"
      const content =
        typeof action.content === "string"
          ? action.content.trim().slice(0, 1_000)
          : undefined
      return target && content !== undefined
        ? { type: "setHeaderFooter", target, variant, content }
        : null
    }
    case "insertCrossReference": {
      const targetId = boundedString(action.targetId, 200)
      return targetId ? { type: "insertCrossReference", targetId } : null
    }
    case "addBookmark": {
      const name = boundedString(action.name, 80)
      return name ? { type: "addBookmark", name } : null
    }
    case "removeBookmark": {
      const bookmarkId = boundedString(action.bookmarkId, 200)
      return bookmarkId
        ? { type: "removeBookmark", bookmarkId }
        : null
    }
    case "insertCitation": {
      const sourceIds = boundedStringArray(action.sourceIds, 12, 200)
      const mode =
        typeof action.mode === "string" && CITATION_MODES.has(action.mode)
          ? (action.mode as "parenthetical" | "narrative" | "note")
          : "parenthetical"
      return sourceIds.length > 0
        ? { type: "insertCitation", sourceIds, mode }
        : null
    }
    case "formatSelectedImage": {
      const width = boundedInteger(action.width, 48, 1200)
      const align =
        typeof action.align === "string" &&
        IMAGE_ALIGNMENTS.has(action.align)
          ? (action.align as "left" | "center" | "right")
          : undefined
      const alt = boundedString(action.alt, 500)
      const wrap =
        typeof action.wrap === "string" && IMAGE_WRAPS.has(action.wrap)
          ? (action.wrap as
              | "none"
              | "square-left"
              | "square-right"
              | "tight-left"
              | "tight-right"
              | "behind"
              | "in-front")
          : undefined
      const spacing = boundedInteger(action.spacing, 0, 48)
      const cropInput = asRecord(action.crop)
      const crop = cropInput
        ? {
            top: boundedNumber(cropInput.top, 0, 45) ?? 0,
            right: boundedNumber(cropInput.right, 0, 45) ?? 0,
            bottom: boundedNumber(cropInput.bottom, 0, 45) ?? 0,
            left: boundedNumber(cropInput.left, 0, 45) ?? 0,
          }
        : undefined
      const brightness = boundedNumber(action.brightness, 0.25, 2)
      const contrast = boundedNumber(action.contrast, 0.25, 2)
      const saturation = boundedNumber(action.saturation, 0, 2)
      const grayscale = boundedNumber(action.grayscale, 0, 1)
      const maxDimension = boundedInteger(action.maxDimension, 320, 4096)
      const imageFormat =
        action.imageFormat === "jpeg" || action.imageFormat === "png"
          ? action.imageFormat
          : action.imageFormat === "preserve"
            ? "preserve"
            : undefined
      return width ||
        align ||
        alt ||
        wrap ||
        spacing !== undefined ||
        crop ||
        brightness !== undefined ||
        contrast !== undefined ||
        saturation !== undefined ||
        grayscale !== undefined ||
        maxDimension ||
        imageFormat
        ? {
            type: "formatSelectedImage",
            ...(width ? { width } : {}),
            ...(align ? { align } : {}),
            ...(alt ? { alt } : {}),
            ...(wrap ? { wrap } : {}),
            ...(spacing !== undefined ? { spacing } : {}),
            ...(crop ? { crop } : {}),
            ...(brightness !== undefined ? { brightness } : {}),
            ...(contrast !== undefined ? { contrast } : {}),
            ...(saturation !== undefined ? { saturation } : {}),
            ...(grayscale !== undefined ? { grayscale } : {}),
            ...(maxDimension ? { maxDimension } : {}),
            ...(imageFormat ? { imageFormat } : {}),
          }
        : null
    }
    case "editTable": {
      if (
        typeof action.operation !== "string" ||
        !TABLE_OPERATIONS.has(action.operation)
      ) {
        return null
      }
      const operation = action.operation as Extract<
        EditorAssistantAction,
        { type: "editTable" }
      >["operation"]
      if (operation === "applyFormula") {
        const formulaOperation =
          typeof action.formulaOperation === "string" &&
          TABLE_FORMULA_OPERATIONS.has(action.formulaOperation)
            ? (action.formulaOperation as TableFormulaOperation)
            : "SUM"
        const formulaDirection =
          typeof action.formulaDirection === "string" &&
          TABLE_FORMULA_DIRECTIONS.has(action.formulaDirection)
            ? (action.formulaDirection as TableFormulaDirection)
            : "ABOVE"
        return {
          type: "editTable",
          operation,
          formulaOperation,
          formulaDirection,
        }
      }
      if (operation === "setStyle") {
        return typeof action.tableStyle === "string" &&
          TABLE_STYLES.has(action.tableStyle)
          ? {
              type: "editTable",
              operation,
              tableStyle: action.tableStyle as TableStyle,
            }
          : null
      }
      return { type: "editTable", operation }
    }
    case "setPageNumbering": {
      const format =
        typeof action.format === "string" &&
        PAGE_NUMBER_FORMATS.has(action.format)
          ? (action.format as
              | "decimal"
              | "lowerRoman"
              | "upperRoman"
              | "lowerLetter"
              | "upperLetter")
          : undefined
      const position =
        typeof action.position === "string" &&
        PAGE_NUMBER_POSITIONS.has(action.position)
          ? (action.position as
              | "none"
              | "header-left"
              | "header-center"
              | "header-right"
              | "footer-left"
              | "footer-center"
              | "footer-right")
          : undefined
      const start = boundedInteger(action.start, 1, 9999)
      const continueFromPrevious =
        typeof action.continueFromPrevious === "boolean"
          ? action.continueFromPrevious
          : undefined
      return format ||
        position ||
        start ||
        continueFromPrevious !== undefined
        ? {
            type: "setPageNumbering",
            ...(format ? { format } : {}),
            ...(position ? { position } : {}),
            ...(start ? { start } : {}),
            ...(continueFromPrevious !== undefined
              ? { continueFromPrevious }
              : {}),
          }
        : null
    }
    case "setLineNumbering": {
      const mode =
        action.mode === "none" ||
        action.mode === "continuous" ||
        action.mode === "newPage" ||
        action.mode === "newSection"
          ? action.mode
          : undefined
      const start = boundedInteger(action.start, 1, 9999)
      const countBy = boundedInteger(action.countBy, 1, 100)
      const distance = boundedInteger(action.distance, 0, 240)
      return mode
        ? {
            type: "setLineNumbering",
            mode,
            ...(start ? { start } : {}),
            ...(countBy ? { countBy } : {}),
            ...(distance !== undefined ? { distance } : {}),
          }
        : null
    }
    case "setProofingLanguage": {
      const language = boundedString(action.language, 35)
      const scope =
        action.scope === "selection" ? "selection" : "document"
      return language &&
        /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language)
        ? { type: "setProofingLanguage", language, scope }
        : null
    }
    case "configureWritingAssistant": {
      const profile =
        typeof action.profile === "string" &&
        WRITING_PROFILES.has(action.profile)
          ? (action.profile as
              | "strict"
              | "academic"
              | "flexible"
              | "mechanical")
          : undefined
      const disabledRules = Array.isArray(action.disabledRules)
        ? [
            ...new Set(
              action.disabledRules.filter(
                (rule): rule is
                  | "repeated-word"
                  | "multiple-spaces"
                  | "space-before-punctuation"
                  | "long-sentence" =>
                  typeof rule === "string" && WRITING_RULES.has(rule)
              )
            ),
          ]
        : undefined
      return profile || disabledRules
        ? {
            type: "configureWritingAssistant",
            ...(profile ? { profile } : {}),
            ...(disabledRules ? { disabledRules } : {}),
          }
        : null
    }
    case "configureAutocorrect": {
      const enabled =
        typeof action.enabled === "boolean" ? action.enabled : undefined
      const capitalizeSentences =
        typeof action.capitalizeSentences === "boolean"
          ? action.capitalizeSentences
          : undefined
      const smartQuotes =
        typeof action.smartQuotes === "boolean"
          ? action.smartQuotes
          : undefined
      const smartDashes =
        typeof action.smartDashes === "boolean"
          ? action.smartDashes
          : undefined
      const replacementInput = asRecord(action.replacement)
      const replacementFrom = boundedString(replacementInput?.from, 40)
      const replacementTo =
        typeof replacementInput?.to === "string"
          ? replacementInput.to.slice(0, 100)
          : undefined
      const replacement =
        replacementFrom && replacementTo !== undefined
          ? {
              from: replacementFrom,
              to: replacementTo,
              caseSensitive: Boolean(replacementInput?.caseSensitive),
            }
          : undefined
      const removeReplacement = boundedString(
        action.removeReplacement,
        40
      )
      return enabled !== undefined ||
        capitalizeSentences !== undefined ||
        smartQuotes !== undefined ||
        smartDashes !== undefined ||
        replacement ||
        removeReplacement
        ? {
            type: "configureAutocorrect",
            ...(enabled !== undefined ? { enabled } : {}),
            ...(capitalizeSentences !== undefined
              ? { capitalizeSentences }
              : {}),
            ...(smartQuotes !== undefined ? { smartQuotes } : {}),
            ...(smartDashes !== undefined ? { smartDashes } : {}),
            ...(replacement ? { replacement } : {}),
            ...(removeReplacement ? { removeReplacement } : {}),
          }
        : null
    }
    case "setLayout": {
      const pageSize =
        action.pageSize === "a4" || action.pageSize === "letter"
          ? action.pageSize
          : undefined
      const orientation =
        action.orientation === "portrait" || action.orientation === "landscape"
          ? action.orientation
          : undefined
      const columns = boundedInteger(action.columns, 1, 3) as
        | 1
        | 2
        | 3
        | undefined
      const zoom =
        typeof action.zoom === "number" && Number.isFinite(action.zoom)
          ? Math.min(2, Math.max(0.5, action.zoom))
          : undefined
      const margin = boundedInteger(action.margin, 24, 144)
      const columnGap = boundedInteger(action.columnGap, 12, 120)
      const showRuler =
        typeof action.showRuler === "boolean" ? action.showRuler : undefined
      const showFormattingMarks =
        typeof action.showFormattingMarks === "boolean"
          ? action.showFormattingMarks
          : undefined
      return pageSize ||
        orientation ||
        columns ||
        zoom ||
        margin ||
        columnGap ||
        showRuler !== undefined ||
        showFormattingMarks !== undefined
        ? {
            type: "setLayout",
            ...(pageSize ? { pageSize } : {}),
            ...(orientation ? { orientation } : {}),
            ...(columns ? { columns } : {}),
            ...(zoom ? { zoom } : {}),
            ...(margin ? { margin } : {}),
            ...(columnGap ? { columnGap } : {}),
            ...(showRuler !== undefined ? { showRuler } : {}),
            ...(showFormattingMarks !== undefined
              ? { showFormattingMarks }
              : {}),
          }
        : null
    }
    case "setPageAppearance": {
      const color = boundedColor(action.color)
      const borderStyle =
        typeof action.borderStyle === "string" &&
        PAGE_BORDER_STYLES.has(action.borderStyle)
          ? (action.borderStyle as "none" | "solid" | "double" | "dashed")
          : undefined
      const borderColor = boundedColor(action.borderColor)
      const borderWidth = boundedNumber(action.borderWidth, 0.5, 8)
      const watermarkText =
        typeof action.watermarkText === "string"
          ? action.watermarkText.trim().slice(0, 120)
          : undefined
      const watermarkColor = boundedColor(action.watermarkColor)
      const watermarkOpacity = boundedNumber(
        action.watermarkOpacity,
        0.04,
        0.8
      )
      const watermarkAngle = boundedNumber(action.watermarkAngle, -180, 180)
      const hyphenation =
        typeof action.hyphenation === "boolean"
          ? action.hyphenation
          : undefined
      return color ||
        borderStyle ||
        borderColor ||
        borderWidth !== undefined ||
        watermarkText !== undefined ||
        watermarkColor ||
        watermarkOpacity !== undefined ||
        watermarkAngle !== undefined ||
        hyphenation !== undefined
        ? {
            type: "setPageAppearance",
            ...(color ? { color } : {}),
            ...(borderStyle ? { borderStyle } : {}),
            ...(borderColor ? { borderColor } : {}),
            ...(borderWidth !== undefined ? { borderWidth } : {}),
            ...(watermarkText !== undefined ? { watermarkText } : {}),
            ...(watermarkColor ? { watermarkColor } : {}),
            ...(watermarkOpacity !== undefined ? { watermarkOpacity } : {}),
            ...(watermarkAngle !== undefined ? { watermarkAngle } : {}),
            ...(hyphenation !== undefined ? { hyphenation } : {}),
          }
        : null
    }
    case "setOutlineNumbering": {
      if (typeof action.enabled !== "boolean") return null
      const maxLevel = boundedInteger(action.maxLevel, 1, 6) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | undefined
      const separator =
        action.separator === "." || action.separator === "-"
          ? action.separator
          : undefined
      return {
        type: "setOutlineNumbering",
        enabled: action.enabled,
        ...(maxLevel ? { maxLevel } : {}),
        ...(separator ? { separator } : {}),
      }
    }
    case "setTrackChanges":
      return typeof action.enabled === "boolean"
        ? { type: "setTrackChanges", enabled: action.enabled }
        : null
    case "applyStyleTheme":
      return typeof action.theme === "string" && STYLE_THEME_IDS.has(action.theme)
        ? {
            type: "applyStyleTheme",
            theme: action.theme as DocumentStyleThemeId,
          }
        : null
    case "openPanel":
      return typeof action.panel === "string" && PANELS.has(action.panel)
        ? { type: "openPanel", panel: action.panel as EditorPanel }
        : null
    default:
      return null
  }
}

/**
 * Tope de acciones por respuesta. Un rediseño completo (tema, jerarquía, saltos,
 * portada, índice, encabezados y numeración) pasa de veinte con facilidad, así
 * que el límite existe para frenar una respuesta desbocada, no para recortar un
 * plan legítimo.
 */
const MAX_ACTIONS_PER_RESPONSE = 40

export function parseEditorAssistantResponse(
  response: string
): ParsedEditorAssistantResponse {
  const openIndex = response.indexOf(ACTIONS_OPEN)
  if (openIndex < 0) return { content: response.trim(), actions: [] }

  const closeIndex = response.indexOf(ACTIONS_CLOSE, openIndex + ACTIONS_OPEN.length)
  const content = (
    response.slice(0, openIndex) +
    (closeIndex >= 0
      ? response.slice(closeIndex + ACTIONS_CLOSE.length)
      : "")
  ).trim()

  if (closeIndex < 0) return { content, actions: [] }

  try {
    const raw = JSON.parse(
      response.slice(openIndex + ACTIONS_OPEN.length, closeIndex).trim()
    )
    const actions = Array.isArray(raw)
      ? raw.map(parseAction).filter((action): action is EditorAssistantAction => Boolean(action))
      : []
    return { content, actions: actions.slice(0, MAX_ACTIONS_PER_RESPONSE) }
  } catch {
    return { content, actions: [] }
  }
}

export function editorActionLabel(action: EditorAssistantAction): string {
  switch (action.type) {
    case "formatSelection":
      return "Dar formato a la selección"
    case "formatParagraph":
      return "Cambiar formato y paginación de párrafo"
    case "insertTable":
      return `Insertar tabla ${action.rows}×${action.columns}`
    case "insertTableOfContents":
      return "Insertar índice automático"
    case "insertPageBreak":
      return "Insertar salto de página"
    case "insertHorizontalRule":
      return "Insertar línea horizontal"
    case "insertSectionBreak":
      return "Insertar salto de sección"
    case "insertEquation":
      return "Insertar ecuación"
    case "insertSymbol":
      return `Insertar símbolo ${action.symbol}`
    case "insertTextBox":
      return `Insertar cuadro de texto «${action.text.slice(0, 42)}${
        action.text.length > 42 ? "…" : ""
      }»`
    case "formatTextBox":
      return "Dar formato al cuadro de texto"
    case "insertCaption":
      return `Insertar rótulo de ${action.kind === "figure" ? "figura" : "tabla"}`
    case "insertFootnote":
      return "Insertar nota al pie"
    case "insertEndnote":
      return "Insertar nota final"
    case "insertComment":
      return "Añadir comentario a la selección"
    case "replyToComment":
      return "Responder a un comentario"
    case "resolveComment":
      return action.resolved
        ? "Resolver un comentario"
        : "Reabrir un comentario"
    case "setHeaderFooter":
      return action.target === "header"
        ? "Cambiar el encabezado"
        : "Cambiar el pie de página"
    case "insertCrossReference":
      return "Insertar referencia cruzada"
    case "addBookmark":
      return `Crear marcador «${action.name}»`
    case "removeBookmark":
      return "Eliminar marcador"
    case "insertCitation":
      return action.sourceIds.length > 1
        ? "Insertar cita múltiple"
        : "Insertar cita vinculada"
    case "insertBibliography":
      return "Insertar bibliografía"
    case "insertMailMergeField":
      return `Insertar campo de correspondencia «${action.field}»`
    case "formatSelectedImage":
      return "Dar formato a la imagen seleccionada"
    case "editTable":
      if (action.operation === "sortAscending") {
        return "Ordenar la tabla de A a Z"
      }
      if (action.operation === "sortDescending") {
        return "Ordenar la tabla de Z a A"
      }
      if (action.operation === "applyFormula") {
        return `Insertar =${action.formulaOperation ?? "SUM"}(${
          action.formulaDirection ?? "ABOVE"
        }) en la celda`
      }
      if (action.operation === "setStyle") {
        return `Aplicar estilo de tabla ${action.tableStyle ?? "grid"}`
      }
      return "Editar la tabla seleccionada"
    case "setPageNumbering":
      return "Configurar numeración de página"
    case "setLineNumbering":
      return "Configurar numeración de líneas"
    case "createThesisStructure":
      return "Crear estructura de tesis"
    case "setProofingLanguage":
      return "Cambiar idioma de corrección"
    case "configureWritingAssistant":
      return "Configurar asistente de escritura"
    case "configureAutocorrect":
      return "Configurar autocorrección local"
    case "setLayout":
      return "Cambiar diseño de página"
    case "setPageAppearance":
      return "Cambiar fondo, borde o marca de agua"
    case "setOutlineNumbering":
      return "Configurar numeración de títulos"
    case "setTrackChanges":
      return action.enabled
        ? "Activar control de cambios"
        : "Desactivar control de cambios"
    case "applyStyleTheme": {
      const theme = DOCUMENT_STYLE_THEMES.find(
        (candidate) => candidate.id === action.theme
      )
      return `Aplicar el tema «${theme?.name ?? action.theme}» a todo el documento`
    }
    case "openPanel":
      return "Abrir herramienta del editor"
  }
}

function walkDocument(
  node: JsonDocumentNode,
  visit: (node: JsonDocumentNode) => void
) {
  visit(node)
  for (const child of node.content ?? []) walkDocument(child, visit)
}

/**
 * Cuánto contexto del editor viaja con la petición. El catálogo completo de
 * acciones ocupa unos 6.500 caracteres, así que solo lo recibe el perfil que va a
 * maquetar; los demás trabajan con un resumen del estado.
 */
export type EditorContextDetail = "slim" | "bibliography" | "full"

export interface EditorAssistantContextOptions {
  detail?: EditorContextDetail
  /** En Diseñar el modelo propone cambios sin esperar a que se los pidan. */
  proactive?: boolean
}

export function buildEditorAssistantContext(
  document: JsonDocumentNode | null | undefined,
  workspace: DocumentWorkspaceState,
  hasSelection: boolean,
  activeObject:
    | "none"
    | "text"
    | "image"
    | "table"
    | "textBox" = hasSelection
    ? "text"
    : "none",
  options: EditorAssistantContextOptions = {}
) {
  const detail = options.detail ?? "full"
  const counts = new Map<string, number>()
  const headings: string[] = []
  const referenceTargets: string[] = []
  const bookmarkIds = new Set<string>()
  const tableStyles = new Map<string, number>()
  let tableFormulaCount = 0
  if (document) {
    walkDocument(document, (node) => {
      if (node.type) counts.set(node.type, (counts.get(node.type) ?? 0) + 1)
      if (node.type === "table") {
        const style = String(node.attrs?.tableStyle ?? "grid")
        tableStyles.set(style, (tableStyles.get(style) ?? 0) + 1)
      }
      if (
        (node.type === "tableCell" || node.type === "tableHeader") &&
        typeof node.attrs?.formula === "string" &&
        node.attrs.formula.length > 0
      ) {
        tableFormulaCount += 1
      }
      if (node.type === "heading" && headings.length < 80) {
        const level = Number(node.attrs?.level ?? 1)
        const text = (node.content ?? [])
          .map((child) => child.text ?? "")
          .join("")
          .trim()
        if (text) {
          const targetId = String(node.attrs?.anchorId ?? "")
          headings.push(`${level}:${text.slice(0, 160)}`)
          if (targetId) {
            referenceTargets.push(
              `${targetId}|título nivel ${level}|${text.slice(0, 120)}`
            )
          }
        }
      }
      if (node.type === "caption" && referenceTargets.length < 120) {
        const targetId = String(node.attrs?.captionId ?? "")
        const label = String(node.attrs?.label ?? "Rótulo")
        const number = String(node.attrs?.number ?? "")
        const title = String(node.attrs?.title ?? "")
        if (targetId) {
          referenceTargets.push(
            `${targetId}|rótulo|${label} ${number} ${title}`.trim()
          )
        }
      }
      if (node.type === "equation" && referenceTargets.length < 120) {
        const targetId = String(node.attrs?.equationId ?? "")
        if (targetId) {
          referenceTargets.push(
            `${targetId}|ecuación|${String(node.attrs?.latex ?? "").slice(0, 120)}`
          )
        }
      }
      if (node.type === "text" && referenceTargets.length < 120) {
        const bookmark = node.marks?.find(
          (mark) => mark.type === "bookmark"
        )
        const bookmarkId = String(bookmark?.attrs?.bookmarkId ?? "")
        if (bookmarkId && !bookmarkIds.has(bookmarkId)) {
          bookmarkIds.add(bookmarkId)
          counts.set("bookmark", bookmarkIds.size)
          const name = String(
            bookmark?.attrs?.name || node.text || "Marcador"
          )
          referenceTargets.push(
            `${bookmarkId}|marcador|${name.slice(0, 120)}`
          )
        }
      }
    })
  }

  const inventory = [
    ["títulos", "heading"],
    ["tablas", "table"],
    ["cuadros de texto", "textBox"],
    ["imágenes", "image"],
    ["citas", "citation"],
    ["notas al pie", "footnoteReference"],
    ["notas finales", "endnoteReference"],
    ["ecuaciones", "equation"],
    ["rótulos", "caption"],
    ["saltos de página", "pageBreak"],
    ["saltos de sección", "sectionBreak"],
    ["índices", "tableOfContents"],
    ["bibliografías", "bibliography"],
    ["marcadores", "bookmark"],
  ]
    .map(([label, type]) => `${label}=${counts.get(type) ?? 0}`)
    .join(", ")
  const tableSummary = [...tableStyles.entries()]
    .map(([style, count]) => `${style}=${count}`)
    .join(", ")
  const citationSources = workspace.bibliography.sources
    .slice(0, 80)
    .map(
      (source) =>
        `${source.id}|${source.author || "sin autor"}|${source.year || "sin año"}|${source.title.slice(0, 140)}`
    )
  const styleCatalog = workspace.styles
    .slice(0, 40)
    .map(
      (style) =>
        `${style.id}|${style.name}|fuente=${style.fontFamily ?? "heredada"}|tamaño=${style.fontSize ?? "heredado"}|color=${style.color ?? "heredado"}`
    )
  const commentThreads = workspace.comments
    .slice(0, 100)
    .map((comment) => {
      const replies = comment.replies
        .slice(0, 20)
        .map((reply) => `${reply.author}: ${reply.text.slice(0, 500)}`)
        .join(" ⟶ ")
      return [
        comment.id,
        comment.resolved ? "resuelto" : "abierto",
        comment.orphaned
          ? "sin anclaje"
          : `anclado a "${comment.anchorText?.slice(0, 160) ?? ""}"`,
        `${comment.author}: ${comment.text.slice(0, 800)}`,
        replies ? `respuestas: ${replies}` : "",
      ]
        .filter(Boolean)
        .join("|")
    })
  const sectionCatalog = workspace.sections
    .slice(0, 50)
    .map(
      (section) =>
        `${section.id}|${section.name}|salto=${section.breakType}|encabezado=${section.header.default.slice(0, 200) || "(vacío)"}|pie=${section.footer.default.slice(0, 200) || "(vacío)"}|página=${section.pageNumberPosition}/${section.pageNumberFormat}`
    )

  const accessibility = auditDocumentAccessibility(document, {
    language: workspace.proofingLanguage,
  })
  const accessibilitySummary = accessibility.issues
    .slice(0, 12)
    .map(
      (issue) =>
        `${issue.severity}|${issue.rule}|${issue.title}|posición=${issue.position}`
    )

  // --- Resumen mínimo, común a todos los perfiles ---------------------------
  const slimState = `ESTADO ACTUAL DEL EDITOR:
Selección activa: ${hasSelection ? "sí" : "no"}. Objeto activo: ${activeObject}.
Inventario: ${inventory}.
Idioma de corrección=${workspace.proofingLanguage}. Página=${workspace.layout.pageSize}/${workspace.layout.orientation}, columnas=${workspace.layout.columns}.
Esquema de títulos:
${headings.length ? headings.join("\n") : "(sin títulos)"}`

  const bibliographyBlock = `FUENTES DISPONIBLES (id|autor|año|título):
${citationSources.length ? citationSources.join("\n") : "(ninguna)"}`

  if (detail === "slim") return slimState

  // --- Investigar: estado + fuentes + un puñado de acciones para citar ------
  if (detail === "bibliography") {
    return `${slimState}

${bibliographyBlock}

PROTOCOLO INTERNO DEL EDITOR (no lo muestres ni lo expliques):
Cuando el usuario pida dejar constancia de una fuente o de una observación en el documento, añade AL FINAL un bloque exacto:
${ACTIONS_OPEN}
[{"type":"acción","parámetro":"valor"}]
${ACTIONS_CLOSE}

Acciones permitidas en este modo:
- insertCitation: sourceIds tomados literalmente de FUENTES DISPONIBLES; mode parenthetical|narrative|note.
- insertBibliography.
- insertFootnote: text.
- insertComment: text. Solo si hay selección.
- openPanel: panel references|footnotes|review.

No uses ninguna otra acción ni reescribas el documento: aquí se verifica y se documenta. Si no hay nada que registrar, responde solo con texto.`
  }

  // --- Diseñar: catálogo completo ------------------------------------------
  const protocolIntro = options.proactive
    ? `PROTOCOLO INTERNO DEL EDITOR (no lo muestres ni lo expliques):
Estas son las capacidades reales de la aplicación. Úsalas: cuando detectes algo que mejoraría el documento, propón la acción sin esperar a que te la pidan. Responde primero con una explicación breve de qué vas a cambiar y por qué, y añade AL FINAL un bloque exacto:

Los nombres técnicos de esta lista son internos. Al hablar con el usuario nómbralos en castellano llano —"índice automático", "salto de sección", "tema de estilos", "encabezado de primera página"— y nunca escribas identificadores como insertTableOfContents, variant first o setPageNumbering en el texto visible.`
    : `PROTOCOLO INTERNO DEL EDITOR (no lo muestres ni lo expliques):
Puedes proponer acciones nativas del editor cuando el usuario pida explícitamente cambiar formato, estructura, diseño, revisión o insertar un campo. Para ello, responde primero con una confirmación breve y añade AL FINAL un bloque exacto:`

  return `${protocolIntro}
${ACTIONS_OPEN}
[{"type":"acción","parámetro":"valor"}]
${ACTIONS_CLOSE}

Acciones permitidas:
- formatSelection admite además strike/superscript/subscript booleanos; fontFamily; fontSize 6..96; textColor/highlightColor en formato #rrggbb; listType bullet|ordered; clearFormatting boolean. Solo si hay selección.
- formatSelection: styleId opcional; headingLevel 0..6; bold/italic/underline booleanos; textAlign left|center|right|justify; lineHeight 1|1.15|1.5|2. Solo si hay selección.
- formatParagraph: leftIndent/rightIndent 0..720 pt; firstLineIndent -360..360 pt (negativo crea sangría francesa); spacingBefore/spacingAfter 0..240 pt; keepWithNext, keepLinesTogether, widowOrphanControl, pageBreakBefore y suppressLineNumbers booleanos. Se aplica al párrafo actual o a los seleccionados.
- insertTable: rows 1..30, columns 1..12, headerRow boolean.
- insertTableOfContents.
- insertPageBreak.
- insertHorizontalRule.
- insertSectionBreak: breakType nextPage|continuous|evenPage|oddPage.
- insertEquation: latex.
- insertSymbol: symbol debe ser un único carácter disponible en la galería local de símbolos.
- insertTextBox: text de 1..4000 caracteres; preset plain|highlight|quote|warning; admite width 160..720, minHeight 48..600, align left|center|right, position inline|float-left|float-right y colores seguros background/borderColor, además de borderStyle none|solid|dashed|double.
- formatTextBox: solo dentro de un cuadro de texto; admite preset y los mismos campos visuales, más padding 4..48.
- insertCaption: kind figure|table, title.
- insertFootnote: text.
- insertEndnote: text.
- insertComment: text. Solo si hay selección.
- replyToComment: commentId tomado literalmente de HILOS DE COMENTARIOS; text.
- resolveComment: commentId tomado literalmente de HILOS DE COMENTARIOS; resolved boolean.
- setHeaderFooter: target header|footer; variant default|first|even; content (puede ser una cadena vacía para borrar). Se aplica a la sección activa.
- insertCrossReference: targetId tomado literalmente de OBJETIVOS DE REFERENCIA.
- addBookmark: name de 1..80 caracteres; requiere una selección de texto.
- removeBookmark: bookmarkId tomado literalmente de OBJETIVOS DE REFERENCIA.
- insertCitation: sourceIds tomados literalmente de FUENTES DISPONIBLES; mode parenthetical|narrative|note.
- insertBibliography.
- insertMailMergeField: field con el nombre exacto de la columna CSV que indique el usuario.
- formatSelectedImage: solo con una imagen seleccionada. width 48..1200; align left|center|right; alt; wrap none|square-left|square-right|tight-left|tight-right|behind|in-front; spacing 0..48. Para edición real de píxeles admite crop con top/right/bottom/left 0..45 %, brightness/contrast 0.25..2, saturation 0..2, grayscale 0..1, maxDimension 320..4096 e imageFormat preserve|jpeg|png.
- editTable: solo dentro de una tabla. operation addRow|deleteRow|addColumn|deleteColumn|mergeCells|splitCell|toggleHeaderRow|toggleRepeatHeader|toggleAllowRowBreak|sortAscending|sortDescending|applyFormula|setStyle. La ordenación usa la columna activa y conserva la cabecera. applyFormula admite formulaOperation SUM|AVERAGE|COUNT|MIN|MAX y formulaDirection ABOVE|LEFT. setStyle requiere tableStyle plain|grid|header|banded|academic.
- setPageNumbering: format decimal|lowerRoman|upperRoman|lowerLetter|upperLetter; position none|header-left|header-center|header-right|footer-left|footer-center|footer-right; start 1..9999; continueFromPrevious boolean.
- setLineNumbering: mode none|continuous|newPage|newSection; start 1..9999; countBy 1..100; distance 0..240. Se aplica a la sección activa.
- createThesisStructure: convierte la sección actual en preliminares romanos y crea el cuerpo arábigo desde 1.
- setProofingLanguage: language en formato BCP-47, por ejemplo es-ES, en-GB o fr-FR; scope document|selection. Usa selection solo si hay texto seleccionado.
- configureWritingAssistant: profile strict|academic|flexible|mechanical; disabledRules puede contener repeated-word|multiple-spaces|space-before-punctuation|long-sentence.
- configureAutocorrect: enabled, capitalizeSentences, smartQuotes y smartDashes booleanos; replacement con from/to/caseSensitive añade o actualiza una sustitución; removeReplacement elimina por texto de origen.
- setLayout: pageSize a4|letter; orientation portrait|landscape; columns 1..3; zoom 0.5..2.
- setLayout admite además margin 24..144; columnGap 12..120; showRuler/showFormattingMarks booleanos.
- setPageAppearance: color/borderColor/watermarkColor en #rrggbb; borderStyle none|solid|double|dashed; borderWidth 0.5..8; watermarkText (vacío la elimina); watermarkOpacity 0.04..0.8; watermarkAngle -180..180; hyphenation booleano.
- setOutlineNumbering: enabled, maxLevel 1..6, separator "."|"-".
- setTrackChanges: enabled.
- applyStyleTheme: reescribe de una vez los estilos de todo el documento (fuentes de título y cuerpo, tamaños y color de acento). Es la acción más eficiente para ordenar un documento descuidado: prefiérela antes que encadenar muchos formatSelection. theme debe ser uno de:
${DOCUMENT_STYLE_THEMES.map(
    (theme) =>
      `  · ${theme.id}: ${theme.name} — ${theme.description}. Títulos en ${theme.headingFont}, cuerpo en ${theme.bodyFont}, acento ${theme.accent}.`
  ).join("\n")}
- openPanel: panel references|footnotes|layout|review|documentTools|mailMerge|writing|versions|accessibility|reader.

${
    options.proactive
      ? `No inventes posiciones ni acciones fuera de esta lista. Agrupa en una sola lista todos los pasos compatibles, ordenados por dependencia, y deja que la app pida confirmación. Si el usuario solo pregunta o pide un diagnóstico, responde con el plan en texto y no emitas todavía el bloque.`
      : `No inventes posiciones ni acciones fuera de esta lista. Agrupa en una sola lista todos los pasos compatibles y deja que la app pida confirmación. Si la petición es solo redactar, revisar ideas o conversar, no uses el protocolo.`
  }

ESTADO ACTUAL DEL EDITOR:
Selección activa: ${hasSelection ? "sí" : "no"}.
Objeto activo: ${activeObject}.
Inventario: ${inventory}.
Tablas: estilos=${tableSummary || "(ninguno)"}, celdas con fórmula=${tableFormulaCount}.
Secciones=${workspace.sections.length}, comentarios=${workspace.comments.length}, notas al pie registradas=${workspace.footnotes.length}, notas finales registradas=${workspace.endnotes.length}, fuentes=${workspace.bibliography.sources.length}, idioma de corrección=${workspace.proofingLanguage}.
Asistente de escritura: umbral de frase=${workspace.writingAssistant.longSentenceThreshold ?? "desactivado"}, reglas desactivadas=${workspace.writingAssistant.disabledRules.join(",") || "ninguna"}.
Autocorrección=${workspace.autocorrect.enabled ? "activa" : "inactiva"}, mayúsculas=${workspace.autocorrect.capitalizeSentences ? "sí" : "no"}, comillas=${workspace.autocorrect.smartQuotes ? "sí" : "no"}, rayas=${workspace.autocorrect.smartDashes ? "sí" : "no"}, sustituciones=${workspace.autocorrect.replacements.length}.
Tesauro local completo de LibreOffice disponible para español e inglés mediante openPanel writing; nunca inventes sinónimos si el usuario solo pide abrir la herramienta.
Página=${workspace.layout.pageSize}, orientación=${workspace.layout.orientation}, columnas=${workspace.layout.columns}, zoom=${workspace.layout.zoom}, numeración de líneas=${workspace.layout.lineNumbers.mode} desde ${workspace.layout.lineNumbers.start} cada ${workspace.layout.lineNumbers.countBy}.
Apariencia de página: color=${workspace.pageAppearance.color}, borde=${workspace.pageAppearance.borderStyle}/${workspace.pageAppearance.borderColor}/${workspace.pageAppearance.borderWidth}px, marca de agua=${workspace.pageAppearance.watermarkText || "(ninguna)"}, guiones=${workspace.pageAppearance.hyphenation ? "activos" : "inactivos"}.
Numeración de títulos=${workspace.outlineNumbering.enabled ? "activa" : "inactiva"} hasta nivel ${workspace.outlineNumbering.maxLevel}. Control de cambios=${workspace.trackChanges.enabled ? "activo" : "inactivo"}.
ACCESIBILIDAD LOCAL: puntuación orientativa=${accessibility.score}/100, errores=${accessibility.errors}, avisos=${accessibility.warnings}, sugerencias=${accessibility.tips}.
${accessibilitySummary.length ? accessibilitySummary.join("\n") : "(sin problemas automáticos detectados)"}
Esquema de títulos:
${headings.length ? headings.join("\n") : "(sin títulos)"}
OBJETIVOS DE REFERENCIA (id|tipo|etiqueta):
${referenceTargets.length ? referenceTargets.join("\n") : "(ninguno)"}
FUENTES DISPONIBLES (id|autor|año|título):
${citationSources.length ? citationSources.join("\n") : "(ninguna)"}
ESTILOS DISPONIBLES (id|nombre|propiedades):
${styleCatalog.length ? styleCatalog.join("\n") : "(ninguno)"}
SECCIONES (id|nombre|salto|encabezado|pie|numeración):
${sectionCatalog.length ? sectionCatalog.join("\n") : "(ninguna)"}
HILOS DE COMENTARIOS (id|estado|anclaje|comentario|respuestas):
${commentThreads.length ? commentThreads.join("\n") : "(ninguno)"}`.trim()
}
