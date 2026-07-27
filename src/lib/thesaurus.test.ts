import { describe, expect, it } from "vitest"

import {
  decodeMyThes,
  parseMyThesText,
  thesaurusFilename,
} from "@/lib/thesaurus"

describe("tesauro MyThes local", () => {
  it("agrupa acepciones, elimina relaciones no equivalentes y duplicados", () => {
    const text = `UTF-8
análisis|2
(noun)|examen|estudio|materia (generic term)|examen
-|evaluación|observación
otra|1
-|distinta`

    expect(parseMyThesText(text, "análisis", "es-ES")).toEqual({
      word: "análisis",
      language: "es-ES",
      source: "libreoffice-mythes",
      available: true,
      meanings: [
        { label: "noun", synonyms: ["examen", "estudio"] },
        { label: "Sinónimos", synonyms: ["evaluación", "observación"] },
      ],
    })
  })

  it("tolera búsquedas sin tilde y detecta la codificación declarada", () => {
    const latinText = `ISO8859-1
rápido|1
-|veloz|ligero`
    const encoded = Uint8Array.from(
      latinText.split("").map((character) => character.charCodeAt(0))
    ).buffer

    expect(parseMyThesText(decodeMyThes(encoded), "rapido").word).toBe(
      "rápido"
    )
  })

  it("selecciona el tesauro español o inglés según el idioma de corrección", () => {
    expect(thesaurusFilename("es-MX")).toBe("th_es_v2.dat")
    expect(thesaurusFilename("en-GB")).toBe("th_en_US_v2.dat")
    expect(thesaurusFilename("fr-FR")).toBeNull()
  })
})
