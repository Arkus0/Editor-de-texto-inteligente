import type { Content, ContentText, Decoration, TDocumentDefinitions } from "pdfmake/interfaces"
import type { BlockNode, TableRowAst, TextRun } from "./document-ast"
import { downloadBlob } from "./download"

const ALIGN_MAP = {
  left: "left",
  center: "center",
  right: "right",
  justify: "justify",
} as const

const HEADING_STYLE: Record<number, { fontSize: number; margin: [number, number, number, number] }> = {
  1: { fontSize: 22, margin: [0, 12, 0, 8] },
  2: { fontSize: 18, margin: [0, 10, 0, 6] },
  3: { fontSize: 15, margin: [0, 8, 0, 4] },
  4: { fontSize: 13, margin: [0, 6, 0, 4] },
  5: { fontSize: 12, margin: [0, 6, 0, 4] },
  6: { fontSize: 11, margin: [0, 6, 0, 4] },
}

function runToPdfSpan(run: TextRun): ContentText {
  const decoration: Decoration[] = []
  if (run.underline || run.link) decoration.push("underline")
  if (run.strike) decoration.push("lineThrough")

  return {
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    decoration: decoration.length > 0 ? decoration : undefined,
    color: run.color ?? (run.link ? "#2563eb" : undefined),
    background: run.highlight ?? (run.code ? "#f4f4f5" : undefined),
    link: run.link,
  }
}

function blockToContent(block: BlockNode): Content {
  switch (block.type) {
    case "paragraph":
      return {
        text: block.runs.map(runToPdfSpan),
        alignment: block.align ? ALIGN_MAP[block.align] : undefined,
        margin: [0, 0, 0, 8],
      }
    case "heading": {
      const style = HEADING_STYLE[block.level] ?? HEADING_STYLE[3]
      return {
        text: block.runs.map(runToPdfSpan),
        fontSize: style.fontSize,
        bold: true,
        alignment: block.align ? ALIGN_MAP[block.align] : undefined,
        margin: style.margin,
      }
    }
    case "bulletList":
      return {
        ul: block.items.map((item) => item.map(blockToContent)),
        margin: [0, 0, 0, 8],
      }
    case "orderedList":
      return {
        ol: block.items.map((item) => item.map(blockToContent)),
        margin: [0, 0, 0, 8],
      }
    case "blockquote":
      return {
        stack: block.content.map(blockToContent),
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
        image: block.src,
        width: Math.min(block.width ?? 300, 480),
        margin: [0, 4, 0, 8],
      }
    case "table":
      return tableToPdfContent(block)
    default:
      return { text: "" }
  }
}

function tableToPdfContent(block: Extract<BlockNode, { type: "table" }>): Content {
  const rows: TableRowAst[] = block.rows
  const colCount = rows[0]?.cells.length ?? 1
  return {
    table: {
      widths: Array(colCount).fill("*"),
      body: rows.map((row) =>
        row.cells.map((cell) => ({
          stack: cell.content.length > 0 ? cell.content.map(blockToContent) : [{ text: "" }],
          bold: cell.header,
          fillColor: cell.header ? "#eeeeee" : undefined,
        }))
      ),
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 8],
  }
}

export async function exportDocumentToPdf(ast: BlockNode[], filename: string) {
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ])
  const pdfMake = (pdfMakeModule as unknown as { default?: typeof pdfMakeModule }).default ?? pdfMakeModule
  const vfs =
    (pdfFontsModule as unknown as { default?: Record<string, string> }).default ??
    (pdfFontsModule as unknown as Record<string, string>)
  pdfMake.addVirtualFileSystem(vfs)

  const docDefinition: TDocumentDefinitions = {
    content: ast.map(blockToContent),
    defaultStyle: { fontSize: 11, lineHeight: 1.3 },
    pageMargins: [56, 56, 56, 56],
  }

  const pdfDoc = pdfMake.createPdf(docDefinition)
  const blob = await pdfDoc.getBlob()
  downloadBlob(filename, blob)
}
