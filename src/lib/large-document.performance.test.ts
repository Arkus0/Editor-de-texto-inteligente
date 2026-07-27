import { performance } from "node:perf_hooks"
import { describe, expect, it } from "vitest"

import { createDefaultDocumentWorkspaceState } from "@/types/document"
import { buildEditorAssistantContext } from "./editor-assistant"
import { buildDocumentAst } from "./export/document-ast"

function createLargeAcademicDocument(paragraphCount: number) {
  const content = Array.from({ length: paragraphCount }, (_, index) => {
    if (index % 250 === 0) {
      return {
        type: "heading",
        attrs: {
          level: (index % 750 === 0 ? 1 : 2) as 1 | 2,
          anchorId: `heading-${index}`,
        },
        content: [
          {
            type: "text",
            text: `Apartado académico ${index}`,
          },
        ],
      }
    }
    if (index % 400 === 0) {
      return {
        type: "table",
        attrs: { repeatHeader: true, allowRowBreak: false },
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: `Dato ${index}` }],
                  },
                ],
              },
              {
                type: "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Resultado" }],
                  },
                ],
              },
            ],
          },
        ],
      }
    }
    return {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `Párrafo ${index}. Argumentación, evidencia y conclusión provisional.`,
          marks:
            index % 17 === 0
              ? [
                  { type: "italic" },
                  {
                    type: "proofingLanguage",
                    attrs: { language: "es-ES" },
                  },
                ]
              : undefined,
        },
      ],
    }
  })

  return { type: "doc", content }
}

describe("rendimiento con documentos académicos grandes", () => {
  it("analiza 7.500 bloques sin bloquear el trabajo del editor", () => {
    const document = createLargeAcademicDocument(7_500)
    const workspace = createDefaultDocumentWorkspaceState()

    const start = performance.now()
    const ast = buildDocumentAst(document)
    const assistantContext = buildEditorAssistantContext(
      document,
      workspace,
      false
    )
    const elapsed = performance.now() - start

    expect(ast).toHaveLength(7_500)
    expect(assistantContext).toContain("títulos=30")
    expect(assistantContext).toContain("tablas=15")
    expect(assistantContext.length).toBeLessThan(25_000)
    expect(elapsed).toBeLessThan(2_000)
  })
})
