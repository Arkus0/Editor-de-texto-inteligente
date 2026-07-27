import type {
  BlockNode,
  FormFieldDescriptor,
  TableRowAst,
  TextRun,
} from "./document-ast"
import { downloadBlob } from "./download"
import { latexToDocxMath } from "./latex-to-docx-math"
import {
  buildBibliographyFieldInstruction,
  buildCitationFieldInstruction,
  buildPreferenceFieldInstruction,
  buildZoteroCitationPayload,
} from "../citation-csl"
import type {
  CitationClusterItem,
  CitationMode,
  CitationSource,
} from "../../types/citation"
import {
  createDefaultDocumentWorkspaceState,
  type DocumentSection,
  type DocumentStyleDefinition,
  type DocumentWorkspaceState,
  type OutlineNumberingSettings,
  type PageNumberPosition,
} from "../../types/document"

type DocxLib = typeof import("docx")

const ALIGN_MAP = {
  left: "left",
  center: "center",
  right: "right",
  justify: "both",
} as const

const HEADING_MAP = {
  1: "Heading1",
  2: "Heading2",
  3: "Heading3",
  4: "Heading4",
  5: "Heading5",
  6: "Heading6",
} as const

const ORDERED_LIST_REFERENCE = "eti-ordered-list"
const HEADING_NUMBERING_REFERENCE = "eti-heading-outline"

interface BlockOptions {
  listLevel?: number
  bullet?: boolean
  ordered?: boolean
  indent?: number
}

/**
 * Un campo de texto o desplegable pendiente de convertirse en control de Word.
 *
 * La biblioteca `docx` trae `CheckBox`, que ya emite un `w:sdt` correcto, pero
 * no tiene equivalente para `w:text` ni `w:dropDownList`, y su vía de escape
 * para XML crudo envuelve el fragmento en un elemento inválido. Así que estos
 * dos se escriben primero como una marca de texto y se sustituyen por su XML al
 * terminar, que es el mismo camino que ya usaban los cuadros de texto para su
 * apariencia VML.
 */
interface PendingFormField {
  marker: string
  field: Extract<FormFieldDescriptor, { kind: "text" | "dropdown" }>
}

/**
 * Cita pendiente de convertirse en un campo de Word.
 *
 * Hasta ahora una cita salía como texto corriente: se veía bien, pero en Word
 * era texto muerto. Zotero no la reconocía como suya, así que no se podía
 * actualizar, ni editar el localizador, ni regenerar la bibliografía al añadir
 * una fuente. Escrita como campo `ZOTERO_ITEM CSL_CITATION`, el documento sigue
 * viéndose igual para quien no tenga Zotero y recupera todo eso para quien sí.
 */
const BIBLIOGRAPHY_BEGIN_MARKER = "__ETI_BIBL_BEGIN__"
const BIBLIOGRAPHY_END_MARKER = "__ETI_BIBL_END__"

interface PendingCitation {
  marker: string
  clusterId: string
  mode: CitationMode
  items: CitationClusterItem[]
  formatted: string
}

interface ExportContext {
  comments: Map<string, number>
  footnotes: Map<string, number>
  endnotes: Map<string, number>
  revisions: Map<string, number>
  formFields: PendingFormField[]
  citations: PendingCitation[]
  outlineNumbering: OutlineNumberingSettings
  nextBookmarkId: number
  references: Map<
    string,
    {
      kind: "heading" | "caption" | "equation" | "bookmark"
      text: string
      number?: string
      nativeParagraphNumber?: boolean
    }
  >
}

function directParagraphOptions(
  block: Extract<BlockNode, { type: "paragraph" | "heading" }>,
  options: BlockOptions
) {
  const format = block.paragraphFormat
  const directLeftIndent = format ? Math.round(format.leftIndent * 20) : 0
  const indentLeft = (options.indent ?? 0) + directLeftIndent
  const indent =
    indentLeft || format?.rightIndent || format?.firstLineIndent
      ? {
          left: indentLeft || undefined,
          right: format?.rightIndent
            ? Math.round(format.rightIndent * 20)
            : undefined,
          firstLine:
            format && format.firstLineIndent > 0
              ? Math.round(format.firstLineIndent * 20)
              : undefined,
          hanging:
            format && format.firstLineIndent < 0
              ? Math.round(Math.abs(format.firstLineIndent) * 20)
              : undefined,
        }
      : undefined
  const spacing =
    block.lineHeight || format
      ? {
          before: format
            ? Math.round(format.spacingBefore * 20)
            : undefined,
          after: format
            ? Math.round(format.spacingAfter * 20)
            : undefined,
          // `atLeast` y `exactly` se miden en veinteavos de punto; `auto`, en
          // líneas de 240. Word distingue las tres por `w:lineRule`, y sin
          // escribirlo un «exacto de 24 pt» se abría como 24 líneas.
          line:
            format && format.lineSpacingRule !== "multiple"
              ? Math.round(format.lineSpacing * 20)
              : format && format.lineSpacing !== 1
                ? Math.round(format.lineSpacing * 240)
                : block.lineHeight
                  ? Math.round(Number.parseFloat(block.lineHeight) * 240)
                  : undefined,
          lineRule:
            format?.lineSpacingRule === "exactly"
              ? ("exact" as const)
              : format?.lineSpacingRule === "atLeast"
                ? ("atLeast" as const)
                : undefined,
        }
      : undefined
  return {
    indent,
    spacing,
    tabStops:
      format?.tabStops.length
        ? format.tabStops.map((position) => ({
            type: "left" as const,
            position: Math.round(position * 20),
          }))
        : undefined,
    ...(format
      ? {
          keepNext: format.keepWithNext,
          keepLines: format.keepLinesTogether,
          widowControl: format.widowOrphanControl,
          contextualSpacing: format.contextualSpacing,
          outlineLevel: format.outlineLevel || undefined,
          pageBreakBefore: format.pageBreakBefore,
          suppressLineNumbers: format.suppressLineNumbers,
        }
      : {}),
  }
}

type ParagraphChild =
  | InstanceType<DocxLib["Bookmark"]>
  | InstanceType<DocxLib["TextRun"]>
  | InstanceType<DocxLib["ExternalHyperlink"]>
  | InstanceType<DocxLib["InternalHyperlink"]>
  | InstanceType<DocxLib["FootnoteReferenceRun"]>
  | InstanceType<DocxLib["EndnoteReferenceRun"]>
  | InstanceType<DocxLib["InsertedTextRun"]>
  | InstanceType<DocxLib["DeletedTextRun"]>
  | InstanceType<DocxLib["CommentRangeStart"]>
  | InstanceType<DocxLib["CommentRangeEnd"]>
  | InstanceType<DocxLib["CommentReference"]>
  | InstanceType<DocxLib["PageBreak"]>
  | InstanceType<DocxLib["SimpleField"]>
  | InstanceType<DocxLib["NumberedItemReference"]>
  | InstanceType<DocxLib["Math"]>

