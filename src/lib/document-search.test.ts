import { describe, expect, it } from "vitest"
import { Schema, type Node as ProseMirrorNode } from "@tiptap/pm/model"

import {
  DEFAULT_SEARCH_OPTIONS,
  findDocumentMatches,
  matchIndexFromCursor,
  resolveReplacement,
  stepMatchIndex,
} from "./document-search"

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    heading: { group: "block", content: "inline*", toDOM: () => ["h1", 0] },
    image: { group: "inline", inline: true, toDOM: () => ["img"] },
    text: { group: "inline" },
  },
  marks: {
    bold: { toDOM: () => ["strong", 0] },
  },
})

function paragraph(...content: ReturnType<typeof schema.text>[]) {
  return schema.nodes.paragraph.create(null, content)
}

function docOf(...blocks: ProseMirrorNode[]) {
  return schema.nodes.doc.create(null, blocks)
}

/** Texto que el documento tiene entre dos posiciones, para comprobar que las
 *  posiciones devueltas apuntan de verdad a lo que se buscaba. */
function textAt(doc: ProseMirrorNode, from: number, to: number) {
  return doc.textBetween(from, to)
}

describe("búsqueda en el documento", () => {
  it("devuelve posiciones que enmarcan exactamente la coincidencia", () => {
    const doc = docOf(paragraph(schema.text("hola mundo hola")))
    const matches = findDocumentMatches(doc, "hola")
    expect(matches).toHaveLength(2)
    expect(textAt(doc, matches[0].from, matches[0].to)).toBe("hola")
    expect(textAt(doc, matches[1].from, matches[1].to)).toBe("hola")
    expect(matches[1].from).toBeGreaterThan(matches[0].from)
  })

  it("encuentra una palabra partida por el formato", () => {
    // "mun" normal + "do" en negrita: dos nodos de texto, una sola palabra.
    const doc = docOf(
      paragraph(
        schema.text("mun"),
        schema.text("do", [schema.marks.bold.create()])
      )
    )
    const matches = findDocumentMatches(doc, "mundo")
    expect(matches).toHaveLength(1)
    expect(textAt(doc, matches[0].from, matches[0].to)).toBe("mundo")
  })

  it("no deja que una coincidencia cruce de un párrafo al siguiente", () => {
    const doc = docOf(paragraph(schema.text("mun")), paragraph(schema.text("do")))
    expect(findDocumentMatches(doc, "mundo")).toHaveLength(0)
  })

  it("ignora mayúsculas salvo que se pida lo contrario", () => {
    const doc = docOf(paragraph(schema.text("Hola hola HOLA")))
    expect(findDocumentMatches(doc, "hola")).toHaveLength(3)
    expect(
      findDocumentMatches(doc, "hola", {
        ...DEFAULT_SEARCH_OPTIONS,
        caseSensitive: true,
      })
    ).toHaveLength(1)
  })

  it("respeta la palabra completa", () => {
    const doc = docOf(paragraph(schema.text("casa casada casa")))
    expect(findDocumentMatches(doc, "casa")).toHaveLength(3)
    expect(
      findDocumentMatches(doc, "casa", {
        ...DEFAULT_SEARCH_OPTIONS,
        wholeWord: true,
      })
    ).toHaveLength(2)
  })

  it("trata el texto como literal cuando la búsqueda no es una expresión", () => {
    const doc = docOf(paragraph(schema.text("coste: 12.50 € (oferta)")))
    expect(findDocumentMatches(doc, "12.50")).toHaveLength(1)
    // Sin escapar, el punto casaría también con "12x50"; comprobamos que no.
    const otro = docOf(paragraph(schema.text("12x50")))
    expect(findDocumentMatches(otro, "12.50")).toHaveLength(0)
    expect(findDocumentMatches(doc, "(oferta)")).toHaveLength(1)
  })

  it("no encuentra nada con una expresión regular a medio escribir", () => {
    const doc = docOf(paragraph(schema.text("texto")))
    expect(
      findDocumentMatches(doc, "(sin cerrar", {
        ...DEFAULT_SEARCH_OPTIONS,
        regex: true,
      })
    ).toHaveLength(0)
  })

  it("no se queda colgado con una expresión que casa con la cadena vacía", () => {
    const doc = docOf(paragraph(schema.text("abc")))
    const matches = findDocumentMatches(doc, "x*", {
      ...DEFAULT_SEARCH_OPTIONS,
      regex: true,
    })
    expect(matches).toHaveLength(0)
  })

  it("busca también en los títulos", () => {
    const doc = docOf(
      schema.nodes.heading.create(null, schema.text("Introducción")),
      paragraph(schema.text("cuerpo"))
    )
    expect(findDocumentMatches(doc, "Introducción")).toHaveLength(1)
  })

  it("no atraviesa una imagen como si no ocupara sitio", () => {
    const doc = docOf(
      paragraph(
        schema.text("ab"),
        schema.nodes.image.create(),
        schema.text("cd")
      )
    )
    expect(findDocumentMatches(doc, "abcd")).toHaveLength(0)
    const soloAb = findDocumentMatches(doc, "ab")
    expect(textAt(doc, soloAb[0].from, soloAb[0].to)).toBe("ab")
  })
})

