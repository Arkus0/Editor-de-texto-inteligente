import type { JSONContent } from "@tiptap/react"

export type Align = "left" | "center" | "right" | "justify"

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
}

export type BlockNode =
  | { type: "paragraph"; align?: Align; runs: TextRun[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; align?: Align; runs: TextRun[] }
  | { type: "bulletList"; items: BlockNode[][] }
  | { type: "orderedList"; items: BlockNode[][] }
  | { type: "blockquote"; content: BlockNode[] }
  | { type: "codeBlock"; text: string }
  | { type: "horizontalRule" }
  | { type: "image"; src: string; width?: number; height?: number; alt?: string }
  | { type: "table"; rows: TableRowAst[] }

export interface TableRowAst {
  cells: { header: boolean; content: BlockNode[] }[]
}

function extractRuns(content: JSONContent[] | undefined): TextRun[] {
  if (!content) return []
  const runs: TextRun[] = []
  for (const node of content) {
    if (node.type === "hardBreak") {
      runs.push({ text: "\n" })
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
      else if (mark.type === "link") run.link = mark.attrs?.href as string | undefined
      else if (mark.type === "textStyle" && mark.attrs?.color) run.color = mark.attrs.color as string
      else if (mark.type === "highlight") run.highlight = (mark.attrs?.color as string) ?? "#fff3a3"
    }
    runs.push(run)
  }
  return runs
}

function convertBlock(node: JSONContent): BlockNode | BlockNode[] | null {
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", align: node.attrs?.textAlign as Align | undefined, runs: extractRuns(node.content) }
    case "heading":
      return {
        type: "heading",
        level: (node.attrs?.level as 1 | 2 | 3 | 4 | 5 | 6) ?? 1,
        align: node.attrs?.textAlign as Align | undefined,
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
    case "image":
      return {
        type: "image",
        src: node.attrs?.src as string,
        width: node.attrs?.width as number | undefined,
        height: node.attrs?.height as number | undefined,
        alt: node.attrs?.alt as string | undefined,
      }
    case "table":
      return {
        type: "table",
        rows: (node.content ?? []).map((row) => ({
          cells: (row.content ?? []).map((cell) => ({
            header: cell.type === "tableHeader",
            content: convertBlocks(cell.content),
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