function wordBookmarkId(value: string) {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  const readable = value.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 24)
  return `eti_${readable || "target"}_${(hash >>> 0).toString(36)}`.slice(
    0,
    40
  )
}

function wordSequenceId(value: string) {
  const readable = value.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 24)
  return `ETI_${readable || "item"}`
}

function collectReferenceTargets(
  blocks: BlockNode[],
  outlineNumbering: OutlineNumberingSettings
) {
  const references: ExportContext["references"] = new Map()
  const visit = (block: BlockNode) => {
    if (block.type === "heading" && block.anchorId) {
      references.set(block.anchorId, {
        kind: "heading",
        text: block.runs.map((run) => run.text).join(""),
        number: block.outlineNumber,
        nativeParagraphNumber:
          outlineNumbering.enabled && block.level <= outlineNumbering.maxLevel,
      })
    } else if (block.type === "caption" && block.id) {
      references.set(block.id, {
        kind: "caption",
        text: `${block.label} ${block.number}${
          block.title ? `. ${block.title}` : ""
        }`,
        number: String(block.number),
      })
    } else if (block.type === "equation" && block.id) {
      references.set(block.id, {
        kind: "equation",
        text: block.number ? `(${block.number})` : "Ecuación",
        number: block.number ? String(block.number) : undefined,
      })
    }
    if (
      block.type === "paragraph" ||
      block.type === "heading"
    ) {
      for (const run of block.runs) {
        if (run.bookmarkId && !references.has(run.bookmarkId)) {
          references.set(run.bookmarkId, {
            kind: "bookmark",
            text: run.bookmarkName || run.text,
          })
        }
      }
    }

    if (
      block.type === "bulletList" ||
      block.type === "orderedList"
    ) {
      for (const item of block.items) {
        for (const child of item) visit(child)
      }
    } else if (block.type === "blockquote") {
      for (const child of block.content) visit(child)
    } else if (block.type === "table") {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          for (const child of cell.content) visit(child)
        }
      }
    }
  }

  for (const block of blocks) visit(block)
  return references
}

function withBookmark(
  docxLib: DocxLib,
  targetId: string | undefined,
  children: ParagraphChild[],
  context: ExportContext
): ParagraphChild[] {
  if (!targetId) return children
  const numericId = context.nextBookmarkId
  context.nextBookmarkId += 1
  return [
    new docxLib.BookmarkStart(
      wordBookmarkId(targetId),
      numericId
    ) as unknown as ParagraphChild,
    ...children,
    new docxLib.BookmarkEnd(numericId) as unknown as ParagraphChild,
  ]
}

type FileNode =
  | InstanceType<DocxLib["Paragraph"]>
  | InstanceType<DocxLib["Table"]>
  | InstanceType<DocxLib["TableOfContents"]>
  | InstanceType<DocxLib["Textbox"]>

function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function imageTypeFromDataUrl(source: string): "jpg" | "png" | "gif" | "bmp" {
  const mime = /^data:image\/(jpeg|jpg|png|gif|bmp)/i.exec(source)?.[1]
  if (mime === "jpeg" || mime === "jpg") return "jpg"
  if (mime === "gif" || mime === "bmp") return mime
  return "png"
}

function fontSizeToHalfPoints(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.round((value.endsWith("px") ? parsed * 0.75 : parsed) * 2)
}

function toTwips(pixels: number) {
  return Math.round(pixels * 15)
}

function revisionNumber(context: ExportContext, id: string) {
  const existing = context.revisions.get(id)
  if (existing) return existing
  const next = context.revisions.size + 1
  context.revisions.set(id, next)
  return next
}

function textRunOptions(run: TextRun, text: string, breakBefore = false) {
  return {
    text,
    bold: run.bold,
    italics: run.italic,
    underline: run.underline || run.link ? {} : undefined,
    strike: run.strike,
    color: (run.color ?? (run.link ? "2563eb" : undefined))?.replace("#", ""),
    shading: run.highlight
      ? { fill: run.highlight.replace("#", "") }
      : undefined,
    font: run.code ? "Courier New" : run.fontFamily,
    size: fontSizeToHalfPoints(run.fontSize),
    superScript: run.superscript,
    subScript: run.subscript,
    break: breakBefore ? 1 : undefined,
    language: run.language ? { value: run.language } : undefined,
  }
}

function buildRunChildren(
  docxLib: DocxLib,
  run: TextRun,
  context: ExportContext
): ParagraphChild[] {
  const {
    DeletedTextRun,
    EndnoteReferenceRun,
    ExternalHyperlink,
    FootnoteReferenceRun,
    InsertedTextRun,
    NumberedItemReference,
    NumberedItemReferenceFormat,
    SimpleField,
    TextRun: DocxTextRun,
  } = docxLib

  if (run.footnoteId) {
    const reference = context.footnotes.get(run.footnoteId)
    return reference ? [new FootnoteReferenceRun(reference)] : []
  }
  if (run.endnoteId) {
    const reference = context.endnotes.get(run.endnoteId)
    return reference ? [new EndnoteReferenceRun(reference)] : []
  }

  if (run.formField) {
    if (run.formField.kind === "checkbox") {
      return [
        new docxLib.CheckBox({
          checked: run.formField.checked,
          alias: run.formField.label || "Casilla",
        }),
      ]
    }
    const marker = `__ETI_FORM_${String(
      context.formFields.length + 1
    ).padStart(4, "0")}__`
    context.formFields.push({ marker, field: run.formField })
    return [new DocxTextRun({ text: marker })]
  }

  // Una cita solo se convierte en campo si sabemos de qué fuentes se compone.
  // Sin eso el campo no tendría nada que refrescar y sería peor que el texto.
  if (run.citationClusterId && run.citationItems?.length) {
    const marker = `__ETI_CITE_${String(
      context.citations.length + 1
    ).padStart(4, "0")}__`
    context.citations.push({
      marker,
      clusterId: run.citationClusterId,
      mode: run.citationMode ?? "parenthetical",
      items: run.citationItems,
      formatted: run.text,
    })
    return [new DocxTextRun({ text: marker })]
  }

  const lines = run.text.split("\n")
  const children = lines.map((line, index) => {
    const options = textRunOptions(run, line, index > 0)
    if (run.revision?.id) {
      const revisionOptions = {
        ...options,
        id: revisionNumber(context, run.revision.id),
        author: run.revision.author || "Autor",
        date: run.revision.date || new Date().toISOString(),
      }
      return run.revision.type === "insertion"
        ? new InsertedTextRun(revisionOptions)
        : new DeletedTextRun(revisionOptions)
    }
    return new DocxTextRun(options)
  })

  if (run.crossReferenceTarget && !run.revision) {
    const bookmarkId = wordBookmarkId(run.crossReferenceTarget)
    const target = context.references.get(run.crossReferenceTarget)
    if (
      target?.kind === "heading" &&
      target.nativeParagraphNumber
    ) {
      return [
        new NumberedItemReference(bookmarkId, target.number ?? "", {
          hyperlink: true,
          referenceFormat: NumberedItemReferenceFormat.FULL_CONTEXT,
        }),
        new DocxTextRun({ text: " " }),
        new SimpleField(`REF ${bookmarkId} \\h`, target.text),
      ]
    }
    return [
      new SimpleField(`REF ${bookmarkId} \\h`, run.text || target?.text),
    ]
  }
  if (run.link && !run.revision) {
    return [new ExternalHyperlink({ link: run.link, children })]
  }
  return children
}

