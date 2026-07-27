import { describe, expect, it } from "vitest"

import { buildDocumentAst } from "./document-ast"

describe("buildDocumentAst", () => {
  it("preserva estilos académicos y de fuente para DOCX/PDF", () => {
    const ast = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, textAlign: "center", lineHeight: "1.5" },
          content: [
            {
              type: "text",
              text: "Marco teórico",
              marks: [
                { type: "bold" },
                {
                  type: "textStyle",
                  attrs: { fontFamily: "Times New Roman", fontSize: "14pt", color: "#112233" },
                },
                {
                  type: "proofingLanguage",
                  attrs: { language: "en-GB" },
                },
                {
                  type: "bookmark",
                  attrs: {
                    bookmarkId: "bookmark-theory",
                    name: "Teoría",
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    expect(ast).toEqual([
      {
        type: "heading",
        level: 2,
        align: "center",
        lineHeight: "1.5",
        runs: [
          {
            text: "Marco teórico",
            bold: true,
            fontFamily: "Times New Roman",
            fontSize: "14pt",
            color: "#112233",
            language: "en-GB",
            bookmarkId: "bookmark-theory",
            bookmarkName: "Teoría",
          },
        ],
      },
    ])
  })

  it("convierte tablas, imágenes y listas sin perder el orden", () => {
    const ast = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Primero" }] }],
            },
          ],
        },
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,AA==",
            width: 320,
            height: 200,
            alt: "Diagrama",
            align: "right",
            wrap: "tight-right",
            spacing: 18,
          },
        },
      ],
    })

    expect(ast[0]?.type).toBe("bulletList")
    expect(ast[1]).toMatchObject({
      type: "image",
      width: 320,
      height: 200,
      alt: "Diagrama",
      align: "right",
      wrap: "tight-right",
      spacing: 18,
    })
  })

  it("preserva citas vinculadas y la bibliografía dinámica", () => {
    const ast = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Como demostró " },
            {
              type: "citation",
              attrs: {
                sourceId: "source-one",
                style: "apa",
                label: "(García Márquez, 1967)",
              },
            },
          ],
        },
        {
          type: "bibliography",
          attrs: {
            heading: "Bibliografía",
            style: "apa",
            entries: [
              "García Márquez, Gabriel. (1967). Cien años de soledad.",
            ],
          },
        },
      ],
    })

    expect(ast[0]).toMatchObject({
      type: "paragraph",
      runs: [
        { text: "Como demostró " },
        {
          text: "(García Márquez, 1967)",
          citationSourceId: "source-one",
        },
      ],
    })
    expect(ast[1]).toEqual({
      type: "bibliography",
      heading: "Bibliografía",
      style: "apa",
      entries: [
        "García Márquez, Gabriel. (1967). Cien años de soledad.",
      ],
    })
  })

  it("distingue referencias de nota al pie y nota final", () => {
    const ast = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Argumento" },
            {
              type: "footnoteReference",
              attrs: { footnoteId: "footnote-one", number: 1 },
            },
            {
              type: "endnoteReference",
              attrs: { endnoteId: "endnote-one", number: 1 },
            },
          ],
        },
      ],
    })

    expect(ast[0]).toMatchObject({
      type: "paragraph",
      runs: [
        { text: "Argumento" },
        { text: "", footnoteId: "footnote-one" },
        { text: "", endnoteId: "endnote-one" },
      ],
    })
  })

  it("preserva el formato directo y la paginación de párrafo", () => {
    const ast = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: {
            paragraphFormat: {
              leftIndent: 36,
              rightIndent: 18,
              firstLineIndent: -18,
              spacingBefore: 6,
              spacingAfter: 12,
              keepWithNext: true,
              keepLinesTogether: true,
              widowOrphanControl: false,
              pageBreakBefore: true,
              suppressLineNumbers: true,
            },
          },
          content: [{ type: "text", text: "Párrafo académico" }],
        },
      ],
    })

    expect(ast[0]).toMatchObject({
      type: "paragraph",
      paragraphFormat: {
        leftIndent: 36,
        rightIndent: 18,
        firstLineIndent: -18,
        spacingBefore: 6,
        spacingAfter: 12,
        keepWithNext: true,
        keepLinesTogether: true,
        widowOrphanControl: false,
        pageBreakBefore: true,
        suppressLineNumbers: true,
      },
    })
  })

  it("conserva campos académicos, cuadros, ecuaciones y tablas", () => {
    const ast = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, outlineNumber: "2", anchorId: "marco" },
          content: [{ type: "text", text: "Marco" }],
        },
        {
          type: "tableOfContents",
          attrs: {
            title: "Índice",
            maxLevel: 3,
            entries: [
              { id: "marco", level: 1, number: "2", text: "Marco" },
            ],
          },
        },
        {
          type: "caption",
          attrs: {
            captionId: "figure-one",
            kind: "figure",
            number: 1,
            label: "Figura",
            title: "Arquitectura",
          },
        },
        {
          type: "equation",
          attrs: {
            equationId: "equation-one",
            latex: "E=mc^2",
            number: 1,
          },
        },
        {
          type: "textBox",
          attrs: {
            width: 480,
            minHeight: 120,
            align: "right",
            boxPosition: "float-right",
            background: "#eff6ff",
            borderColor: "#2563eb",
            borderStyle: "double",
            padding: 20,
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Idea clave" }],
            },
          ],
        },
        {
          type: "table",
          attrs: {
            repeatHeader: true,
            allowRowBreak: false,
            tableStyle: "banded",
          },
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  attrs: {
                    colspan: 2,
                    rowspan: 1,
                    formula: "SUM(ABOVE)",
                  },
                  content: [{ type: "paragraph" }],
                },
              ],
            },
          ],
        },
      ],
    })

    expect(ast[0]).toMatchObject({
      type: "heading",
      outlineNumber: "2",
    })
    expect(ast[1]).toMatchObject({
      type: "tableOfContents",
      entries: [{ id: "marco", number: "2" }],
    })
    expect(ast[2]).toMatchObject({
      type: "caption",
      label: "Figura",
      number: 1,
    })
    expect(ast[3]).toEqual({
      type: "equation",
      id: "equation-one",
      latex: "E=mc^2",
      number: 1,
    })
    expect(ast[4]).toEqual({
      type: "textBox",
      content: [
        { type: "paragraph", runs: [{ text: "Idea clave" }] },
      ],
      width: 480,
      minHeight: 120,
      align: "right",
      position: "float-right",
      background: "#eff6ff",
      borderColor: "#2563eb",
      borderStyle: "double",
      padding: 20,
    })
    expect(ast[5]).toMatchObject({
      type: "table",
      repeatHeader: true,
      allowRowBreak: false,
      tableStyle: "banded",
      rows: [
        {
          cells: [
            {
              colSpan: 2,
              rowSpan: 1,
              formula: "SUM(ABOVE)",
            },
          ],
        },
      ],
    })
  })
})