describe("códigos especiales, como el menú «Especial» de Word", () => {
  it("encuentra un tabulador, que no se puede teclear en el cuadro", () => {
    const doc = docOf(paragraph(schema.text("nombre\tapellido")))
    const matches = findDocumentMatches(doc, "^t")
    expect(matches).toHaveLength(1)
    expect(textAt(doc, matches[0].from, matches[0].to)).toBe("\t")
  })

  it("encuentra dígitos, letras y espacios en blanco", () => {
    const doc = docOf(paragraph(schema.text("A1 b2")))
    expect(findDocumentMatches(doc, "^#")).toHaveLength(2)
    expect(findDocumentMatches(doc, "^$")).toHaveLength(2)
    expect(findDocumentMatches(doc, "^w")).toHaveLength(1)
  })

  it("encuentra espacios y guiones que no se distinguen a simple vista", () => {
    const doc = docOf(paragraph(schema.text("San José y anti­cuerpo")))
    expect(findDocumentMatches(doc, "^s")).toHaveLength(1)
    expect(findDocumentMatches(doc, "^-")).toHaveLength(1)
  })

  it("combina un código con texto normal", () => {
    const doc = docOf(paragraph(schema.text("cap\t1 y cap\t2")))
    expect(findDocumentMatches(doc, "cap^t")).toHaveLength(2)
  })

  it("busca un signo ^ literal con ^^", () => {
    const doc = docOf(paragraph(schema.text("2^3 y 4^5")))
    expect(findDocumentMatches(doc, "^^")).toHaveLength(2)
  })

  it("deja intacto un ^ que no abre ningún código", () => {
    const doc = docOf(paragraph(schema.text("a^z")))
    expect(findDocumentMatches(doc, "^z")).toHaveLength(1)
  })

  it("no toca los códigos si se está usando una expresión regular", () => {
    // Con expresiones activas, `^` es el ancla de principio y debe seguir
    // siéndolo; si no, se rompería cualquier búsqueda ya escrita.
    const doc = docOf(paragraph(schema.text("total")))
    expect(
      findDocumentMatches(doc, "^tot", {
        ...DEFAULT_SEARCH_OPTIONS,
        regex: true,
      })
    ).toHaveLength(1)
  })

  it("expande los códigos también al sustituir", () => {
    expect(
      resolveReplacement("\t", "^t", "^s", DEFAULT_SEARCH_OPTIONS)
    ).toBe(" ")
    expect(
      resolveReplacement("a", "a", "b^^c", DEFAULT_SEARCH_OPTIONS)
    ).toBe("b^c")
  })
})