function buildParagraphChildren(
  docxLib: DocxLib,
  runs: TextRun[],
  context: ExportContext
): ParagraphChild[] {
  const {
    BookmarkEnd,
    BookmarkStart,
    CommentRangeEnd,
    CommentRangeStart,
    CommentReference,
  } = docxLib
  const children: ParagraphChild[] = []
  const activeComments = new Set<string>()
  let activeBookmark:
    | { id: string; numericId: number }
    | undefined

  runs.forEach((run, index) => {
    if (activeBookmark && activeBookmark.id !== run.bookmarkId) {
      children.push(
        new BookmarkEnd(activeBookmark.numericId) as unknown as ParagraphChild
      )
      activeBookmark = undefined
    }
    if (run.bookmarkId && !activeBookmark) {
      const numericId = context.nextBookmarkId
      context.nextBookmarkId += 1
      activeBookmark = { id: run.bookmarkId, numericId }
      children.push(
        new BookmarkStart(
          wordBookmarkId(run.bookmarkId),
          numericId
        ) as unknown as ParagraphChild
      )
    }
    const runComments = new Set(run.commentIds ?? [])
    for (const commentId of runComments) {
      if (activeComments.has(commentId)) continue
      const numericId = context.comments.get(commentId)
      if (numericId) {
        children.push(new CommentRangeStart(numericId))
        activeComments.add(commentId)
      }
    }

    children.push(...buildRunChildren(docxLib, run, context))

    const nextComments = new Set(runs[index + 1]?.commentIds ?? [])
    for (const commentId of [...activeComments]) {
      if (nextComments.has(commentId)) continue
      const numericId = context.comments.get(commentId)
      if (numericId) {
        children.push(
          new CommentRangeEnd(numericId),
          new CommentReference(numericId)
        )
      }
      activeComments.delete(commentId)
    }
  })
  if (activeBookmark) {
    children.push(
      new BookmarkEnd(activeBookmark.numericId) as unknown as ParagraphChild
    )
  }

  return children
}