describe("campos de formulario en la exportación", () => {
  const formDocument = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "¿Fuma? " },
          {
            type: "formCheckbox",
            attrs: { fieldId: "f1", checked: true, label: "Fumador" },
          },
          { type: "text", text: " Cantidad: " },
          {
            type: "formTextField",
            attrs: {
              fieldId: "f2",
              value: "15 cigarrillos/día",
              placeholder: "",
              width: 18,
            },
          },
          { type: "text", text: " Adherencia: " },
          {
            type: "formDropdown",
            attrs: { fieldId: "f3", value: "Buena", options: ["Buena", "Baja"] },
          },
        ],
      },
    ],
  }

  it("imprime la casilla marcada y la vacía con símbolos distintos", () => {
    const [block] = buildDocumentAst(formDocument)
    const marked = block.type === "paragraph" ? block.runs[1].text : ""
    expect(marked).toBe("☒")

    const unchecked = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "formCheckbox", attrs: { fieldId: "f", checked: false } },
          ],
        },
      ],
    })[0]
    expect(unchecked.type === "paragraph" && unchecked.runs[0].text).toBe("☐")
  })

  it("exporta lo escrito en un hueco de texto, subrayado", () => {
    const [block] = buildDocumentAst(formDocument)
    if (block.type !== "paragraph") throw new Error("bloque inesperado")
    expect(block.runs[3]).toMatchObject({
      text: "15 cigarrillos/día",
      underline: true,
    })
  })

  it("un hueco vacío deja una línea sobre la que escribir a mano", () => {
    const [block] = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "formTextField",
              attrs: { fieldId: "f", value: "", width: 10 },
            },
          ],
        },
      ],
    })
    if (block.type !== "paragraph") throw new Error("bloque inesperado")
    expect(block.runs[0].text).toBe("_".repeat(10))
  })

  it("exporta la opción elegida del desplegable", () => {
    const [block] = buildDocumentAst(formDocument)
    if (block.type !== "paragraph") throw new Error("bloque inesperado")
    expect(block.runs[5]).toMatchObject({ text: "Buena", underline: true })
  })

  it("un desplegable sin elegir enseña las opciones disponibles", () => {
    const [block] = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "formDropdown",
              attrs: { fieldId: "f", value: "", options: ["Sí", "No"] },
            },
          ],
        },
      ],
    })
    if (block.type !== "paragraph") throw new Error("bloque inesperado")
    expect(block.runs[0].text).toBe("(Sí / No)")
  })
})

describe("gráficos en la exportación", () => {
  it("viaja como imagen, que es lo que DOCX, PDF y ODT ya saben colocar", () => {
    const [block] = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "documentChart",
          attrs: {
            chartId: "chart-1",
            kind: "bar",
            title: "Evolución del peso",
            seriesName: "Peso",
            labels: ["Enero", "Febrero"],
            values: [82.4, 81.1],
            image: "data:image/png;base64,AAAA",
          },
        },
      ],
    })

    expect(block).toMatchObject({
      type: "image",
      src: "data:image/png;base64,AAAA",
      alt: "Evolución del peso",
      align: "center",
    })
  })

  it("usa el nombre de la serie como texto alternativo si no hay título", () => {
    const [block] = buildDocumentAst({
      type: "doc",
      content: [
        {
          type: "documentChart",
          attrs: {
            chartId: "c",
            kind: "line",
            title: "",
            seriesName: "Glucosa",
            labels: ["a"],
            values: [1],
            image: "data:image/png;base64,AAAA",
          },
        },
      ],
    })
    expect(block.type === "image" && block.alt).toBe("Glucosa")
  })
})
