export type ReaderBlockKind =
  | "heading"
  | "paragraph"
  | "listItem"
  | "quote"
  | "caption"
  | "equation"
  | "table"

export interface ReaderBlock {
  id: string
  kind: ReaderBlockKind
  text: string
  level?: number
}

interface DocumentNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: DocumentNode[]
}

function textContent(node: DocumentNode): string {
  if (node.type === "text") return node.text ?? ""
  return (node.content ?? []).map(textContent).join("")
}

function normalizedText(node: DocumentNode): string {
  return textContent(node).replace(/\s+/gu, " ").trim()
}

function tableText(node: DocumentNode): string {
  const rows = (node.content ?? [])
    .filter((child) => child.type === "tableRow")
    .map((row) =>
      (row.content ?? [])
        .map((cell) => normalizedText(cell))
        .filter(Boolean)
        .join("; ")
    )
    .filter(Boolean)
  return rows.join(". ")
}

export function extractReaderBlocks(
  input: unknown,
  limit = 2_000
): ReaderBlock[] {
  const document = (input && typeof input === "object" ? input : {}) as DocumentNode
  const blocks: ReaderBlock[] = []

  const add = (
    kind: ReaderBlockKind,
    text: string,
    level?: number
  ) => {
    const normalized = text.replace(/\s+/gu, " ").trim()
    if (!normalized || blocks.length >= limit) return
    blocks.push({
      id: `reader-block-${blocks.length + 1}`,
      kind,
      text: normalized,
      ...(level ? { level } : {}),
    })
  }

  const walk = (node: DocumentNode) => {
    if (blocks.length >= limit) return
    const type = node.type

    if (type === "heading") {
      add(
        "heading",
        normalizedText(node),
        Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))
      )
      return
    }
    if (type === "paragraph") {
      add("paragraph", normalizedText(node))
      return
    }
    if (type === "listItem") {
      add("listItem", normalizedText(node))
      return
    }
    if (type === "blockquote") {
      add("quote", normalizedText(node))
      return
    }
    if (type === "caption") {
      const label = String(node.attrs?.label ?? "Figura")
      const number = String(node.attrs?.number ?? "")
      const title = String(node.attrs?.title ?? "")
      add("caption", `${label} ${number}. ${title}`)
      return
    }
    if (type === "equation") {
      const number = String(node.attrs?.number ?? "")
      const latex = String(node.attrs?.latex ?? "")
      add("equation", `Ecuación ${number}. ${latex}`)
      return
    }
    if (type === "table") {
      add("table", `Tabla. ${tableText(node)}`)
      return
    }

    for (const child of node.content ?? []) walk(child)
  }

  walk(document)
  return blocks
}