async function blockToNodes(
  docxLib: DocxLib,
  block: BlockNode,
  context: ExportContext,
  options: BlockOptions = {}
): Promise<FileNode[]> {
  const {
    HeadingLevel,
    HorizontalPositionAlign,
    HorizontalPositionRelativeFrom,
    ImageRun,
    PageBreak,
    Paragraph,
    Table,
    TableOfContents,
    TextWrappingSide,
    TextWrappingType,
    VerticalPositionAlign,
    VerticalPositionRelativeFrom,
    WidthType,
  } = docxLib

  switch (block.type) {
    case "paragraph":
      return [
        new Paragraph({
          ...directParagraphOptions(block, options),
          children: buildParagraphChildren(docxLib, block.runs, context),
          style: block.styleId,
          alignment: block.align ? ALIGN_MAP[block.align] : undefined,
          bullet: options.bullet
            ? { level: options.listLevel ?? 0 }
            : undefined,
          numbering: options.ordered
            ? {
                reference: ORDERED_LIST_REFERENCE,
                level: options.listLevel ?? 0,
              }
            : undefined,
        }),
      ]
    case "heading": {
      const nativeOutlineNumbering =
        context.outlineNumbering.enabled &&
        block.level <= context.outlineNumbering.maxLevel
      const headingChildren = [
        ...(!nativeOutlineNumbering && block.outlineNumber
          ? [
              new docxLib.TextRun({
                text: `${block.outlineNumber} `,
              }),
            ]
          : []),
        ...buildParagraphChildren(docxLib, block.runs, context),
      ]
      return [
        new Paragraph({
          ...directParagraphOptions(block, options),
          children: withBookmark(
            docxLib,
            block.anchorId,
            headingChildren,
            context
          ),
          style: block.styleId,
          heading: block.styleId
            ? undefined
            : HeadingLevel[
                HEADING_MAP[block.level] as keyof typeof HeadingLevel
              ],
          numbering: nativeOutlineNumbering
            ? {
                reference: HEADING_NUMBERING_REFERENCE,
                level: block.level - 1,
              }
            : undefined,
          alignment: block.align ? ALIGN_MAP[block.align] : undefined,
        }),
      ]
    }
    case "bulletList": {
      const nodes: FileNode[] = []
      for (const item of block.items) {
        for (const child of item) {
          nodes.push(
            ...(await blockToNodes(docxLib, child, context, {
              ...options,
              bullet: true,
              listLevel: (options.listLevel ?? -1) + 1,
            }))
          )
        }
      }
      return nodes
    }
    case "orderedList": {
      const nodes: FileNode[] = []
      for (const item of block.items) {
        for (const child of item) {
          nodes.push(
            ...(await blockToNodes(docxLib, child, context, {
              ...options,
              ordered: true,
              listLevel: (options.listLevel ?? -1) + 1,
            }))
          )
        }
      }
      return nodes
    }
    case "blockquote": {
      const nodes: FileNode[] = []
      for (const child of block.content) {
        nodes.push(
          ...(await blockToNodes(docxLib, child, context, {
            ...options,
            indent: (options.indent ?? 0) + 720,
          }))
        )
      }
      return nodes
    }
    case "codeBlock":
      return block.text.split("\n").map(
        (line) =>
          new Paragraph({
            shading: { fill: "f4f4f5" },
            children: [
              new docxLib.TextRun({
                text: line || " ",
                font: "Courier New",
                size: 20,
              }),
            ],
          })
      )
    case "horizontalRule":
      return [
        new Paragraph({
          border: {
            bottom: {
              color: "cccccc",
              space: 1,
              style: "single",
              size: 6,
            },
          },
        }),
      ]
    case "pageBreak":
      return [new Paragraph({ children: [new PageBreak()] })]
    case "sectionBreak":
      return []
    case "bibliography":
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new docxLib.TextRun({ text: block.heading })],
        }),
        ...block.entries.map((entry, index) => {
          // Las marcas delimitan el campo `ZOTERO_BIBL`, que debe abarcar todas
          // las entradas para que Zotero pueda reescribirlas al refrescar.
          const isFirst = index === 0
          const isLast = index === block.entries.length - 1
          return new Paragraph({
            style: "Bibliography",
            children: [
              ...(isFirst
                ? [
                    new docxLib.TextRun({
                      text: BIBLIOGRAPHY_BEGIN_MARKER,
                    }),
                  ]
                : []),
              new docxLib.TextRun({ text: entry }),
              ...(isLast
                ? [new docxLib.TextRun({ text: BIBLIOGRAPHY_END_MARKER })]
                : []),
            ],
          })
        }),
      ]
    case "tableOfContents":
      return [
        new Paragraph({
          children: [
            new docxLib.TextRun({
              text: block.title,
              bold: true,
              size: 32,
              color: "2F5496",
            }),
          ],
          spacing: { before: 240, after: 160 },
        }),
        new TableOfContents(block.title, {
          hyperlink: true,
          headingStyleRange: `1-${Math.min(6, Math.max(1, block.maxLevel))}`,
        }),
      ]
    case "caption":
      return [
        new Paragraph({
          style: "Caption",
          children: withBookmark(
            docxLib,
            block.id,
            [
              new docxLib.TextRun({
                text: `${block.label} `,
              }),
              new docxLib.SimpleField(
                `SEQ ${wordSequenceId(block.kind)} \\* ARABIC`,
                String(block.number)
              ),
              ...(block.title
                ? [new docxLib.TextRun({ text: `. ${block.title}` })]
                : []),
            ],
            context
          ),
        }),
      ]
    case "equation":
      return [
        new Paragraph({
          alignment: "center",
          style: "Equation",
          children: withBookmark(
            docxLib,
            block.id,
            [
              await latexToDocxMath(docxLib, block.latex),
              ...(block.number
                ? [
                    new docxLib.TextRun({ text: "    (" }),
                    new docxLib.SimpleField(
                      `SEQ ${wordSequenceId("equation")} \\* ARABIC`,
                      String(block.number)
                    ),
                    new docxLib.TextRun({ text: ")" }),
                  ]
                : []),
            ],
            context
          ),
        }),
      ]
    case "image": {
      try {
        const data = base64ToUint8Array(block.src)
        const width = Math.min(block.width ?? 400, 550)
        const ratio =
          block.width && block.height ? block.height / block.width : 0.75
        const floating =
          block.wrap && block.wrap !== "none"
            ? {
                horizontalPosition: {
                  relative: HorizontalPositionRelativeFrom.COLUMN,
                  align:
                    block.wrap === "square-left" ||
                    block.wrap === "tight-left"
                      ? HorizontalPositionAlign.LEFT
                      : block.wrap === "square-right" ||
                          block.wrap === "tight-right"
                        ? HorizontalPositionAlign.RIGHT
                        : block.align === "left"
                          ? HorizontalPositionAlign.LEFT
                          : block.align === "right"
                            ? HorizontalPositionAlign.RIGHT
                            : HorizontalPositionAlign.CENTER,
                },
                verticalPosition: {
                  relative: VerticalPositionRelativeFrom.PARAGRAPH,
                  align: VerticalPositionAlign.TOP,
                },
                allowOverlap:
                  block.wrap === "behind" || block.wrap === "in-front",
                behindDocument: block.wrap === "behind",
                zIndex: block.wrap === "in-front" ? 251658240 : 0,
                layoutInCell: true,
                margins: {
                  top: 0,
                  bottom: toTwips(block.spacing ?? 12),
                  left:
                    block.wrap === "square-right" ||
                    block.wrap === "tight-right"
                      ? toTwips(block.spacing ?? 12)
                      : 0,
                  right:
                    block.wrap === "square-left" ||
                    block.wrap === "tight-left"
                      ? toTwips(block.spacing ?? 12)
                      : 0,
                },
                wrap: {
                  type:
                    block.wrap === "tight-left" ||
                    block.wrap === "tight-right"
                      ? TextWrappingType.TIGHT
                      : block.wrap === "behind" ||
                          block.wrap === "in-front"
                        ? TextWrappingType.NONE
                        : TextWrappingType.SQUARE,
                  side: TextWrappingSide.BOTH_SIDES,
                },
              }
            : undefined
        return [
          new Paragraph({
            alignment: floating ? undefined : block.align ?? "center",
            children: [
              new ImageRun({
                data,
                transformation: {
                  width,
                  height: Math.round(width * ratio),
                },
                type: imageTypeFromDataUrl(block.src),
                altText: {
                  name: block.alt || "Imagen",
                  description: block.alt || "",
                },
                floating,
              }),
            ],
          }),
        ]
      } catch {
        return []
      }
    }
    case "textBox": {
      const children: ParagraphChild[] = []
      for (const child of block.content) {
        if (child.type !== "paragraph" && child.type !== "heading") continue
        if (children.length > 0) {
          children.push(new docxLib.TextRun({ break: 1 }))
        }
        children.push(
          ...buildParagraphChildren(docxLib, child.runs, context)
        )
      }
      const floating = block.position !== "inline"
      return [
        new docxLib.Textbox({
          children:
            children.length > 0
              ? children
              : [new docxLib.TextRun({ text: "" })],
          alignment: ALIGN_MAP[block.align],
          style: {
            width: `${Math.round((block.width / 96) * 100) / 100}in`,
            height: `${
              Math.round((block.minHeight / 96) * 100) / 100
            }in`,
            position: floating ? "relative" : "static",
            positionHorizontal:
              block.position === "float-left"
                ? "left"
                : block.position === "float-right"
                  ? "right"
                  : block.align,
            positionHorizontalRelative: "margin",
            wrapStyle: floating ? "square" : "none",
            wrapDistanceLeft: floating ? 12 : 0,
            wrapDistanceRight: floating ? 12 : 0,
          },
        }),
      ]
    }
    case "table": {
      const tableStyle = block.tableStyle ?? "grid"
      const columnCount = Math.max(
        1,
        ...block.rows.map((row) =>
          row.cells.reduce(
            (total, cell) => total + Math.max(1, cell.colSpan ?? 1),
            0
          )
        )
      )
      const rows = await Promise.all(
        block.rows.map((row, index) =>
          tableRowToDocx(
            docxLib,
            row,
            context,
            block.repeatHeader && index === 0,
            !block.allowRowBreak,
            tableStyle,
            index
          )
        )
      )
      const visibleBorder = {
        style: docxLib.BorderStyle.SINGLE,
        color: tableStyle === "academic" ? "6B7280" : "D1D5DB",
        size: tableStyle === "academic" ? 6 : 4,
      }
      const noBorder = { style: docxLib.BorderStyle.NIL }
      const borders =
        tableStyle === "plain"
          ? {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: noBorder,
              insideVertical: noBorder,
            }
          : tableStyle === "academic"
            ? {
                top: visibleBorder,
                bottom: visibleBorder,
                left: noBorder,
                right: noBorder,
                insideHorizontal: visibleBorder,
                insideVertical: noBorder,
              }
            : {
                top: visibleBorder,
                bottom: visibleBorder,
                left: visibleBorder,
                right: visibleBorder,
                insideHorizontal: visibleBorder,
                insideVertical: visibleBorder,
              }
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: Array.from(
            { length: columnCount },
            () => Math.floor(9000 / columnCount)
          ),
          rows,
          borders,
        }),
      ]
    }
  }
}

