import { describe, expect, it } from "vitest"

import { auditDocumentAccessibility } from "./accessibility-checker"

describe("auditDocumentAccessibility", () => {
  it("detecta imágenes, estructura, enlaces y tablas problemáticas", () => {
    const report = auditDocumentAccessibility(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Resumen" }],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Resultados" }],
          },
          { type: "image", attrs: { src: "chart.png", alt: "" } },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "aquí",
                marks: [{ type: "link", attrs: { href: "" } }],
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
                    content: [{ type: "paragraph" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { title: "Documento sin título", language: "" }
    )

    expect(report.errors).toBe(3)
    expect(report.warnings).toBe(4)
    expect(report.issues.map((issue) => issue.rule)).toEqual(
      expect.arrayContaining([
        "document-title",
        "document-language",
        "image-alt",
        "heading-order",
        "link-target",
        "link-text",
        "table-header",
      ])
    )
    expect(report.score).toBeLessThan(50)
  })

  it("acepta un documento bien estructurado", () => {
    const report = auditDocumentAccessibility(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Informe de resultados" }],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Datos" }],
          },
          { type: "image", attrs: { src: "chart.png", alt: "Ventas por mes" } },
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
                ],
              },
            ],
          },
        ],
      },
      { title: "Informe trimestral", language: "es-ES" }
    )

    expect(report.errors).toBe(0)
    expect(report.warnings).toBe(0)
    expect(report.score).toBe(100)
  })

  it("comprueba contraste explícito y párrafos excesivamente largos", () => {
    const words = Array.from({ length: 85 }, (_, index) => `palabra${index}`).join(
      " "
    )
    const report = auditDocumentAccessibility(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: words,
                marks: [
                  { type: "textStyle", attrs: { color: "#ffffff" } },
                  { type: "highlight", attrs: { color: "#fff3a3" } },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Documento accesible",
        language: "es-ES",
        longParagraphWords: 80,
      }
    )

    expect(report.issues.map((issue) => issue.rule)).toEqual([
      "text-contrast",
      "long-paragraph",
    ])
  })
})
