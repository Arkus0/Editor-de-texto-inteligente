import type { Content, ContentText, Decoration, TDocumentDefinitions } from "pdfmake/interfaces"
import type { BlockNode, TableRowAst, TextRun } from "./document-ast"
import { downloadBlob } from "./download"
import { formatPageNumber } from "../page-number"
import {
  loadPdfFonts,
  mapFontStackToPdfFamily,
  PDF_FONT_FAMILY_MONOSPACE,
} from "./pdf-fonts"
import {
  createDefaultDocumentWorkspaceState,
  type DocumentWorkspaceState,
} from "../../types/document"

const ALIGN_MAP = {
  left: "left",
  center: "center",
  right: "right",
  justify: "justify",
} as const

/**
 * Las imágenes se registran en el diccionario `docDefinition.images` y se
 * referencian por clave, que es el patrón que documenta pdfmake, en vez de
 * incrustar el data URL en cada `content.image`.
 *
 * Aquí hubo un fallo que impedía exportar a PDF cualquier documento con una
 * imagen («Invalid image: Unknown image format»). Verificado el 26 de julio de
 * 2026 sobre la aplicación real con un PNG y un JPEG: el PDF resultante lleva
 * las dos imágenes incrustadas y la exportación no produce ningún error.
 */
let currentPdfImages: Record<string, string> | null = null

function registerPdfImage(dataUri: string): string {
  const key = `img_${Object.keys(currentPdfImages ?? {}).length}`
  if (currentPdfImages) currentPdfImages[key] = dataUri
  return key
}

const HEADING_STYLE: Record<number, { fontSize: number; margin: [number, number, number, number] }> = {
  1: { fontSize: 22, margin: [0, 12, 0, 8] },
  2: { fontSize: 18, margin: [0, 10, 0, 6] },
  3: { fontSize: 15, margin: [0, 8, 0, 4] },
  4: { fontSize: 13, margin: [0, 6, 0, 4] },
  5: { fontSize: 12, margin: [0, 6, 0, 4] },
  6: { fontSize: 11, margin: [0, 6, 0, 4] },
}

function runToPdfSpan(
  run: TextRun,
  footnoteNumbers: Map<string, number>
): ContentText & { sup?: boolean; sub?: boolean } {
  const decoration: Decoration[] = []
  if (run.underline || run.link) decoration.push("underline")
  if (run.strike) decoration.push("lineThrough")

  return {
    text: run.footnoteId || run.endnoteId
      ? `[${
          footnoteNumbers.get(run.footnoteId ?? run.endnoteId ?? "") ?? "?"
        }]`
      : run.text,
    bold: run.bold,
    italics: run.italic,
    decoration:
      run.revision?.type === "deletion"
        ? [...decoration, "lineThrough"]
        : decoration.length > 0
          ? decoration
          : undefined,
    color: run.color ?? (run.link ? "#2563eb" : undefined),
    background: run.highlight ?? (run.code ? "#f4f4f5" : undefined),
    link: run.link,
    fontSize: run.fontSize ? Number.parseFloat(run.fontSize) : undefined,
    font: run.code
      ? PDF_FONT_FAMILY_MONOSPACE
      : mapFontStackToPdfFamily(run.fontFamily),
    sup: run.superscript || undefined,
    sub: run.subscript || undefined,
  }
}

function paragraphPdfOptions(
  block: Extract<BlockNode, { type: "paragraph" | "heading" }>,
  fallbackMargin: [number, number, number, number]
) {
  const format = block.paragraphFormat
  return {
    margin: format
      ? ([
          format.leftIndent,
          format.spacingBefore,
          format.rightIndent,
          format.spacingAfter,
        ] as [number, number, number, number])
      : fallbackMargin,
    leadingIndent: format?.firstLineIndent || undefined,
    unbreakable: format?.keepLinesTogether || undefined,
    pageBreak: format?.pageBreakBefore ? ("before" as const) : undefined,
  }
}

