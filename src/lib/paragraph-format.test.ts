import { describe, expect, it } from "vitest"

import {
  DEFAULT_PARAGRAPH_FORMAT,
  normalizeParagraphFormat,
  paragraphFormatCss,
} from "@/lib/paragraph-format"

describe("profundidad del cuadro de párrafo", () => {
  it("acepta las tres reglas de interlineado de Word", () => {
    for (const rule of ["multiple", "atLeast", "exactly"] as const) {
      expect(
        normalizeParagraphFormat({ lineSpacingRule: rule }).lineSpacingRule
      ).toBe(rule)
    }
    // Cualquier otra cosa cae en el múltiplo, que es el valor seguro.
    expect(
      normalizeParagraphFormat({ lineSpacingRule: "raro" }).lineSpacingRule
    ).toBe("multiple")
  })

  it("acota el valor según la unidad de la regla", () => {
    // 1,5 líneas y 1,5 puntos no son lo mismo: un múltiplo razonable llega a
    // 10, pero «exacto» se mide en puntos y admite mucho más.
    expect(
      normalizeParagraphFormat({
        lineSpacingRule: "multiple",
        lineSpacing: 50,
      }).lineSpacing
    ).toBe(10)
    expect(
      normalizeParagraphFormat({
        lineSpacingRule: "exactly",
        lineSpacing: 50,
      }).lineSpacing
    ).toBe(50)
  })

  it("traduce «exacto» a una altura fija en el documento", () => {
    const css = paragraphFormatCss(
      normalizeParagraphFormat({ lineSpacingRule: "exactly", lineSpacing: 24 })
    )
    expect(css).toContain("line-height:24pt")
  })

  it("«mínimo» deja crecer la línea si entra algo más alto", () => {
    const css = paragraphFormatCss(
      normalizeParagraphFormat({ lineSpacingRule: "atLeast", lineSpacing: 18 })
    )
    expect(css).toContain("max(18pt")
  })

  it("no agregar espacio entre párrafos del mismo estilo anula el posterior", () => {
    const css = paragraphFormatCss(
      normalizeParagraphFormat({ spacingAfter: 12, contextualSpacing: true })
    )
    expect(css).toContain("margin-bottom:0pt")
  })

  it("guarda el nivel de esquema como un entero de 0 a 9", () => {
    expect(normalizeParagraphFormat({ outlineLevel: 3 }).outlineLevel).toBe(3)
    expect(normalizeParagraphFormat({ outlineLevel: 42 }).outlineLevel).toBe(9)
    expect(normalizeParagraphFormat({ outlineLevel: 2.6 }).outlineLevel).toBe(3)
    expect(normalizeParagraphFormat({}).outlineLevel).toBe(0)
  })

  it("un documento guardado antes de estas opciones sigue abriéndose igual", () => {
    const legacy = normalizeParagraphFormat({
      leftIndent: 36,
      spacingAfter: 8,
    })
    expect(legacy.lineSpacingRule).toBe("multiple")
    expect(legacy.lineSpacing).toBe(1)
    expect(legacy.contextualSpacing).toBe(false)
    expect(paragraphFormatCss(legacy)).not.toContain("line-height")
  })
})

describe("normalizeParagraphFormat", () => {
  it("mantiene tabulaciones ordenadas, únicas y dentro de la página", () => {
    const format = normalizeParagraphFormat({
      tabStops: [72, "36", 72.2, -4, 900, Number.NaN],
    })

    expect(format.tabStops).toEqual([36, 72, 720])
  })

  it("conserva compatibilidad con documentos anteriores sin tabulaciones", () => {
    expect(normalizeParagraphFormat(null)).toEqual(DEFAULT_PARAGRAPH_FORMAT)
  })
})
