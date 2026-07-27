import type { JSONContent } from "@tiptap/react"

export interface DocumentStructureChange {
  id: string
  type: "insert" | "delete" | "replace"
  current: JSONContent[]
  incoming: JSONContent[]
  currentText: string
  incomingText: string
  formatOnly: boolean
}

interface EqualStructurePart {
  type: "equal"
  current: JSONContent[]
}

interface ChangedStructurePart {
  type: "change"
  change: DocumentStructureChange
}

export interface DocumentStructureComparison {
  parts: Array<EqualStructurePart | ChangedStructurePart>
  changes: DocumentStructureChange[]
  unchangedBlocks: number
  insertedBlocks: number
  deletedBlocks: number
  replacedBlocks: number
  formattingChanges: number
  similarity: number
}

interface SequenceItem {
  type: "equal" | "insert" | "delete"
  current?: JSONContent
  incoming?: JSONContent
}

const TRANSIENT_ATTRIBUTE_KEYS = new Set([
  "anchorId",
  "captionId",
  "clusterId",
  "equationId",
])

function nodeText(node: JSONContent): string {
  if (typeof node.text === "string") return node.text
  if (node.type === "tab") return "\t"
  return (node.content ?? []).map(nodeText).join("")
}

export function describeDocumentBlock(node: JSONContent): string {
  const text = nodeText(node).replace(/\s+/gu, " ").trim()
  if (text) return text.slice(0, 180)
  if (node.type === "table") return "Tabla"
  if (node.type === "horizontalRule") return "Línea horizontal"
  if (node.type === "pageBreak") return "Salto de página"
  if (node.type === "sectionBreak") return "Salto de sección"
  if (node.type === "image") return "Imagen"
  return node.type ? `[${node.type}]` : "Bloque sin texto"
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key, entry]) =>
          entry !== undefined && !TRANSIENT_ATTRIBUTE_KEYS.has(key)
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)])
  )
}

function blockSignature(node: JSONContent) {
  return JSON.stringify(canonicalValue(node))
}

function backtrack(
  trace: Array<Map<number, number>>,
  current: JSONContent[],
  incoming: JSONContent[],
  distance: number
) {
  let x = current.length
  let y = incoming.length
  const sequence: SequenceItem[] = []

  for (let depth = distance; depth >= 0; depth -= 1) {
    const frontier = trace[depth]
    const diagonal = x - y
    const previousDiagonal =
      diagonal === -depth ||
      (diagonal !== depth &&
        (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
          (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
        ? diagonal + 1
        : diagonal - 1
    const previousX = frontier.get(previousDiagonal) ?? 0
    const previousY = previousX - previousDiagonal

    while (x > previousX && y > previousY) {
      sequence.push({
        type: "equal",
        current: current[x - 1],
        incoming: incoming[y - 1],
      })
      x -= 1
      y -= 1
    }
    if (depth === 0) break
    if (x === previousX) {
      sequence.push({ type: "insert", incoming: incoming[y - 1] })
      y -= 1
    } else {
      sequence.push({ type: "delete", current: current[x - 1] })
      x -= 1
    }
  }

  return sequence.reverse()
}

function diffBlocks(current: JSONContent[], incoming: JSONContent[]) {
  const currentSignatures = current.map(blockSignature)
  const incomingSignatures = incoming.map(blockSignature)
  const maximum = current.length + incoming.length
  const frontier = new Map<number, number>([[1, 0]])
  const trace: Array<Map<number, number>> = []

  for (let distance = 0; distance <= maximum; distance += 1) {
    trace.push(new Map(frontier))
    for (
      let diagonal = -distance;
      diagonal <= distance;
      diagonal += 2
    ) {
      const moveDown =
        diagonal === -distance ||
        (diagonal !== distance &&
          (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
            (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
      let x = moveDown
        ? (frontier.get(diagonal + 1) ?? 0)
        : (frontier.get(diagonal - 1) ?? 0) + 1
      let y = x - diagonal
      while (
        x < current.length &&
        y < incoming.length &&
        currentSignatures[x] === incomingSignatures[y]
      ) {
        x += 1
        y += 1
      }
      frontier.set(diagonal, x)
      if (x >= current.length && y >= incoming.length) {
        return backtrack(trace, current, incoming, distance)
      }
    }
  }

  return [] as SequenceItem[]
}

function joinBlockText(blocks: JSONContent[]) {
  return blocks.map(nodeText).join("\n").replace(/\s+/gu, " ").trim()
}

export function compareDocumentStructure(
  currentDocument: JSONContent,
  incomingDocument: JSONContent
): DocumentStructureComparison {
  const sequence = diffBlocks(
    currentDocument.content ?? [],
    incomingDocument.content ?? []
  )
  const parts: DocumentStructureComparison["parts"] = []
  const changes: DocumentStructureChange[] = []
  let unchangedBlocks = 0

  for (let index = 0; index < sequence.length; ) {
    if (sequence[index].type === "equal") {
      const blocks: JSONContent[] = []
      while (sequence[index]?.type === "equal") {
        const item = sequence[index]
        if (item.current) blocks.push(item.current)
        unchangedBlocks += 1
        index += 1
      }
      parts.push({ type: "equal", current: blocks })
      continue
    }

    const current: JSONContent[] = []
    const incoming: JSONContent[] = []
    while (sequence[index] && sequence[index].type !== "equal") {
      const item = sequence[index]
      if (item.current) current.push(item.current)
      if (item.incoming) incoming.push(item.incoming)
      index += 1
    }
    const currentText = joinBlockText(current)
    const incomingText = joinBlockText(incoming)
    const change: DocumentStructureChange = {
      id: `structural-change-${changes.length + 1}`,
      type:
        current.length > 0 && incoming.length > 0
          ? "replace"
          : incoming.length > 0
            ? "insert"
            : "delete",
      current,
      incoming,
      currentText,
      incomingText,
      formatOnly:
        current.length > 0 &&
        incoming.length > 0 &&
        currentText === incomingText,
    }
    changes.push(change)
    parts.push({ type: "change", change })
  }

  const insertedBlocks = changes.reduce(
    (total, change) =>
      total +
      (change.type === "insert"
        ? change.incoming.length
        : Math.max(0, change.incoming.length - change.current.length)),
    0
  )
  const deletedBlocks = changes.reduce(
    (total, change) =>
      total +
      (change.type === "delete"
        ? change.current.length
        : Math.max(0, change.current.length - change.incoming.length)),
    0
  )
  const replacedBlocks = changes.reduce(
    (total, change) =>
      total +
      (change.type === "replace"
        ? Math.min(change.current.length, change.incoming.length)
        : 0),
    0
  )
  const currentLength = currentDocument.content?.length ?? 0
  const incomingLength = incomingDocument.content?.length ?? 0

  return {
    parts,
    changes,
    unchangedBlocks,
    insertedBlocks,
    deletedBlocks,
    replacedBlocks,
    formattingChanges: changes.filter((change) => change.formatOnly).length,
    similarity: Math.round(
      (unchangedBlocks / Math.max(1, currentLength, incomingLength)) * 100
    ),
  }
}

export function mergeDocumentStructure(
  currentDocument: JSONContent,
  comparison: DocumentStructureComparison,
  acceptedChangeIds: ReadonlySet<string>
): JSONContent {
  const content = comparison.parts.flatMap((part) => {
    if (part.type === "equal") return part.current
    return acceptedChangeIds.has(part.change.id)
      ? part.change.incoming
      : part.change.current
  })
  return { ...currentDocument, type: "doc", content }
}
