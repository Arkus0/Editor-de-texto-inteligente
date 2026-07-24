import type { BlockNode, TableRowAst, TextRun } from "./document-ast"
import { downloadBlob } from "./download"

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

interface BlockOptions {
  listLevel?: number
  bullet?: boolean
  ordered?: boolean
  indent?: number
}

function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

type ParagraphChild = InstanceType<DocxLib["TextRun"]> | InstanceType<DocxLib["ExternalHyperlink"]>

function buildParagraphChildren(docxLib: DocxLib, runs: TextRun[]): ParagraphChild[] {
  const { TextRun: DocxTextRun, ExternalHyperlink } = docxLib
  const children: ParagraphChild[] = []
  for (const run of runs) {
    const textRuns = run.text.split("\n").map(
      (line, index, arr) =>
        new DocxTextRun({
          text: line,
          bold: run.bold,
          italics: run.italic,
          underline: run.underline || run.link ? {} : undefined,
          strike: run.strike,
          color: (run.color ?? (run.link ? "2563eb" : undefined))?.replace("#", ""),
          shading: run.highlight ? { fill: run.highlight.replace("#", "") } : undefined,
          font: run.code ? "Courier New" : undefined,
          break: index < arr.length - 1 ? 1 : undefined,
        })
    )
    if (run.link) {
      children.push(new ExternalHyperlink({ link: run.link, children: textRuns }))
    } else {
      children.push(...textRuns)
    }
  }
  return children
}

async function blockToNodes(
  docxLib: DocxLib,
  block: BlockNode,
  options: BlockOptions = {}
): Promise<(InstanceType<DocxLib["Paragraph"]> | InstanceType<DocxLib["Table"]>)[]> {
  const { Paragraph, HeadingLevel, ImageRun, Table, WidthType } = docxLib

  switch (block.type) {
    case "paragraph": {
      const children = buildParagraphChildren(docxLib, block.runs)
      return [
        new Paragraph({
          children,
          alignment: block.align ? ALIGN_MAP[block.align] : undefined,
          bullet: options.bullet ? { level: options.listLevel ?? 0 } : undefined,
          numbering: options.ordered
            ? { reference: ORDERED_LIST_REFERENCE, level: options.listLevel ?? 0 }
            : undefined,
          indent: options.indent ? { left: options.indent } : undefined,
        }),
      ]
    }
    case "heading": {
      const children = buildParagraphChildren(docxLib, block.runs)
      return [
        new Paragraph({
          children,
          heading: HeadingLevel[HEADING_MAP[block.level] as keyof typeof HeadingLevel],
          alignment: block.align ? ALIGN_MAP[block.align] : undefined,
          indent: options.indent ? { left: options.indent } : undefined,
        }),
      ]
    }
    case "bulletList": {
      const nodes: (InstanceType<DocxLib["Paragraph"]> | InstanceType<DocxLib["Table"]>)[] = []
      for (const item of block.items) {
        for (const child of item) {
          nodes.push(
            ...(await blockToNodes(docxLib, child, {
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
      const nodes: (InstanceType<DocxLib["Paragraph"]> | InstanceType<DocxLib["Table"]>)[] = []
      for (const item of block.items) {
        for (const child of item) {
          nodes.push(
            ...(await blockToNodes(docxLib, child, {
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
      const nodes: (InstanceType<DocxLib["Paragraph"]> | InstanceType<DocxLib["Table"]>)[] = []
      for (const child of block.content) {
        nodes.push(...(await blockToNodes(docxLib, child, { ...options, indent: (options.indent ?? 0) + 720 })))
      }
      return nodes
    }
    case "codeBlock": {
      return block.text.split("\n").map(
        (line) =>
          new Paragraph({
            shading: { fill: "f4f4f5" },
            children: [new docxLib.TextRun({ text: line || " ", font: "Courier New", size: 20 })],
          })
      )
    }
    case "horizontalRule": {
      return [
        new Paragraph({
          border: { bottom: { color: "cccccc", space: 1, style: "single", size: 6 } },
        }),
      ]
    }
    case "image": {
      try {
        const data = base64ToUint8Array(block.src)
        const width = Math.min(block.width ?? 400, 550)
        const ratio = block.width && block.height ? block.height / block.width : 0.75
        return [
          new Paragraph({
            children: [
              new ImageRun({
                data,
                transformation: { width, height: Math.round(width * ratio) },
                type: "png",
              }),
            ],
          }),
        ]
      } catch {
        return []
      }
    }
    case "table": {
      const rows = await Promise.all(block.rows.map((row) => tableRowToDocx(docxLib, row)))
      return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })]
    }
    default:
      return []
  }
}

async function tableRowToDocx(docxLib: DocxLib, row: TableRowAst) {
  const { TableRow: DocxTableRow, TableCell, Paragraph, WidthType } = docxLib
  const cells = await Promise.all(
    row.cells.map(async (cell) => {
      const children = (await Promise.all(cell.content.map((b) => blockToNodes(docxLib, b)))).flat()
      return new TableCell({
        children: children.length > 0 ? children : [new Paragraph({})],
        width: { size: 100 / row.cells.length, type: WidthType.PERCENTAGE },
        shading: cell.header ? { fill: "eeeeee" } : undefined,
      })
    })
  )
  return new DocxTableRow({ children: cells })
}

export async function exportDocumentToDocx(ast: BlockNode[], filename: string) {
  const docxLib = await import("docx")
  const { Document, Packer, Paragraph } = docxLib

  const children = (await Promise.all(ast.map((block) => blockToNodes(docxLib, block)))).flat()

  const doc = new Document({
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
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children: children.length > 0 ? children : [new Paragraph({})] }],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(filename, blob)
}
