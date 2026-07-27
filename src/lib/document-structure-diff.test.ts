import { describe, expect, it } from "vitest"

import {
  compareDocumentStructure,
  mergeDocumentStructure,
} from "./document-structure-diff"

describe("comparación estructural de documentos", () => {
  const current = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, anchorId: "generated-a" },
        content: [{ type: "text", text: "Informe" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Versión original" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Elemento" }],
              },
            ],
          },
        ],
      },
    ],
  }

  const incoming = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, anchorId: "generated-b" },
        content: [{ type: "text", text: "Informe" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [{ type: "bold" }],
            text: "Versión revisada",
          },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Elemento" }],
              },
            ],
          },
        ],
      },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Dato" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  it("detecta reemplazos e inserciones sin confundir identificadores generados", () => {
    const comparison = compareDocumentStructure(current, incoming)

    expect(comparison.unchangedBlocks).toBe(2)
    expect(comparison.replacedBlocks).toBe(1)
    expect(comparison.insertedBlocks).toBe(1)
    expect(comparison.changes).toHaveLength(2)
    expect(comparison.similarity).toBe(50)
  })

  it("combina únicamente los grupos aceptados y conserva los demás bloques", () => {
    const comparison = compareDocumentStructure(current, incoming)
    const replacement = comparison.changes.find(
      (change) => change.type === "replace"
    )
    expect(replacement).toBeDefined()

    const merged = mergeDocumentStructure(
      current,
      comparison,
      new Set([replacement!.id])
    )

    expect(merged.content).toHaveLength(3)
    expect(merged.content?.[1]).toEqual(incoming.content[1])
    expect(merged.content?.[2]).toEqual(current.content[2])
  })

  it("marca cambios de formato aunque el texto sea idéntico", () => {
    const comparison = compareDocumentStructure(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Mismo texto" }],
          },
        ],
      },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [{ type: "text", text: "Mismo texto" }],
          },
        ],
      }
    )

    expect(comparison.formattingChanges).toBe(1)
    expect(comparison.changes[0].formatOnly).toBe(true)
  })
})