describe("filtro por formato, como el botón «Formato» de Word", () => {
  const bold = () => schema.marks.bold.create()

  it("encuentra solo el texto que lleva el formato pedido", () => {
    const doc = docOf(
      paragraph(schema.text("casa "), schema.text("casa", [bold()]))
    )
    expect(findDocumentMatches(doc, "casa")).toHaveLength(2)
    expect(
      findDocumentMatches(doc, "casa", {
        ...DEFAULT_SEARCH_OPTIONS,
        format: { bold: true },
      })
    ).toHaveLength(1)
  })

  it("permite buscar lo que no lleva el formato", () => {
    const doc = docOf(
      paragraph(schema.text("casa "), schema.text("casa", [bold()]))
    )
    const matches = findDocumentMatches(doc, "casa", {
      ...DEFAULT_SEARCH_OPTIONS,
      format: { bold: false },
    })
    expect(matches).toHaveLength(1)
    expect(matches[0].from).toBe(1)
  })

  it("exige el formato en toda la coincidencia, no solo al principio", () => {
    // Si bastara la primera letra, al reemplazar se perdería el formato del
    // resto de la palabra.
    const doc = docOf(
      paragraph(schema.text("ca", [bold()]), schema.text("sa"))
    )
    expect(
      findDocumentMatches(doc, "casa", {
        ...DEFAULT_SEARCH_OPTIONS,
        format: { bold: true },
      })
    ).toHaveLength(0)
  })

  it("un filtro vacío no cambia nada", () => {
    const doc = docOf(paragraph(schema.text("casa")))
    expect(
      findDocumentMatches(doc, "casa", {
        ...DEFAULT_SEARCH_OPTIONS,
        format: {},
      })
    ).toHaveLength(1)
  })
})

describe("coincidir prefijo y sufijo", () => {
  it("limita al principio o al final de la palabra", () => {
    const doc = docOf(paragraph(schema.text("casa casada descasa")))
    expect(
      findDocumentMatches(doc, "casa", {
        ...DEFAULT_SEARCH_OPTIONS,
        matchPrefix: true,
      })
    ).toHaveLength(2)
    expect(
      findDocumentMatches(doc, "casa", {
        ...DEFAULT_SEARCH_OPTIONS,
        matchSuffix: true,
      })
    ).toHaveLength(2)
  })

  it("marcar las dos equivale a palabra completa y no anula la búsqueda", () => {
    const doc = docOf(paragraph(schema.text("casa casada")))
    expect(
      findDocumentMatches(doc, "casa", {
        ...DEFAULT_SEARCH_OPTIONS,
        matchPrefix: true,
        matchSuffix: true,
      })
    ).toHaveLength(1)
  })
})

describe("navegación entre coincidencias", () => {
  const matches = [
    { from: 10, to: 14 },
    { from: 40, to: 44 },
    { from: 90, to: 94 },
  ]

  it("salta a la primera coincidencia posterior al cursor", () => {
    expect(matchIndexFromCursor(matches, 0, true)).toBe(0)
    expect(matchIndexFromCursor(matches, 20, true)).toBe(1)
    expect(matchIndexFromCursor(matches, 50, true)).toBe(2)
  })

  it("da la vuelta al llegar al final", () => {
    expect(matchIndexFromCursor(matches, 200, true)).toBe(0)
    expect(matchIndexFromCursor(matches, 0, false)).toBe(2)
  })

  it("hacia atrás toma la última coincidencia anterior al cursor", () => {
    expect(matchIndexFromCursor(matches, 50, false)).toBe(1)
    expect(matchIndexFromCursor(matches, 95, false)).toBe(2)
  })

  it("avanza y retrocede dando la vuelta", () => {
    expect(stepMatchIndex(0, 3, true)).toBe(1)
    expect(stepMatchIndex(2, 3, true)).toBe(0)
    expect(stepMatchIndex(0, 3, false)).toBe(2)
    expect(stepMatchIndex(-1, 3, true)).toBe(0)
    expect(stepMatchIndex(-1, 3, false)).toBe(2)
  })

  it("sin coincidencias no hay índice", () => {
    expect(matchIndexFromCursor([], 0, true)).toBe(-1)
    expect(stepMatchIndex(0, 0, true)).toBe(-1)
  })
})

describe("texto de sustitución", () => {
  it("es literal cuando no se usan expresiones regulares", () => {
    expect(
      resolveReplacement("precio", "precio", "$1 coste", DEFAULT_SEARCH_OPTIONS)
    ).toBe("$1 coste")
  })

  it("respeta los grupos cuando sí se usan", () => {
    expect(
      resolveReplacement("2026-07-26", "(\\d{4})-(\\d{2})-(\\d{2})", "$3/$2/$1", {
        ...DEFAULT_SEARCH_OPTIONS,
        regex: true,
      })
    ).toBe("26/07/2026")
  })
})
