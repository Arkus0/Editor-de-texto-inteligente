import { describe, expect, it } from "vitest"

import { extractReaderBlocks } from "./reader-content"

describe("extractReaderBlocks", () => {
  it("conserva la jerarquía y los objetos que se pueden leer", () => {
    const blocks = extractReaderBlocks({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Resultados" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "  Primer   resultado. " }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Elemento uno" }],
                },
              ],
            },
          ],
        },
        {
          type: "caption",
          attrs: { label: "Figura", number: 3, title: "Evolución anual" },
        },
        {
          type: "equation",
          attrs: { number: 2, latex: "E = mc^2" },
        },
      ],
    })

    expect(blocks).toEqual([
      {
        id: "reader-block-1",
        kind: "heading",
        text: "Resultados",
        level: 2,
      },
      {
        id: "reader-block-2",
        kind: "paragraph",
        text: "Primer resultado.",
      },
      {
        id: "reader-block-3",
        kind: "listItem",
        text: "Elemento uno",
      },
      {
        id: "reader-block-4",
        kind: "caption",
        text: "Figura 3. Evolución anual",
      },
      {
        id: "reader-block-5",
        kind: "equation",
        text: "Ecuación 2. E = mc^2",
      },
    ])
  })

  it("convierte una tabla en una lectura comprensible por filas", () => {
    const [table] = extractReaderBlocks({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Mes" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Ventas" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Enero" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "42" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    expect(table.text).toBe("Tabla. Mes; Ventas. Enero; 42")
  })

  it("limita documentos enormes sin recorrer más contenido del necesario", () => {
    const blocks = extractReaderBlocks(
      {
        type: "doc",
        content: Array.from({ length: 20 }, (_, index) => ({
          type: "paragraph",
          content: [{ type: "text", text: `Párrafo ${index + 1}` }],
        })),
      },
      5
    )

    expect(blocks).toHaveLength(5)
    expect(blocks.at(-1)?.text).toBe("Párrafo 5")
  })
})