async function tableRowToDocx(
  docxLib: DocxLib,
  row: TableRowAst,
  context: ExportContext,
  tableHeader = false,
  cantSplit = false,
  tableStyle: "plain" | "grid" | "header" | "banded" | "academic" = "grid",
  rowIndex = 0
) {
  const {
    Paragraph,
    TableCell,
    TableRow: DocxTableRow,
    WidthType,
  } = docxLib
  const cells = await Promise.all(
    row.cells.map(async (cell) => {
      const cachedFormulaValue = cell.content
        .map((block) =>
          block.type === "paragraph" || block.type === "heading"
            ? block.runs.map((run) => run.text).join("")
            : ""
        )
        .join(" ")
        .trim()
      const children = cell.formula
        ? [
            new Paragraph({
              children: [
                new docxLib.SimpleField(
                  `=${cell.formula}`,
                  cachedFormulaValue || "0"
                ),
              ],
            }),
          ]
        : (
            await Promise.all(
              cell.content.map((block) =>
                blockToNodes(docxLib, block, context)
              )
            )
          ).flat()
      const shading =
        tableStyle === "header" && (cell.header || rowIndex === 0)
          ? { fill: "D9EAF7" }
          : tableStyle === "banded" && rowIndex % 2 === 1
            ? { fill: "F3F4F6" }
            : cell.header && tableStyle !== "plain"
              ? { fill: "EEEEEE" }
              : undefined
      return new TableCell({
        children: children.length > 0 ? children : [new Paragraph({})],
        width: {
          size: 100 / Math.max(row.cells.length, 1),
          type: WidthType.PERCENTAGE,
        },
        shading,
        columnSpan: cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined,
        rowSpan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined,
      })
    })
  )
  return new DocxTableRow({ children: cells, tableHeader, cantSplit })
}

function alignmentForPosition(position: PageNumberPosition) {
  if (position.endsWith("-left")) return "left"
  if (position.endsWith("-right")) return "right"
  return "center"
}

function headerFooterParagraph(
  docxLib: DocxLib,
  text: string,
  includePageNumber: boolean,
  position: PageNumberPosition
) {
  const { PageNumber, Paragraph, TextRun } = docxLib
  const children = [
    ...(text ? [new TextRun({ text })] : []),
    ...(text && includePageNumber ? [new TextRun({ text: " · " })] : []),
    ...(includePageNumber
      ? [new TextRun({ children: [PageNumber.CURRENT] })]
      : []),
  ]
  return new Paragraph({
    alignment: includePageNumber ? alignmentForPosition(position) : "left",
    children,
  })
}

function watermarkParagraph(
  docxLib: DocxLib,
  state: DocumentWorkspaceState
) {
  const { ImportedXmlComponent, Paragraph } = docxLib
  const appearance = state.pageAppearance
  if (!appearance.watermarkText) return undefined
  const xml = (
    name: string,
    attributes?: Record<string, string>,
    children: Array<InstanceType<typeof ImportedXmlComponent>> = []
  ) => {
    const component = new ImportedXmlComponent(name, attributes)
    for (const child of children) component.push(child)
    return component
  }
  const formulas = xml(
    "v:formulas",
    undefined,
    [
      "sum #0 0 10800",
      "prod #0 2 1",
      "sum 21600 0 @1",
      "sum 0 0 @2",
      "sum 21600 0 @3",
      "if @0 @3 0",
      "if @0 21600 @1",
      "if @0 0 @2",
      "if @0 @4 21600",
    ].map((equation) => xml("v:f", { eqn: equation }))
  )
  const shapeType = xml(
    "v:shapetype",
    {
      id: "_x0000_t136",
      coordsize: "21600,21600",
      "o:spt": "136",
      adj: "10800",
      path: "m@7,l@8,m@5,21600l@6,21600e",
    },
    [
      formulas,
      xml("v:path", {
        textpathok: "t",
        "o:connecttype": "custom",
      }),
      xml("v:textpath", { on: "t", fitshape: "t" }),
    ]
  )
  const shape = xml(
    "v:shape",
    {
      id: "EditorInteligenteIAWatermark",
      "o:spid": "_x0000_s2049",
      type: "#_x0000_t136",
      style: `position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:${appearance.watermarkAngle};z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin`,
      fillcolor: appearance.watermarkColor,
      stroked: "f",
    },
    [
      xml("v:fill", { opacity: String(appearance.watermarkOpacity) }),
      xml("v:textpath", {
        style:
          'font-family:"Calibri";font-size:1pt;font-weight:bold',
        string: appearance.watermarkText,
      }),
    ]
  )
  const pict = xml("w:pict", undefined, [shapeType, shape])
  const run = xml("w:r", undefined, [pict])
  const paragraph = new Paragraph({})
  paragraph.addChildElement(run)
  return paragraph
}

function headerFooterGroups(
  docxLib: DocxLib,
  section: DocumentSection,
  state: DocumentWorkspaceState
) {
  const { Footer, Header } = docxLib
  const pageNumberInHeader = section.pageNumberPosition.startsWith("header-")
  const pageNumberInFooter = section.pageNumberPosition.startsWith("footer-")
  const headerChildren = (
    text: string,
    includePageNumber: boolean
  ) => {
    const watermark = watermarkParagraph(docxLib, state)
    return [
      ...(watermark ? [watermark] : []),
      headerFooterParagraph(
        docxLib,
        text,
        includePageNumber,
        section.pageNumberPosition
      ),
    ]
  }
  const header = {
    default: new Header({
      children: headerChildren(section.header.default, pageNumberInHeader),
    }),
    ...(section.differentFirstPage
      ? {
          first: new Header({
            children: headerChildren(section.header.first, pageNumberInHeader),
          }),
        }
      : {}),
    ...(section.differentOddEven
      ? {
          even: new Header({
            children: headerChildren(section.header.even, pageNumberInHeader),
          }),
        }
      : {}),
  }
  const footer = {
    default: new Footer({
      children: [
        headerFooterParagraph(
          docxLib,
          section.footer.default,
          pageNumberInFooter,
          section.pageNumberPosition
        ),
      ],
    }),
    ...(section.differentFirstPage
      ? {
          first: new Footer({
            children: [
              headerFooterParagraph(
                docxLib,
                section.footer.first,
                pageNumberInFooter,
                section.pageNumberPosition
              ),
            ],
          }),
        }
      : {}),
    ...(section.differentOddEven
      ? {
          even: new Footer({
            children: [
              headerFooterParagraph(
                docxLib,
                section.footer.even,
                pageNumberInFooter,
                section.pageNumberPosition
              ),
            ],
          }),
        }
      : {}),
  }
  return { headers: header, footers: footer }
}

