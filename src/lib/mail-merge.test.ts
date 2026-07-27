import { describe, expect, it } from "vitest"

import {
  applyMailMergeRecord,
  buildMailMergeBatchHtml,
  buildMailMergeDocuments,
  extractMailMergeFields,
  parseMailMergeDataset,
} from "@/lib/mail-merge"

describe("combinación de correspondencia local", () => {
  it("detecta CSV europeo y conserva comillas, comas y saltos", () => {
    const dataset = parseMailMergeDataset(
      '\uFEFFNombre;Ciudad;Nota\r\n"Ana";Madrid;"Línea 1\r\nLínea 2"\r\n"Luis";"A Coruña";"Importe: 1,50 €"'
    )

    expect(dataset.delimiter).toBe(";")
    expect(dataset.fields).toEqual(["Nombre", "Ciudad", "Nota"])
    expect(dataset.records).toEqual([
      { Nombre: "Ana", Ciudad: "Madrid", Nota: "Línea 1\r\nLínea 2" },
      {
        Nombre: "Luis",
        Ciudad: "A Coruña",
        Nota: "Importe: 1,50 €",
      },
    ])
  })

  it("desambigua encabezados repetidos y limita campos vacíos", () => {
    const dataset = parseMailMergeDataset(
      "Nombre,Nombre,\nAna,Ana López,Valor"
    )
    expect(dataset.fields).toEqual(["Nombre", "Nombre (2)", "Campo 3"])
  })

  it("inserta valores escapados y comunica campos ausentes", () => {
    const result = applyMailMergeRecord(
      "<p>Hola {{ Nombre }} de {{Empresa}}. {{Falta}}</p>",
      { nombre: "Ana & Luis", Empresa: "<ACME>" }
    )

    expect(result.html).toBe(
      "<p>Hola Ana &amp; Luis de &lt;ACME&gt;. {{Falta}}</p>"
    )
    expect(result.missingFields).toEqual(["Falta"])
  })

  it("crea un lote con saltos de página nativos", () => {
    const template = "<p>Certificado de {{Nombre}}</p>"
    expect(extractMailMergeFields(template)).toEqual(["Nombre"])
    const result = buildMailMergeBatchHtml(template, [
      { Nombre: "Ana" },
      { Nombre: "Luis" },
    ])
    expect(result.html).toBe(
      '<p>Certificado de Ana</p><div data-page-break="true"></div><p>Certificado de Luis</p>'
    )
  })
})

describe("un documento por destinatario", () => {
  const template = "<p>Hola {{Nombre}}, tu pauta es {{Pauta}}.</p>"

  it("genera un documento independiente por fila", () => {
    const documents = buildMailMergeDocuments(
      template,
      [
        { Nombre: "Ana Ruiz", Pauta: "1500 kcal" },
        { Nombre: "Luis Prat", Pauta: "1800 kcal" },
      ],
      "Nombre"
    )

    expect(documents).toHaveLength(2)
    expect(documents[0].html).toContain("Hola Ana Ruiz")
    expect(documents[0].html).not.toContain("Luis")
    expect(documents[1].html).toContain("1800 kcal")
  })

  it("nombra cada archivo con la columna elegida", () => {
    const documents = buildMailMergeDocuments(
      template,
      [{ Nombre: "Ana Ruiz", Pauta: "x" }],
      "Nombre"
    )
    expect(documents[0].name).toBe("Ana Ruiz")
  })

  it("no deja que dos personas con el mismo nombre se pisen", () => {
    const documents = buildMailMergeDocuments(
      template,
      [
        { Nombre: "Ana Ruiz", Pauta: "a" },
        { Nombre: "Ana Ruiz", Pauta: "b" },
        { Nombre: "Ana Ruiz", Pauta: "c" },
      ],
      "Nombre"
    )
    expect(new Set(documents.map((item) => item.name)).size).toBe(3)
  })

  it("quita del nombre lo que el sistema de archivos no admite", () => {
    const documents = buildMailMergeDocuments(
      template,
      [{ Nombre: 'Ana/Ruiz: informe "2026"?', Pauta: "x" }],
      "Nombre"
    )
    expect(documents[0].name).not.toMatch(/[\/:*?"<>|]/)
    expect(documents[0].name).toContain("Ana")
  })

  it("distingue nombres que solo cambian en mayúsculas", () => {
    // Windows y macOS no diferencian «ana» de «Ana»: son dos entradas del ZIP,
    // pero un único archivo al descomprimirlo, y la segunda pisaba a la primera.
    const documents = buildMailMergeDocuments(
      template,
      [
        { Nombre: "Ana Ruiz", Pauta: "a" },
        { Nombre: "ana ruiz", Pauta: "b" },
      ],
      "Nombre"
    )
    const lowercased = documents.map((item) => item.name.toLocaleLowerCase())
    expect(new Set(lowercased).size).toBe(2)
  })

  it("no repite un nombre que ya venía desambiguado en los datos", () => {
    const documents = buildMailMergeDocuments(
      template,
      [
        { Nombre: "Ana", Pauta: "a" },
        { Nombre: "Ana (2)", Pauta: "b" },
        { Nombre: "Ana", Pauta: "c" },
      ],
      "Nombre"
    )
    expect(new Set(documents.map((item) => item.name)).size).toBe(3)
  })

  it("esquiva los nombres de dispositivo reservados de Windows", () => {
    // «CON.docx» o «AUX.docx» son archivos que Windows se niega a crear, y la
    // combinación entera fallaba al descomprimir el ZIP.
    const documents = buildMailMergeDocuments(
      template,
      [
        { Nombre: "Con", Pauta: "a" },
        { Nombre: "NUL", Pauta: "b" },
        { Nombre: "lpt1", Pauta: "c" },
      ],
      "Nombre"
    )
    for (const document of documents) {
      expect(document.name).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i)
    }
  })

  it("no deja puntos ni espacios al final del nombre", () => {
    // Windows los descarta al crear el archivo, así que «Etc.» y «Etc» acabarían
    // siendo el mismo archivo pese a ser dos entradas distintas del ZIP.
    const documents = buildMailMergeDocuments(
      template,
      [
        { Nombre: "Etc.", Pauta: "a" },
        { Nombre: "Etc", Pauta: "b" },
      ],
      "Nombre"
    )
    expect(documents[0].name).not.toMatch(/[. ]$/)
    expect(documents[0].name).not.toBe(documents[1].name)
  })

  it("quita del nombre los caracteres invisibles", () => {
    const documents = buildMailMergeDocuments(
      template,
      [{ Nombre: "Ana‮Ruiz", Pauta: "x" }],
      "Nombre"
    )
    expect(documents[0].name).toBe("AnaRuiz")
  })

  it("cae al número de fila si la columna falta o viene vacía", () => {
    const sinColumna = buildMailMergeDocuments(template, [{ Pauta: "x" }], "Nombre")
    expect(sinColumna[0].name).toBe("documento-1")

    const vacia = buildMailMergeDocuments(
      template,
      [{ Nombre: "   ", Pauta: "x" }],
      "Nombre"
    )
    expect(vacia[0].name).toBe("documento-1")
  })

  it("avisa de los campos que el CSV no trae", () => {
    const documents = buildMailMergeDocuments(
      template,
      [{ Nombre: "Ana" }],
      "Nombre"
    )
    expect(documents[0].missingFields).toContain("Pauta")
  })
})
