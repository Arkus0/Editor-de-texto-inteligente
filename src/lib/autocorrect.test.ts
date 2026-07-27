import { describe, expect, it } from "vitest"

import { computeAutoCorrectEdit } from "@/lib/autocorrect"
import {
  DEFAULT_AUTOCORRECT_SETTINGS,
  type AutoCorrectSettings,
} from "@/types/document"

function settings(
  patch: Partial<AutoCorrectSettings> = {}
): AutoCorrectSettings {
  return {
    ...DEFAULT_AUTOCORRECT_SETTINGS,
    replacements: DEFAULT_AUTOCORRECT_SETTINGS.replacements.map(
      (replacement) => ({ ...replacement })
    ),
    ...patch,
  }
}

describe("autocorrección local", () => {
  it("convierte comillas, apóstrofes y doble guion según el contexto", () => {
    expect(
      computeAutoCorrectEdit({
        textBefore: "",
        insertedText: '"',
        settings: settings(),
      })
    ).toEqual({ removeBefore: 0, text: "“" })
    expect(
      computeAutoCorrectEdit({
        textBefore: "palabra",
        insertedText: '"',
        settings: settings(),
      })
    ).toEqual({ removeBefore: 0, text: "”" })
    expect(
      computeAutoCorrectEdit({
        textBefore: "d",
        insertedText: "'",
        settings: settings(),
      })
    ).toEqual({ removeBefore: 0, text: "’" })
    expect(
      computeAutoCorrectEdit({
        textBefore: "inciso-",
        insertedText: "-",
        settings: settings(),
      })
    ).toEqual({ removeBefore: 1, text: "—" })
  })

  it("aplica sustituciones al cerrar una palabra y conserva mayúsculas", () => {
    const configured = settings({
      replacements: [
        {
          id: "porque",
          from: "pq",
          to: "porque",
          caseSensitive: false,
        },
      ],
    })
    expect(
      computeAutoCorrectEdit({
        textBefore: "Pq",
        insertedText: " ",
        settings: configured,
      })
    ).toEqual({ removeBefore: 2, text: "Porque " })
    expect(
      computeAutoCorrectEdit({
        textBefore: "apq",
        insertedText: " ",
        settings: configured,
      })
    ).toBeNull()
  })

  it("borra la palabra cuando la sustitución está vacía", () => {
    // El panel permite dejar el campo «Por» en blanco y lo muestra como
    // «(vacío)»: sirve para quitarse una muletilla al escribirla. Al conservar
    // las mayúsculas del original se leía la primera letra de una cadena vacía
    // y se escribía la palabra «undefined» dentro del documento.
    const configured = settings({
      replacements: [
        { id: "muletilla", from: "osea", to: "", caseSensitive: false },
      ],
    })
    expect(
      computeAutoCorrectEdit({
        textBefore: "Osea",
        insertedText: " ",
        settings: configured,
      })
    ).toEqual({ removeBefore: 4, text: " " })
    expect(
      computeAutoCorrectEdit({
        textBefore: "osea",
        insertedText: " ",
        settings: configured,
      })
    ).toEqual({ removeBefore: 4, text: " " })
  })

  it("no inventa mayúsculas cuando el original no tiene letras", () => {
    // «(» es igual a su propia mayúscula, así que la regla entraba por la rama
    // de conservar mayúsculas sin que hubiera ninguna que conservar.
    const configured = settings({
      replacements: [
        { id: "copyright", from: "(c)", to: "©", caseSensitive: false },
      ],
    })
    expect(
      computeAutoCorrectEdit({
        textBefore: "(c)",
        insertedText: " ",
        settings: configured,
      })
    ).toEqual({ removeBefore: 3, text: "© " })
  })

  it("capitaliza solo al inicio de una oración y respeta la desactivación", () => {
    expect(
      computeAutoCorrectEdit({
        textBefore: "Final. ",
        insertedText: "á",
        settings: settings(),
      })
    ).toEqual({ removeBefore: 0, text: "Á" })
    expect(
      computeAutoCorrectEdit({
        textBefore: "mitad de frase ",
        insertedText: "a",
        settings: settings(),
      })
    ).toBeNull()
    expect(
      computeAutoCorrectEdit({
        textBefore: "",
        insertedText: "a",
        settings: settings({ enabled: false }),
      })
    ).toBeNull()
  })
})