function sectionProperties(
  docxLib: DocxLib,
  section: DocumentSection,
  state: DocumentWorkspaceState
) {
  const {
    BorderStyle,
    LineNumberRestartFormat,
    NumberFormat,
    PageBorderDisplay,
    PageBorderOffsetFrom,
    PageOrientation,
    SectionType,
  } = docxLib
  const isLetter = section.layout.pageSize === "letter"
  const width = isLetter ? 12_240 : 11_906
  const height = isLetter ? 15_840 : 16_838
  const breakTypes = {
    nextPage: SectionType.NEXT_PAGE,
    continuous: SectionType.CONTINUOUS,
    evenPage: SectionType.EVEN_PAGE,
    oddPage: SectionType.ODD_PAGE,
  }
  const pageBorder =
    state.pageAppearance.borderStyle === "none"
      ? undefined
      : {
          style: {
            solid: BorderStyle.SINGLE,
            double: BorderStyle.DOUBLE,
            dashed: BorderStyle.DASHED,
          }[state.pageAppearance.borderStyle],
          color: state.pageAppearance.borderColor.replace("#", ""),
          size: Math.max(
            4,
            Math.round(state.pageAppearance.borderWidth * 6)
          ),
          space: 12,
        }
  return {
    type: breakTypes[section.breakType],
    titlePage: section.differentFirstPage,
    page: {
      size: {
        width,
        height,
        orientation:
          section.layout.orientation === "landscape"
            ? PageOrientation.LANDSCAPE
            : PageOrientation.PORTRAIT,
      },
      margin: {
        top: toTwips(section.layout.margins.top),
        right: toTwips(section.layout.margins.right),
        bottom: toTwips(section.layout.margins.bottom),
        left: toTwips(section.layout.margins.left),
        header: toTwips(section.layout.margins.header),
        footer: toTwips(section.layout.margins.footer),
      },
      pageNumbers: {
        start: section.pageNumberStart,
        formatType: {
          decimal: NumberFormat.DECIMAL,
          lowerRoman: NumberFormat.LOWER_ROMAN,
          upperRoman: NumberFormat.UPPER_ROMAN,
          lowerLetter: NumberFormat.LOWER_LETTER,
          upperLetter: NumberFormat.UPPER_LETTER,
        }[section.pageNumberFormat],
      },
      ...(pageBorder
        ? {
            borders: {
              pageBorders: {
                display: PageBorderDisplay.ALL_PAGES,
                offsetFrom: PageBorderOffsetFrom.PAGE,
              },
              pageBorderTop: pageBorder,
              pageBorderRight: pageBorder,
              pageBorderBottom: pageBorder,
              pageBorderLeft: pageBorder,
            },
          }
        : {}),
    },
    column: {
      count: section.layout.columns,
      equalWidth: true,
      space: toTwips(section.layout.columnGap),
    },
    ...(section.layout.lineNumbers.mode !== "none"
      ? {
          lineNumbers: {
            start: section.layout.lineNumbers.start,
            countBy: section.layout.lineNumbers.countBy,
            distance: toTwips(section.layout.lineNumbers.distance),
            restart: {
              continuous: LineNumberRestartFormat.CONTINUOUS,
              newPage: LineNumberRestartFormat.NEW_PAGE,
              newSection: LineNumberRestartFormat.NEW_SECTION,
            }[section.layout.lineNumbers.mode],
          },
        }
      : {}),
  }
}

function styleOptions(style: DocumentStyleDefinition) {
  return {
    id: style.id,
    name: style.name,
    basedOn: style.basedOn,
    next: style.id.startsWith("Heading") ? "Normal" : style.id,
    quickFormat: true,
    paragraph: {
      keepNext: style.keepWithNext,
      spacing: {
        before:
          style.spacingBefore !== undefined
            ? Math.round(style.spacingBefore * 20)
            : undefined,
        after:
          style.spacingAfter !== undefined
            ? Math.round(style.spacingAfter * 20)
            : undefined,
        line:
          style.lineHeight !== undefined
            ? Math.round(style.lineHeight * 240)
            : undefined,
      },
    },
    run: {
      font: style.fontFamily,
      size:
        style.fontSize !== undefined
          ? Math.round(style.fontSize * 2)
          : undefined,
      bold: style.bold,
      italics: style.italic,
      color: style.color?.replace("#", ""),
    },
  }
}

function splitBlocksIntoSections(
  blocks: BlockNode[],
  state: DocumentWorkspaceState
) {
  const fallback = state.sections[0]
  const result: Array<{ section: DocumentSection; blocks: BlockNode[] }> = [
    { section: fallback, blocks: [] },
  ]
  for (const block of blocks) {
    if (block.type !== "sectionBreak") {
      result.at(-1)?.blocks.push(block)
      continue
    }
    const nextSection =
      state.sections.find((section) => section.id === block.sectionId) ??
      state.sections[result.length] ??
      {
        ...fallback,
        id: block.sectionId || `section-${result.length + 1}`,
        name: `Sección ${result.length + 1}`,
        breakType:
          block.breakType === "continuous" ||
          block.breakType === "evenPage" ||
          block.breakType === "oddPage"
            ? block.breakType
            : "nextPage",
      }
    result.push({ section: nextSection, blocks: [] })
  }
  return result
}

function collectTextBoxes(blocks: BlockNode[]) {
  const boxes: Array<Extract<BlockNode, { type: "textBox" }>> = []
  const visit = (block: BlockNode) => {
    if (block.type === "textBox") {
      boxes.push(block)
      block.content.forEach(visit)
    } else if (
      block.type === "bulletList" ||
      block.type === "orderedList"
    ) {
      block.items.flat().forEach(visit)
    } else if (block.type === "blockquote") {
      block.content.forEach(visit)
    } else if (block.type === "table") {
      block.rows.forEach((row) =>
        row.cells.forEach((cell) => cell.content.forEach(visit))
      )
    }
  }
  blocks.forEach(visit)
  return boxes
}

function escapeXmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replaceAll('"', "&quot;")
}

