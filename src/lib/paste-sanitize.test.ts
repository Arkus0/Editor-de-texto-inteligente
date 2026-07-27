import { describe, expect, it } from "vitest"

import { mergePastedFormatting } from "./paste-sanitize"

describe("mergePastedFormatting", () => {
  it("elimina fuente, tamaño y color en línea", () => {
    const html =
      '<p style="font-family: Arial; font-size: 20px; color: red;">Hola</p>'
    const result = mergePastedFormatting(html)
    expect(result).not.toContain("font-family")
    expect(result).not.toContain("font-size")
    expect(result).not.toContain("color")
    expect(result).toContain("Hola")
  })

  it("conserva negrita/cursiva/subrayado codificados como estilo en línea", () => {
    const html =
      '<span style="font-weight: bold; font-style: italic; text-decoration: underline; color: blue;">Texto</span>'
    const result = mergePastedFormatting(html)
    expect(result).toContain("font-weight: bold")
    expect(result).toContain("font-style: italic")
    expect(result).toContain("text-decoration: underline")
    expect(result).not.toContain("color")
  })

  it("conserva estructura semántica (negrita, listas, enlaces)", () => {
    const html =
      '<ul><li><b>Elemento</b> con <a href="https://example.com">enlace</a></li></ul>'
    const result = mergePastedFormatting(html)
    expect(result).toContain("<ul>")
    expect(result).toContain("<b>Elemento</b>")
    expect(result).toContain('href="https://example.com"')
  })

  it("limpia atributos de fuente en etiquetas <font> heredadas", () => {
    const html = '<font face="Comic Sans MS" color="red" size="7">Texto</font>'
    const result = mergePastedFormatting(html)
    expect(result).not.toContain("face=")
    expect(result).not.toContain("color=")
    expect(result).not.toContain("size=")
    expect(result).toContain("Texto")
  })

  it("quita el atributo style por completo si queda vacío", () => {
    const html = '<p style="font-family: Arial;">Hola</p>'
    const result = mergePastedFormatting(html)
    expect(result).not.toContain("style=")
  })
})
