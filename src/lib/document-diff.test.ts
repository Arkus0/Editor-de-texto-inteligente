import { describe, expect, it } from "vitest"

import { compareDocumentText, limitDiffSegments } from "./document-diff"

describe("comparación secuencial de documentos", () => {
  it("mantiene las repeticiones y detecta la sustitución en su posición", () => {
    const diff = compareDocumentText(
      "La tesis repite idea y después idea.",
      "La tesis repite concepto y después idea."
    )

    expect(diff.addedWords).toBe(1)
    expect(diff.removedWords).toBe(1)
    expect(diff.segments).toEqual(
      expect.arrayContaining([
        { type: "delete", text: "idea" },
        { type: "insert", text: "concepto" },
      ])
    )
    expect(
      diff.segments.filter(
        (segment) => segment.type === "equal" && segment.text.includes("idea")
      )
    ).toHaveLength(1)
  })

  it("distingue reordenaciones aunque el conjunto de palabras sea idéntico", () => {
    const diff = compareDocumentText(
      "primero segundo tercero",
      "segundo primero tercero"
    )

    expect(diff.addedWords).toBeGreaterThan(0)
    expect(diff.removedWords).toBeGreaterThan(0)
    expect(diff.changeGroups).toBeGreaterThanOrEqual(2)
  })

  it("no presenta como cambio una diferencia puramente de espacios", () => {
    const diff = compareDocumentText(
      "Uno   dos\n\nTres",
      "Uno dos\nTres"
    )

    expect(diff.addedWords).toBe(0)
    expect(diff.removedWords).toBe(0)
    expect(diff.similarity).toBe(100)
  })

  it("degrada a líneas en documentos grandes sin perder el orden", () => {
    const current = Array.from(
      { length: 6_500 },
      (_, index) => `Párrafo ${index}\n`
    ).join("")
    const incoming = current.replace(
      "Párrafo 3200\n",
      "Párrafo central revisado\n"
    )
    const diff = compareDocumentText(current, incoming)

    expect(diff.granularity).toBe("line")
    expect(diff.addedWords).toBe(3)
    expect(diff.removedWords).toBe(2)
    expect(diff.segments.some((segment) => segment.type === "equal")).toBe(true)
  })

  it("limita la vista sin alterar el resultado completo", () => {
    const diff = compareDocumentText("uno dos", "uno tres dos")
    const visible = limitDiffSegments(diff.segments, 5, 10)

    expect(visible.truncated).toBe(true)
    expect(visible.segments.reduce((sum, segment) => sum + segment.text.length, 0))
      .toBeLessThanOrEqual(5)
  })
})
