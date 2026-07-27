import type { JSONContent } from "@tiptap/react"

import {
  normalizeParagraphFormat,
  type ParagraphFormat,
} from "@/lib/paragraph-format"
import type { CitationClusterItem, CitationMode } from "@/types/citation"

export type Align = "left" | "center" | "right" | "justify"
export type TableStyle =
  | "plain"
  | "grid"
  | "header"
  | "banded"
  | "academic"

export interface TextRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  color?: string
  highlight?: string
  link?: string
  fontFamily?: string
  fontSize?: string
  superscript?: boolean
  subscript?: boolean
  footnoteId?: string
  endnoteId?: string
  commentIds?: string[]
  revision?: {
    id: string
    type: "insertion" | "deletion"
    author: string
    date: string
  }
  citationSourceId?: string
  citationClusterId?: string
  /**
   * Contenido del grupo de citas: qué fuentes lo componen y con qué localizador
   * o prefijo. `text` sigue llevando la cita ya formateada, así que quien
   * exporte y no entienda de citas produce lo mismo de antes; DOCX usa esto
   * para escribir un campo de Zotero que Word pueda refrescar.
   */
  citationItems?: CitationClusterItem[]
  citationMode?: CitationMode
  crossReferenceTarget?: string
  language?: string
  bookmarkId?: string
  bookmarkName?: string
  /**
   * Campo de formulario. `text` sigue llevando su representación impresa —☒,
   * lo respondido, la línea en blanco—, así que quien exporte y no entienda de
   * campos (PDF, ODT, Markdown) produce algo correcto sin cambiar nada. Solo
   * DOCX mira este descriptor, para escribir un control de Word de verdad.
   */
  formField?: FormFieldDescriptor
}

export type FormFieldDescriptor =
  | { kind: "checkbox"; checked: boolean; label?: string }
  | { kind: "text"; value: string; placeholder?: string }
  | { kind: "dropdown"; value: string; options: string[] }

export type BlockNode =
  | {
      type: "paragraph"
      align?: Align
      lineHeight?: string
      styleId?: string
      styleName?: string
      paragraphFormat?: ParagraphFormat
      runs: TextRun[]
    }
  | {
      type: "heading"
      level: 1 | 2 | 3 | 4 | 5 | 6
      align?: Align
      lineHeight?: string
      styleId?: string
      styleName?: string
      anchorId?: string
      outlineNumber?: string
      paragraphFormat?: ParagraphFormat
      runs: TextRun[]
    }
  | { type: "bulletList"; items: BlockNode[][] }
  | { type: "orderedList"; items: BlockNode[][] }
  | { type: "blockquote"; content: BlockNode[] }
  | { type: "codeBlock"; text: string }
  | { type: "horizontalRule" }
  | { type: "pageBreak" }
  | { type: "sectionBreak"; sectionId: string; breakType: string }
  | {
      type: "bibliography"
      heading: string
      style: string
      entries: string[]
    }
  | {
      type: "tableOfContents"
      title: string
      maxLevel: number
      entries: Array<{
        id: string
        level: number
        number: string
        text: string
      }>
    }
  | {
      type: "caption"
      id: string
      kind: string
      number: number
      label: string
      title: string
    }
  | { type: "equation"; id: string; latex: string; number?: number }
  | {
      type: "image"
      src: string
      width?: number
      height?: number
      alt?: string
      align?: "left" | "center" | "right"
      wrap?:
        | "none"
        | "square-left"
        | "square-right"
        | "tight-left"
        | "tight-right"
        | "behind"
        | "in-front"
      spacing?: number
    }
  | {
      type: "textBox"
      content: BlockNode[]
      width: number
      minHeight: number
      align: "left" | "center" | "right"
      position: "inline" | "float-left" | "float-right"
      background: string
      borderColor: string
      borderStyle: "none" | "solid" | "dashed" | "double"
      padding: number
    }
  | {
      type: "table"
      rows: TableRowAst[]
      repeatHeader: boolean
      allowRowBreak: boolean
      tableStyle?: TableStyle
    }