function formFieldXml(field: PendingFormField["field"]) {
  if (field.kind === "text") {
    const placeholder = field.placeholder || "Escribe aquí"
    const shown = field.value || placeholder
    // `w:showingPlcHdr` hace que Word trate el texto como marcador de posición:
    // se sustituye entero al empezar a escribir en vez de quedar mezclado.
    const asPlaceholder = field.value ? "" : "<w:showingPlcHdr/>"
    return (
      `<w:sdt><w:sdtPr><w:alias w:val="${escapeXmlAttribute(placeholder)}"/>` +
      `${asPlaceholder}<w:text/></w:sdtPr>` +
      `<w:sdtContent><w:r><w:t xml:space="preserve">${escapeXmlText(
        shown
      )}</w:t></w:r></w:sdtContent></w:sdt>`
    )
  }
  const items = field.options
    .map(
      (option) =>
        `<w:listItem w:displayText="${escapeXmlAttribute(
          option
        )}" w:value="${escapeXmlAttribute(option)}"/>`
    )
    .join("")
  const shown = field.value || "Elegir…"
  return (
    `<w:sdt><w:sdtPr><w:alias w:val="Opciones"/>` +
    `<w:dropDownList${
      field.value ? ` w:lastValue="${escapeXmlAttribute(field.value)}"` : ""
    }>${items}</w:dropDownList></w:sdtPr>` +
    `<w:sdtContent><w:r><w:t xml:space="preserve">${escapeXmlText(
      shown
    )}</w:t></w:r></w:sdtContent></w:sdt>`
  )
}

/**
 * Un campo de Word completo: `begin`, la instrucción, `separate`, el resultado
 * visible y `end`.
 *
 * El resultado va escrito en el documento, no calculado: quien abra el archivo
 * sin Zotero ve exactamente la misma cita que antes. Zotero solo entra en juego
 * si está instalado y el usuario pulsa «Refresh».
 */
function fieldXml(instruction: string, visibleText: string) {
  return (
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:instrText xml:space="preserve">${escapeXmlText(
      instruction
    )}</w:instrText></w:r>` +
    `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r><w:t xml:space="preserve">${escapeXmlText(visibleText)}</w:t></w:r>` +
    `<w:r><w:fldChar w:fldCharType="end"/></w:r>`
  )
}

/**
 * Convierte las citas marcadas en campos de Zotero.
 *
 * Se hace aquí, sobre el XML ya generado, por lo mismo que los campos de
 * formulario: la biblioteca `docx` no permite escribir un campo con instrucción
 * arbitraria, y su vía de escape para XML crudo envuelve el fragmento en un
 * elemento que Word rechaza.
 */
async function applyZoteroCitationFields(
  blob: Blob,
  citations: PendingCitation[],
  hasBibliography: boolean,
  sources: CitationSource[],
  style: string,
  locale: string
): Promise<Blob> {
  // Aunque no haya nada que convertir hay que entrar si se escribieron marcas,
  // porque si no se quedarían visibles dentro del documento.
  if (citations.length === 0 && !hasBibliography) return blob
  const sourcesById = new Map(
    sources.map((source) => [String(source.id), source])
  )
  // Sin ningún vínculo con Zotero no hay nada que reconocer al otro lado, así
  // que un campo no aportaría nada y solo ensuciaría el documento.
  const hasZoteroLinks = sources.some((source) => source.zoteroLinks?.length)

  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const documentFile = zip.file("word/document.xml")
  if (!documentFile) return blob

  let documentXml = await documentFile.async("string")
  for (const citation of citations) {
    const payload = buildZoteroCitationPayload(
      {
        id: citation.clusterId,
        mode: citation.mode,
        items: citation.items,
      },
      sourcesById,
      citation.formatted
    )
    const xml =
      hasZoteroLinks && payload.citationItems.length
        ? fieldXml(buildCitationFieldInstruction(payload), citation.formatted)
        : `<w:r><w:t xml:space="preserve">${escapeXmlText(
            citation.formatted
          )}</w:t></w:r>`
    const runPattern = markerRunPattern(citation.marker)
    documentXml = runPattern.test(documentXml)
      ? documentXml.replace(markerRunPattern(citation.marker), xml)
      : documentXml.replaceAll(citation.marker, citation.formatted)
  }

  documentXml = hasZoteroLinks
    ? applyBibliographyField(documentXml, style, locale)
    : documentXml
      .replaceAll(BIBLIOGRAPHY_BEGIN_MARKER, "")
      .replaceAll(BIBLIOGRAPHY_END_MARKER, "")

  zip.file("word/document.xml", documentXml)
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  })
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

/**
 * Envuelve la bibliografía en el campo `ZOTERO_BIBL`.
 *
 * El campo tiene que abarcar las entradas, no precederlas: Zotero sustituye lo
 * que hay entre `separate` y `end` al regenerarla. Por eso la apertura se cuela
 * en la primera entrada y el cierre en la última, en vez de ocupar párrafos
 * propios que quedarían vacíos en el documento.
 */
function applyBibliographyField(
  documentXml: string,
  style: string,
  locale: string
) {
  if (!documentXml.includes(BIBLIOGRAPHY_BEGIN_MARKER)) return documentXml
  const opening =
    fieldXml(buildPreferenceFieldInstruction(style, locale), "") +
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:instrText xml:space="preserve">${escapeXmlText(
      buildBibliographyFieldInstruction()
    )}</w:instrText></w:r>` +
    `<w:r><w:fldChar w:fldCharType="separate"/></w:r>`
  return documentXml
    .replace(markerRunPattern(BIBLIOGRAPHY_BEGIN_MARKER), opening)
    .replace(
      markerRunPattern(BIBLIOGRAPHY_END_MARKER),
      `<w:r><w:fldChar w:fldCharType="end"/></w:r>`
    )
}

/** La marca viaja dentro de un `<w:r>`, y hay que sustituir la ejecución entera. */
function markerRunPattern(marker: string) {
  return new RegExp(
    `<w:r>(?:(?!</w:r>)[\\s\\S])*?${marker}(?:(?!</w:r>)[\\s\\S])*?</w:r>`,
    "g"
  )
}

/**
 * Sustituye las marcas por controles de contenido de Word.
 *
 * Se eligió `w:sdt` y no los campos heredados `w:fldChar`/`FORMTEXT` justo por
 * lo que hace incómodos a los formularios de Word: los heredados solo se pueden
 * rellenar con el documento protegido, y esa protección se queda guardada en el
 * archivo. Un control de contenido se rellena sin proteger nada.
 */
async function applyFormFieldControls(
  blob: Blob,
  fields: PendingFormField[]
): Promise<Blob> {
  if (fields.length === 0) return blob
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const documentFile = zip.file("word/document.xml")
  if (!documentFile) return blob

  let documentXml = await documentFile.async("string")
  for (const { marker, field } of fields) {
    // La marca viaja dentro de un `<w:r><w:t>…</w:t></w:r>`; hay que reemplazar
    // la ejecución entera, porque un `w:sdt` no puede vivir dentro de un `w:r`.
    const runPattern = new RegExp(
      `<w:r>(?:(?!</w:r>)[\\s\\S])*?${marker}(?:(?!</w:r>)[\\s\\S])*?</w:r>`,
      "g"
    )
    const xml = formFieldXml(field)
    documentXml = runPattern.test(documentXml)
      ? documentXml.replace(runPattern, xml)
      : documentXml.replaceAll(marker, "")
  }

  zip.file("word/document.xml", documentXml)
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  })
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