function blockToContent(
  block: BlockNode,
  footnoteNumbers: Map<string, number>
): Content {
  switch (block.type) {
    case "paragraph":
      return {
        ...paragraphPdfOptions(block, [0, 0, 0, 8]),
        text: block.runs.map((run) => runToPdfSpan(run, footnoteNumbers)),
        alignment: block.align ? ALIGN_MAP[block.align] : undefined,
        lineHeight: block.lineHeight ? Number.parseFloat(block.lineHeight) : undefined,
      }
    case "heading": {
      const style = HEADING_STYLE[block.level] ?? HEADING_STYLE[3]
      return {
        ...paragraphPdfOptions(block, style.margin),
        text: [
          ...(block.outlineNumber
            ? [{ text: `${block.outlineNumber} ` }]
            : []),
          ...block.runs.map((run) => runToPdfSpan(run, footnoteNumbers)),
        ],
        fontSize: style.fontSize,
        bold: true,
        alignment: block.align ? ALIGN_MAP[block.align] : undefined,
        lineHeight: block.lineHeight ? Number.parseFloat(block.lineHeight) : undefined,
      }
    }
    case "bulletList":
      return {
        ul: block.items.map((item) =>
          item.map((child) => blockToContent(child, footnoteNumbers))
        ),
        margin: [0, 0, 0, 8],
      }
    case "orderedList":
      return {
        ol: block.items.map((item) =>
          item.map((child) => blockToContent(child, footnoteNumbers))
        ),
        margin: [0, 0, 0, 8],
      }
    case "blockquote":
      return {
        stack: block.content.map((child) =>
          blockToContent(child, footnoteNumbers)
        ),
        margin: [16, 4, 0, 8],
        italics: true,
        color: "#555555",
      }
    case "codeBlock":
      return {
        table: { widths: ["*"], body: [[{ text: block.text, fontSize: 9 }]] },
        layout: { fillColor: () => "#f4f4f5", hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 8],
      }
    case "horizontalRule":
      return {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#cccccc" }],
        margin: [0, 8, 0, 8],
      }
    case "image":
      return {
        image: registerPdfImage(block.src),
        width: Math.min(block.width ?? 300, 480),
        alignment: block.align ?? "center",
        margin: [0, 4, 0, 8],
      }
    case "textBox": {
      const borderWidth = block.borderStyle === "none" ? 0 : 1
      return {
        table: {
          widths: [Math.min(500, Math.max(120, block.width * 0.75))],
          heights: [block.minHeight * 0.75],
          body: [
            [
              {
                stack:
                  block.content.length > 0
                    ? block.content.map((child) =>
                        blockToContent(child, footnoteNumbers)
                      )
                    : [{ text: "" }],
                fillColor: block.background,
                margin: [
                  block.padding * 0.75,
                  block.padding * 0.75,
                  block.padding * 0.75,
                  block.padding * 0.75,
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => borderWidth,
          vLineWidth: () => borderWidth,
          hLineColor: () => block.borderColor,
          vLineColor: () => block.borderColor,
        },
        alignment: block.align,
        margin: [0, 6, 0, 8],
      }
    }
    case "table":
      return tableToPdfContent(block, footnoteNumbers)
    case "pageBreak":
      return { text: "", pageBreak: "after" }
    case "sectionBreak":
      return block.breakType === "continuous"
        ? { text: "" }
        : { text: "", pageBreak: "after" }
    case "bibliography":
      return {
        stack: [
          {
            text: block.heading,
            bold: true,
            fontSize: 18,
            margin: [0, 10, 0, 8],
          },
          ...block.entries.map((entry) => ({
            text: entry,
            margin: [0, 0, 0, 6] as [number, number, number, number],
          })),
        ],
      }
    case "tableOfContents":
      return {
        stack: [
          {
            text: block.title,
            bold: true,
            fontSize: 20,
            margin: [0, 10, 0, 8],
          },
          ...block.entries.map((entry) => ({
            text: `${entry.number ? `${entry.number} ` : ""}${entry.text}`,
            margin: [
              Math.max(0, entry.level - 1) * 14,
              0,
              0,
              4,
            ] as [number, number, number, number],
          })),
        ],
      }
    case "caption":
      return {
        text: `${block.label} ${block.number}${
          block.title ? `. ${block.title}` : ""
        }`,
        alignment: "center",
        italics: true,
        fontSize: 10,
        margin: [0, 2, 0, 8],
      }
    case "equation":
      return {
        text: `${block.latex}${block.number ? `    (${block.number})` : ""}`,
        alignment: "center",
        italics: true,
        fontSize: 12,
        margin: [0, 8, 0, 8],
      }
    default:
      return { text: "" }
  }
}

function blocksToPdfContent(
  ast: BlockNode[],
  footnoteNumbers: Map<string, number>
): Content[] {
  const content: Content[] = []
  for (let index = 0; index < ast.length; index += 1) {
    const block = ast[index]
    if (
      (block.type === "paragraph" || block.type === "heading") &&
      block.paragraphFormat?.keepWithNext &&
      index + 1 < ast.length
    ) {
      const stack: Content[] = [
        blockToContent(block, footnoteNumbers),
      ]
      let nextIndex = index + 1
      while (nextIndex < ast.length) {
        const nextBlock = ast[nextIndex]
        stack.push(blockToContent(nextBlock, footnoteNumbers))
        const keepFollowing =
          (nextBlock.type === "paragraph" ||
            nextBlock.type === "heading") &&
          nextBlock.paragraphFormat?.keepWithNext
        if (!keepFollowing) break
        nextIndex += 1
      }
      content.push({ stack, unbreakable: true })
      index = nextIndex
      continue
    }
    content.push(blockToContent(block, footnoteNumbers))
  }
  return content
}

function tableToPdfContent(
  block: Extract<BlockNode, { type: "table" }>,
  footnoteNumbers: Map<string, number>
): Content {
  const rows: TableRowAst[] = block.rows
  const colCount = rows[0]?.cells.length ?? 1
  return {
    table: {
      widths: Array(colCount).fill("*"),
      body: rows.map((row) =>
        row.cells.map((cell) => ({
          stack:
            cell.content.length > 0
              ? cell.content.map((child) =>
                  blockToContent(child, footnoteNumbers)
                )
              : [{ text: "" }],
          bold: cell.header,
          fillColor: cell.header ? "#eeeeee" : undefined,
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
          noWrap: false,
        }))
      ),
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 8],
  }
}

/**
 * Genera el PDF y devuelve el blob sin descargarlo, para poder empaquetar
 * varios —una combinación de correspondencia por destinatario, por ejemplo—
 * dentro de un único archivo.
 */
export async function createDocumentPdfBlob(
  ast: BlockNode[],
  workspaceState?: DocumentWorkspaceState
): Promise<Blob> {
  currentPdfImages = {}
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ])
  const pdfMake = (pdfMakeModule as unknown as { default?: typeof pdfMakeModule }).default ?? pdfMakeModule
  const vfs =
    (pdfFontsModule as unknown as { default?: Record<string, string> }).default ??
    (pdfFontsModule as unknown as Record<string, string>)
  pdfMake.addVirtualFileSystem(vfs)
  await loadPdfFonts(pdfMake)

  const state = workspaceState ?? createDefaultDocumentWorkspaceState()
  const section = state.sections[0]
  const footnoteNumbers = new Map([
    ...state.footnotes.map(
      (footnote) => [footnote.id, footnote.number] as const
    ),
    ...state.endnotes.map(
      (endnote) => [endnote.id, endnote.number] as const
    ),
  ])
  const content = blocksToPdfContent(ast, footnoteNumbers)
  if (state.footnotes.length > 0) {
    content.push(
      { text: "Notas", bold: true, margin: [0, 14, 0, 6] },
      ...state.footnotes
        .slice()
        .sort((left, right) => left.number - right.number)
        .map((footnote) => ({
          text: `[${footnote.number}] ${footnote.text}`,
          fontSize: 9,
          margin: [0, 0, 0, 4] as [number, number, number, number],
        }))
    )
  }
  if (state.endnotes.length > 0) {
    content.push(
      {
        text: "Notas finales",
        bold: true,
        pageBreak: "before",
        margin: [0, 14, 0, 6],
      },
      ...state.endnotes
        .slice()
        .sort((left, right) => left.number - right.number)
        .map((endnote) => ({
          text: `[${endnote.number}] ${endnote.text}`,
          fontSize: 9,
          margin: [0, 0, 0, 4] as [number, number, number, number],
        }))
    )
  }
  const margins = section.layout.margins
  const appearance = state.pageAppearance
  const docDefinition: TDocumentDefinitions = {
    content,
    images: currentPdfImages ?? undefined,
    defaultStyle: { fontSize: 11, lineHeight: 1.3 },
    pageSize: section.layout.pageSize === "letter" ? "LETTER" : "A4",
    pageOrientation:
      section.layout.orientation === "landscape" ? "landscape" : "portrait",
    pageMargins: [
      margins.left * 0.75,
      margins.top * 0.75,
      margins.right * 0.75,
      margins.bottom * 0.75,
    ],
    background:
      appearance.color !== "#ffffff" ||
      appearance.borderStyle !== "none"
        ? (_currentPage, pageSize) => ({
            canvas: [
              {
                type: "rect",
                x: 0,
                y: 0,
                w: pageSize.width,
                h: pageSize.height,
                color: appearance.color,
              },
              ...(appearance.borderStyle !== "none"
                ? [
                    {
                      type: "rect" as const,
                      x: 12,
                      y: 12,
                      w: pageSize.width - 24,
                      h: pageSize.height - 24,
                      lineColor: appearance.borderColor,
                      lineWidth: appearance.borderWidth * 0.75,
                      ...(appearance.borderStyle === "dashed"
                        ? { dash: { length: 5, space: 3 } }
                        : {}),
                    },
                    ...(appearance.borderStyle === "double"
                      ? [
                          {
                            type: "rect" as const,
                            x: 16,
                            y: 16,
                            w: pageSize.width - 32,
                            h: pageSize.height - 32,
                            lineColor: appearance.borderColor,
                            lineWidth: Math.max(
                              0.5,
                              appearance.borderWidth * 0.35
                            ),
                          },
                        ]
                      : []),
                  ]
                : []),
            ],
          })
        : undefined,
    watermark: appearance.watermarkText
      ? {
          text: appearance.watermarkText,
          color: appearance.watermarkColor,
          opacity: appearance.watermarkOpacity,
          angle: appearance.watermarkAngle,
          bold: true,
        }
      : undefined,
    header: section.header.default
      ? { text: section.header.default, margin: [margins.left * 0.75, 16, 0, 0] }
      : undefined,
    footer: (currentPage: number) => ({
      text: [
        section.footer.default,
        section.pageNumberPosition.startsWith("footer-")
          ? `${section.footer.default ? " · " : ""}${formatPageNumber(
              currentPage + (section.pageNumberStart ?? 1) - 1,
              section.pageNumberFormat
            )}`
          : "",
      ].join(""),
      alignment: section.pageNumberPosition.endsWith("-left")
        ? "left"
        : section.pageNumberPosition.endsWith("-right")
          ? "right"
          : "center",
      margin: [margins.left * 0.75, 0, margins.right * 0.75, 0],
    }),
  }

  try {
    const pdfDoc = pdfMake.createPdf(docDefinition)
    return await pdfDoc.getBlob()
  } finally {
    currentPdfImages = null
  }
}

export async function exportDocumentToPdf(
  ast: BlockNode[],
  filename: string,
  workspaceState?: DocumentWorkspaceState
) {
  downloadBlob(filename, await createDocumentPdfBlob(ast, workspaceState))
}