export interface TableRowAst {
  cells: {
    header: boolean
    content: BlockNode[]
    colSpan?: number
    rowSpan?: number
    formula?: string
  }[]
}

function tableStyle(value: unknown): TableStyle {
  return value === "plain" ||
    value === "header" ||
    value === "banded" ||
    value === "academic"
    ? value
    : "grid"
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

const SHAPE_TYPE_VALUES = [
  "rectangle",
  "roundedRectangle",
  "ellipse",
  "line",
  "arrow",
] as const

/**
 * Las formas se dibujan a un PNG en un canvas y se exportan como imagen
 * normal: así se reutiliza el pipeline de exportación de imágenes ya
 * probado en DOCX/ODT/PDF en vez de inventar un tipo de bloque nuevo.
 */
function renderShapeToDataUrl(
  shapeType: (typeof SHAPE_TYPE_VALUES)[number],
  width: number,
  height: number,
  fill: string,
  borderColor: string,
  borderWidth: number,
  borderStyle: string
): string | null {
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  const scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.scale(scale, scale)

  if (shapeType === "line" || shapeType === "arrow") {
    const y = height / 2
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth
    ctx.beginPath()
    ctx.moveTo(1, y)
    ctx.lineTo(width - 1, y)
    ctx.stroke()
    if (shapeType === "arrow") {
      ctx.fillStyle = borderColor
      ctx.beginPath()
      ctx.moveTo(width - 1, y)
      ctx.lineTo(width - 12, y - 7)
      ctx.lineTo(width - 12, y + 7)
      ctx.closePath()
      ctx.fill()
    }
    return canvas.toDataURL("image/png")
  }

  if (borderStyle === "dashed") ctx.setLineDash([borderWidth * 2, borderWidth * 2])
  const inset = borderWidth / 2
  ctx.beginPath()
  if (shapeType === "ellipse") {
    ctx.ellipse(width / 2, height / 2, width / 2 - inset, height / 2 - inset, 0, 0, Math.PI * 2)
  } else {
    const radius = shapeType === "roundedRectangle" ? Math.min(16, width / 4, height / 4) : 0
    ctx.roundRect(inset, inset, width - inset * 2, height - inset * 2, radius)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (borderStyle !== "none" && borderWidth > 0) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth
    ctx.stroke()
  }
  return canvas.toDataURL("image/png")
}

function extractRuns(content: JSONContent[] | undefined): TextRun[] {
  if (!content) return []
  const runs: TextRun[] = []
  for (const node of content) {
    if (node.type === "hardBreak") {
      runs.push({ text: "\n" })
      continue
    }
    if (node.type === "tabStop") {
      runs.push({ text: "\t" })
      continue
    }
    if (node.type === "footnoteReference") {
      runs.push({
        text: "",
        footnoteId: node.attrs?.footnoteId as string | undefined,
      })
      continue
    }
    if (node.type === "endnoteReference") {
      runs.push({
        text: "",
        endnoteId: node.attrs?.endnoteId as string | undefined,
      })
      continue
    }
    if (node.type === "citation") {
      const rawItems = node.attrs?.items
      const items = Array.isArray(rawItems)
        ? (rawItems as CitationClusterItem[])
        : undefined
      const sourceId = String(node.attrs?.sourceId ?? "")
      runs.push({
        text: String(node.attrs?.label ?? "(Referencia)"),
        citationSourceId: sourceId,
        citationClusterId: String(node.attrs?.clusterId ?? ""),
        // Una cita insertada de una sola fuente puede no traer lista de
        // elementos; se reconstruye para que la exportación las trate igual.
        citationItems:
          items?.length || !sourceId ? items : [{ sourceId }],
        citationMode: node.attrs?.mode as CitationMode | undefined,
      })
      continue
    }
    if (node.type === "crossReference") {
      runs.push({
        text: String(node.attrs?.text ?? "Referencia"),
        crossReferenceTarget: String(node.attrs?.targetId ?? ""),
      })
      continue
    }
    // Los campos de formulario se exportan como texto fiel a lo que se ve:
    // una casilla marcada imprime ☒, un hueco vacío imprime una línea sobre la
    // que escribir a mano y un desplegable imprime la opción elegida. Así el
    // cuestionario sirve igual en papel, en PDF y abierto en Word.
    if (node.type === "formCheckbox") {
      const checked = Boolean(node.attrs?.checked)
      runs.push({
        text: checked ? "☒" : "☐",
        formField: {
          kind: "checkbox",
          checked,
          label: String(node.attrs?.label ?? ""),
        },
      })
      continue
    }
    if (node.type === "formTextField") {
      const value = String(node.attrs?.value ?? "")
      const width = Number(node.attrs?.width) || 18
      const placeholder = String(node.attrs?.placeholder ?? "")
      runs.push({
        text: value || "_".repeat(Math.max(4, width)),
        underline: Boolean(value),
        formField: { kind: "text", value, placeholder },
      })
      continue
    }
    if (node.type === "formDropdown") {
      const options = Array.isArray(node.attrs?.options)
        ? (node.attrs.options as string[])
        : []
      const value = String(node.attrs?.value ?? "")
      runs.push({
        text:
          value || (options.length ? `(${options.join(" / ")})` : "________"),
        underline: Boolean(value),
        formField: { kind: "dropdown", value, options },
      })
      continue
    }
    if (node.type !== "text" || typeof node.text !== "string") continue
    const run: TextRun = { text: node.text }
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") run.bold = true
      else if (mark.type === "italic") run.italic = true
      else if (mark.type === "underline") run.underline = true
      else if (mark.type === "strike") run.strike = true
      else if (mark.type === "code") run.code = true
      else if (mark.type === "superscript") run.superscript = true
      else if (mark.type === "subscript") run.subscript = true
      else if (mark.type === "comment" && mark.attrs?.commentId) {
        run.commentIds = [
          ...(run.commentIds ?? []),
          String(mark.attrs.commentId),
        ]
      }
      else if (
        mark.type === "trackedInsertion" ||
        mark.type === "trackedDeletion"
      ) {
        run.revision = {
          id: String(mark.attrs?.revisionId ?? ""),
          type: mark.type === "trackedInsertion" ? "insertion" : "deletion",
          author: String(mark.attrs?.author ?? "Autor"),
          date: String(mark.attrs?.date ?? new Date(0).toISOString()),
        }
      }
      else if (mark.type === "link") run.link = mark.attrs?.href as string | undefined
      else if (mark.type === "textStyle") {
        if (mark.attrs?.color) run.color = mark.attrs.color as string
        if (mark.attrs?.fontFamily) run.fontFamily = mark.attrs.fontFamily as string
        if (mark.attrs?.fontSize) run.fontSize = mark.attrs.fontSize as string
      }
      else if (mark.type === "highlight") run.highlight = (mark.attrs?.color as string) ?? "#fff3a3"
      else if (
        mark.type === "proofingLanguage" &&
        typeof mark.attrs?.language === "string"
      ) {
        run.language = mark.attrs.language
      }
      else if (
        mark.type === "bookmark" &&
        typeof mark.attrs?.bookmarkId === "string"
      ) {
        run.bookmarkId = mark.attrs.bookmarkId
        run.bookmarkName =
          typeof mark.attrs.name === "string" ? mark.attrs.name : ""
      }
    }
    runs.push(run)
  }
  return runs
}