async function applyTextBoxVmlAppearance(
  blob: Blob,
  blocks: BlockNode[]
) {
  const boxes = collectTextBoxes(blocks)
  if (boxes.length === 0) return blob
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const documentFile = zip.file("word/document.xml")
  if (!documentFile) return blob
  let index = 0
  const documentXml = (await documentFile.async("string")).replace(
    /<v:shape\b([^>]*\btype=(?:"#_x0000_t202"|'#_x0000_t202')[^>]*)>/gi,
    (shape, attributes: string) => {
      const box = boxes[index]
      index += 1
      if (!box) return shape
      const semantic = [
        "ETITextBox",
        box.background,
        box.borderColor,
        box.borderStyle,
        String(box.padding),
      ].join("|")
      const stroke =
        box.borderStyle === "none"
          ? ' stroked="f"'
          : ` strokecolor="${box.borderColor}" strokeweight="${
              box.borderStyle === "double" ? "2pt" : "0.75pt"
            }"`
      const dash =
        box.borderStyle === "dashed"
          ? '<v:stroke dashstyle="dash"/>'
          : ""
      return `<v:shape${attributes} fillcolor="${box.background}" alt="${semantic}"${stroke}>${dash}`
    }
  )
  zip.file("word/document.xml", documentXml)
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  })
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

function buildComments(docxLib: DocxLib, state: DocumentWorkspaceState) {
  const { Paragraph, TextRun } = docxLib
  const comments = []
  let nextId = state.comments.length + 1
  for (const [index, comment] of state.comments.entries()) {
    const id = index + 1
    comments.push({
      id,
      author: comment.author,
      initials: comment.initials,
      date: new Date(comment.createdAt),
      resolved: comment.resolved,
      children: [
        new Paragraph({
          children: [new TextRun({ text: comment.text })],
        }),
      ],
    })
    for (const reply of comment.replies) {
      comments.push({
        id: nextId++,
        parentId: id,
        author: reply.author,
        initials: reply.author
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 3)
          .toUpperCase(),
        date: new Date(reply.createdAt),
        children: [
          new Paragraph({
            children: [new TextRun({ text: reply.text })],
          }),
        ],
      })
    }
  }
  return comments
}

export async function exportDocumentToDocx(
  ast: BlockNode[],
  filename: string,
  state?: DocumentWorkspaceState
) {
  const blob = await createDocumentDocxBlob(ast, state)
  downloadBlob(filename, blob)
}

export async function createDocumentDocxBlob(
  ast: BlockNode[],
  state = createDefaultDocumentWorkspaceState()
): Promise<Blob> {
  const docxLib = await import("docx")
  const { Document, Packer, Paragraph, TextRun } = docxLib
  const comments = new Map(
    state.comments.map((comment, index) => [comment.id, index + 1])
  )
  const footnotes = new Map(
    state.footnotes.map((footnote) => [footnote.id, footnote.number])
  )
  const endnotes = new Map(
    state.endnotes.map((endnote) => [endnote.id, endnote.number])
  )
  const context: ExportContext = {
    comments,
    footnotes,
    endnotes,
    revisions: new Map(),
    formFields: [],
    citations: [],
    outlineNumbering: state.outlineNumbering,
    nextBookmarkId: 1,
    references: collectReferenceTargets(ast, state.outlineNumbering),
  }
  const sectionGroups = splitBlocksIntoSections(ast, state)
  const sections = await Promise.all(
    sectionGroups.map(async ({ section, blocks }) => {
      const children = (
        await Promise.all(
          blocks.map((block) => blockToNodes(docxLib, block, context))
        )
      ).flat()
      return {
        ...headerFooterGroups(docxLib, section, state),
        properties: sectionProperties(docxLib, section, state),
        children: children.length > 0 ? children : [new Paragraph({})],
      }
    })
  )
  const footnoteDefinitions = Object.fromEntries(
    state.footnotes.map((footnote) => [
      String(footnote.number),
      {
        children: [
          new Paragraph({
            style: "FootnoteText",
            children: [new TextRun({ text: footnote.text })],
          }),
        ],
      },
    ])
  )
  const endnoteDefinitions = Object.fromEntries(
    state.endnotes.map((endnote) => [
      String(endnote.number),
      {
        children: [
          new Paragraph({
            style: "EndnoteText",
            children: [new TextRun({ text: endnote.text })],
          }),
        ],
      },
    ])
  )

  const doc = new Document({
    title: "Documento de Editor Inteligente IA",
    creator: state.trackChanges.author || "Editor Inteligente IA",
    lastModifiedBy: state.trackChanges.author || "Editor Inteligente IA",
    background: {
      color: state.pageAppearance.color.replace("#", ""),
    },
    hyphenation: {
      autoHyphenation: state.pageAppearance.hyphenation,
      doNotHyphenateCaps: true,
    },
    styles: {
      default: {
        document: {
          run: {
            language: { value: state.proofingLanguage },
          },
        },
      },
      paragraphStyles: state.styles.map(styleOptions),
    },
    numbering: {
      config: [
        {
          reference: ORDERED_LIST_REFERENCE,
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: "start",
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
        {
          reference: HEADING_NUMBERING_REFERENCE,
          levels: Array.from({ length: 6 }, (_, level) => ({
            level,
            format: docxLib.LevelFormat.DECIMAL,
            text: Array.from(
              { length: level + 1 },
              (__, index) => `%${index + 1}`
            ).join(state.outlineNumbering.separator),
            alignment: docxLib.AlignmentType.START,
            suffix: docxLib.LevelSuffix.SPACE,
            style: {
              paragraph: {
                indent: {
                  left: 360 * level,
                  hanging: 240,
                },
              },
            },
          })),
        },
      ],
    },
    comments: {
      children: buildComments(docxLib, state),
    },
    footnotes: footnoteDefinitions,
    endnotes: endnoteDefinitions,
    features: {
      trackRevisions:
        state.trackChanges.enabled || context.revisions.size > 0,
      updateFields: true,
    },
    evenAndOddHeaderAndFooters: state.sections.some(
      (section) => section.differentOddEven
    ),
    sections,
  })

  const blob = await Packer.toBlob(doc)
  return applyTextBoxVmlAppearance(
    await applyZoteroCitationFields(
      await applyFormFieldControls(blob, context.formFields),
      context.citations,
      ast.some(
        (block) => block.type === "bibliography" && block.entries.length > 0
      ),
      state.bibliography.sources,
      state.bibliography.style,
      state.bibliography.locale ?? "es-ES"
    ),
    ast
  )
}
