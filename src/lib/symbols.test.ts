import { describe, expect, it } from "vitest"

import { isEditorSymbol, searchEditorSymbols } from "@/lib/symbols"

describe("galería de símbolos", () => {
  it("busca por nombre y categoría", () => {
    expect(searchEditorSymbols("integral").map((item) => item.value)).toEqual([
      "∫",
    ])
    expect(searchEditorSymbols("", "monedas").length).toBeGreaterThan(4)
  })

  it("solo acepta símbolos de la galería para acciones automáticas", () => {
    expect(isEditorSymbol("Ω")).toBe(true)
    expect(isEditorSymbol("<script>")).toBe(false)
  })
})
