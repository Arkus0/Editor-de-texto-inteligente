import { describe, expect, it } from "vitest"

import { transformCase } from "@/lib/text-case"

describe("transformCase", () => {
  it("pasa a minúsculas", () => {
    expect(transformCase("Hola MUNDO", "lower")).toBe("hola mundo")
  })

  it("pasa a MAYÚSCULAS respetando acentos", () => {
    expect(transformCase("día soleado", "upper")).toBe("DÍA SOLEADO")
  })

  it("aplica may. de tipo oración tras punto, interrogación y exclamación", () => {
    expect(transformCase("hola. ¿qué tal? bien! genial", "sentence")).toBe(
      "Hola. ¿Qué tal? Bien! Genial"
    )
  })

  it("pone en mayúscula cada palabra relevante, sin tocar conectores intermedios", () => {
    expect(transformCase("el gato de la casa", "title")).toBe("El Gato de la Casa")
  })

  it("mantiene en mayúscula la última palabra aunque sea un conector", () => {
    expect(transformCase("una historia de", "title")).toBe("Una Historia De")
  })

  it("no cambia de criterio por la puntuación que cierre la frase", () => {
    // Se detectaba la última palabra por su distancia al final de la cadena, así
    // que un punto, unas comillas o un espacio de más la degradaban a conector.
    expect(transformCase("una historia de.", "title")).toBe("Una Historia De.")
    expect(transformCase("una historia de ", "title")).toBe("Una Historia De ")
    expect(transformCase("«una historia de»", "title")).toBe("«Una Historia De»")
    expect(transformCase("the world we live in!", "title")).toBe(
      "The World We Live In!"
    )
  })

  it("invierte mayúsculas y minúsculas carácter a carácter", () => {
    expect(transformCase("Hola Mundo", "toggle")).toBe("hOLA mUNDO")
  })

  it("no cambia el número de caracteres", () => {
    const original = "Café con leche, ¿vale?"
    for (const mode of ["sentence", "lower", "upper", "title", "toggle"] as const) {
      expect(transformCase(original, mode)).toHaveLength(original.length)
    }
  })
})