function convertBlock(node: JSONContent): BlockNode | BlockNode[] | null {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        align: node.attrs?.textAlign as Align | undefined,
        lineHeight: node.attrs?.lineHeight as string | undefined,
        styleId: node.attrs?.styleId as string | undefined,
        styleName: node.attrs?.styleName as string | undefined,
        paragraphFormat: node.attrs?.paragraphFormat
          ? normalizeParagraphFormat(node.attrs.paragraphFormat)
          : undefined,
        runs: extractRuns(node.content),
      }
    case "heading":
      return {
        type: "heading",
        level: (node.attrs?.level as 1 | 2 | 3 | 4 | 5 | 6) ?? 1,
        align: node.attrs?.textAlign as Align | undefined,
        lineHeight: node.attrs?.lineHeight as string | undefined,
        styleId: node.attrs?.styleId as string | undefined,
        styleName: node.attrs?.styleName as string | undefined,
        anchorId: node.attrs?.anchorId as string | undefined,
        outlineNumber: node.attrs?.outlineNumber as string | undefined,
        paragraphFormat: node.attrs?.paragraphFormat
          ? normalizeParagraphFormat(node.attrs.paragraphFormat)
          : undefined,
        runs: extractRuns(node.content),
      }
    case "bulletList":
      return { type: "bulletList", items: (node.content ?? []).map((item) => convertBlocks(item.content)) }
    case "orderedList":
      return { type: "orderedList", items: (node.content ?? []).map((item) => convertBlocks(item.content)) }
    case "blockquote":
      return { type: "blockquote", content: convertBlocks(node.content) }
    case "codeBlock":
      return { type: "codeBlock", text: (node.content ?? []).map((t) => t.text ?? "").join("") }
    case "horizontalRule":
      return { type: "horizontalRule" }
    case "pageBreak":
      return { type: "pageBreak" }
    case "sectionBreak":
      return {
        type: "sectionBreak",
        sectionId: String(node.attrs?.sectionId ?? ""),
        breakType: String(node.attrs?.breakType ?? "nextPage"),
      }
    case "bibliography":
      return {
        type: "bibliography",
        heading: String(node.attrs?.heading ?? "Bibliografía"),
        style: String(node.attrs?.style ?? "apa"),
        entries: Array.isArray(node.attrs?.entries)
          ? (node.attrs.entries as unknown[]).filter(
              (entry): entry is string => typeof entry === "string"
            )
          : [],
      }
    case "tableOfContents":
      return {
        type: "tableOfContents",
        title: String(node.attrs?.title ?? "Índice"),
        maxLevel: Number(node.attrs?.maxLevel ?? 3),
        entries: Array.isArray(node.attrs?.entries)
          ? (node.attrs.entries as Array<{
              id: string
              level: number
              number: string
              text: string
            }>)
          : [],
      }
    case "caption":
      return {
        type: "caption",
        id: String(node.attrs?.captionId ?? ""),
        kind: String(node.attrs?.kind ?? "figure"),
        number: Number(node.attrs?.number ?? 1),
        label: String(node.attrs?.label ?? "Figura"),
        title: String(node.attrs?.title ?? ""),
      }
    case "equation":
      return {
        type: "equation",
        id: String(node.attrs?.equationId ?? ""),
        latex: String(node.attrs?.latex ?? ""),
        number: node.attrs?.number
          ? Number(node.attrs.number)
          : undefined,
      }
    // El gráfico se exporta como la imagen que ya se está viendo. Así DOCX,
    // PDF y ODT lo tratan igual que cualquier figura, sin necesitar cada uno su
    // propia forma de dibujar barras.
    case "documentChart":
      return {
        type: "image",
        src: String(node.attrs?.image ?? ""),
        width: 560,
        height: 320,
        alt:
          String(node.attrs?.title ?? "") ||
          String(node.attrs?.seriesName ?? "Gráfico"),
        align: "center",
        wrap: "none",
      }
    case "image":
      return {
        type: "image",
        src: node.attrs?.src as string,
        width: node.attrs?.width as number | undefined,
        height: node.attrs?.height as number | undefined,
        alt: node.attrs?.alt as string | undefined,
        align:
          node.attrs?.align === "left" || node.attrs?.align === "right"
            ? node.attrs.align
            : "center",
        wrap:
          node.attrs?.wrap === "square-left" ||
          node.attrs?.wrap === "square-right" ||
          node.attrs?.wrap === "tight-left" ||
          node.attrs?.wrap === "tight-right" ||
          node.attrs?.wrap === "behind" ||
          node.attrs?.wrap === "in-front"
            ? node.attrs.wrap
            : "none",
        spacing: Math.min(
          48,
          Math.max(0, Number(node.attrs?.spacing) || 12)
        ),
      }
    case "textBox":
      return {
        type: "textBox",
        content: convertBlocks(node.content),
        width: boundedNumber(node.attrs?.width, 160, 720, 360),
        minHeight: boundedNumber(node.attrs?.minHeight, 48, 600, 96),
        align:
          node.attrs?.align === "left" || node.attrs?.align === "right"
            ? node.attrs.align
            : "center",
        position:
          node.attrs?.boxPosition === "float-left" ||
          node.attrs?.boxPosition === "float-right"
            ? node.attrs.boxPosition
            : "inline",
        background: color(node.attrs?.background, "#f8fafc"),
        borderColor: color(node.attrs?.borderColor, "#94a3b8"),
        borderStyle:
          node.attrs?.borderStyle === "none" ||
          node.attrs?.borderStyle === "dashed" ||
          node.attrs?.borderStyle === "double"
            ? node.attrs.borderStyle
            : "solid",
        padding: boundedNumber(node.attrs?.padding, 4, 48, 16),
      }
    case "documentShape": {
      const shapeType = SHAPE_TYPE_VALUES.includes(node.attrs?.shapeType)
        ? (node.attrs?.shapeType as (typeof SHAPE_TYPE_VALUES)[number])
        : "rectangle"
      const width = boundedNumber(node.attrs?.width, 24, 720, 160)
      const height = boundedNumber(node.attrs?.height, 24, 600, 100)
      const fill = color(node.attrs?.fill, "#dbeafe")
      const borderColor = color(node.attrs?.borderColor, "#2563eb")
      const borderWidth = boundedNumber(node.attrs?.borderWidth, 0, 12, 2)
      const borderStyle =
        node.attrs?.borderStyle === "none" || node.attrs?.borderStyle === "dashed"
          ? node.attrs.borderStyle
          : "solid"
      const src = renderShapeToDataUrl(
        shapeType,
        width,
        height,
        fill,
        borderColor,
        borderWidth,
        borderStyle
      )
      if (!src) return null
      return {
        type: "image",
        src,
        width,
        height,
        alt: "Forma",
        align:
          node.attrs?.align === "left" || node.attrs?.align === "right"
            ? node.attrs.align
            : "center",
        wrap: "none",
        spacing: 12,
      }
    }
    case "table":
      return {
        type: "table",
        repeatHeader: node.attrs?.repeatHeader !== false,
        allowRowBreak: node.attrs?.allowRowBreak !== false,
        tableStyle: tableStyle(node.attrs?.tableStyle),
        rows: (node.content ?? []).map((row) => ({
          cells: (row.content ?? []).map((cell) => ({
            header: cell.type === "tableHeader",
            content: convertBlocks(cell.content),
            colSpan: Number(cell.attrs?.colspan ?? 1),
            rowSpan: Number(cell.attrs?.rowspan ?? 1),
            formula:
              typeof cell.attrs?.formula === "string" &&
              cell.attrs.formula.length > 0
                ? cell.attrs.formula
                : undefined,
          })),
        })),
      }
    default:
      return null
  }
}

function convertBlocks(content: JSONContent[] | undefined): BlockNode[] {
  if (!content) return []
  const blocks: BlockNode[] = []
  for (const node of content) {
    const converted = convertBlock(node)
    if (!converted) continue
    if (Array.isArray(converted)) blocks.push(...converted)
    else blocks.push(converted)
  }
  return blocks
}

export function buildDocumentAst(doc: JSONContent): BlockNode[] {
  return convertBlocks(doc.content)
}
