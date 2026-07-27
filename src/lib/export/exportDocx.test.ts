import JSZip from "jszip"
import { XMLValidator } from "fast-xml-parser"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { createDefaultDocumentWorkspaceState } from "../../types/document"
import type { BlockNode } from "./document-ast"
import { createDocumentDocxBlob } from "./exportDocx"

async function readZipText(zip: JSZip, path: string) {
  const entry = zip.file(path)
  expect(entry, `Falta ${path} en el DOCX`).not.toBeNull()
  return entry!.async("string")
}

describe("exportación DOCX v0.6", () => {
  it("genera revisión, notas, secciones y referencias legibles en Word", async () => {
    const state = createDefaultDocumentWorkspaceState()
    state.trackChanges.enabled = true
    state.outlineNumbering.enabled = true
    state.outlineNumbering.maxLevel = 3
    state.pageAppearance = {
      color: "#f4f1e8",
      borderStyle: "double",
      borderColor: "#123456",
      borderWidth: 2,
      watermarkText: "BORRADOR",
      watermarkColor: "#808080",
      watermarkOpacity: 0.16,
      watermarkAngle: -35,
      hyphenation: true,
    }
    state.comments = [
      {
        id: "comment-one",
        author: "Ana",
        initials: "A",
        text: "Revisar esta afirmación",
        createdAt: "2026-07-24T10:00:00.000Z",
        resolved: false,
        replies: [
          {
            id: "reply-one",
            author: "Luis",
            text: "Comprobado",
            createdAt: "2026-07-24T10:05:00.000Z",
          },
        ],
      },
    ]
    state.footnotes = [
      { id: "footnote-one", number: 1, text: "Fuente primaria consultada." },
    ]
    state.endnotes = [
      {
        id: "endnote-one",
        number: 1,
        text: "Discusión metodológica ampliada.",
      },
    ]
    state.sections[0] = {
      ...state.sections[0],
      layout: {
        ...state.sections[0].layout,
        lineNumbers: {
          mode: "newSection",
          start: 3,
          countBy: 5,
          distance: 28,
        },
      },
      header: { default: "Informe v0.3", first: "", even: "" },
      footer: { default: "Confidencial", first: "", even: "" },
      pageNumberPosition: "footer-right",
      pageNumberFormat: "lowerRoman",
      pageNumberStart: 1,
    }
    state.sections.push({
      ...state.sections[0],
      id: "section-two",
      name: "Sección 2",
      breakType: "nextPage",
      layout: {
        ...state.sections[0].layout,
        orientation: "landscape",
        margins: { ...state.sections[0].layout.margins },
      },
      header: { default: "Anexo", first: "", even: "" },
      footer: { default: "", first: "", even: "" },
    })

    const ast: BlockNode[] = [
      {
        type: "paragraph",
        runs: [
          {
            text: "Texto comentado",
            commentIds: ["comment-one"],
          },
          {
            text: " añadido",
            revision: {
              id: "revision-insert",
              type: "insertion",
              author: "Ana",
              date: "2026-07-24T10:10:00.000Z",
            },
          },
          {
            text: " eliminado",
            revision: {
              id: "revision-delete",
              type: "deletion",
              author: "Ana",
              date: "2026-07-24T10:11:00.000Z",
            },
          },
          { text: "", footnoteId: "footnote-one" },
          { text: "", endnoteId: "endnote-one" },
        ],
      },
      {
        type: "paragraph",
        runs: [
          {
            text: "Concepto clave",
            bookmarkId: "bookmark-manual",
            bookmarkName: "Concepto",
          },
          {
            text: " (véase marcador)",
            crossReferenceTarget: "bookmark-manual",
          },
        ],
      },
      {
        type: "sectionBreak",
        sectionId: "section-two",
        breakType: "nextPage",
      },
      {
        type: "heading",
        level: 1,
        styleId: "Heading1",
        anchorId: "heading-anexo",
        runs: [{ text: "Anexo" }],
      },
      {
        type: "paragraph",
        runs: [
          {
            text: "véase 1 Anexo",
            crossReferenceTarget: "heading-anexo",
          },
        ],
      },
      {
        type: "paragraph",
        runs: [
          {
            text: "(García Márquez, 1967)",
            citationSourceId: "source-one",
          },
        ],
      },
      {
        type: "bibliography",
        heading: "Bibliografía",
        style: "apa",
        entries: [
          "García Márquez, Gabriel. (1967). Cien años de soledad. Editorial Sudamericana.",
        ],
      },
      {
        type: "tableOfContents",
        title: "Índice",
        maxLevel: 3,
        entries: [],
      },
      {
        type: "caption",
        id: "figure-one",
        kind: "figure",
        number: 1,
        label: "Figura",
        title: "Arquitectura del sistema",
      },
      {
        type: "equation",
        id: "equation-one",
        latex: "E=mc^2",
        number: 1,
      },
      {
        type: "textBox",
        content: [
          {
            type: "paragraph",
            runs: [{ text: "Idea clave", bold: true }],
          },
        ],
        width: 360,
        minHeight: 96,
        align: "right",
        position: "float-right",
        background: "#eff6ff",
        borderColor: "#2563eb",
        borderStyle: "solid",
        padding: 16,
      },
      {
        type: "table",
        repeatHeader: true,
        allowRowBreak: false,
        tableStyle: "academic",
        rows: [
          {
            cells: [
              {
                header: true,
                colSpan: 2,
                formula: "SUM(ABOVE)",
                content: [{ type: "paragraph", runs: [{ text: "Cabecera" }] }],
              },
            ],
          },
        ],
      },
    ]

    const blob = await createDocumentDocxBlob(ast, state)
    if (process.env.WRITE_TEST_DOCX_VARIANTS_DIR) {
      await mkdir(process.env.WRITE_TEST_DOCX_VARIANTS_DIR, {
        recursive: true,
      })
      const academicBlocks = ast.slice(-5)
      for (let index = 0; index <= academicBlocks.length; index += 1) {
        const variant = await createDocumentDocxBlob(
          [
            {
              type: "heading",
              level: 1,
              runs: [{ text: "Verificación" }],
            },
            ...academicBlocks.slice(0, index),
          ],
          createDefaultDocumentWorkspaceState()
        )
        await writeFile(
          join(
            process.env.WRITE_TEST_DOCX_VARIANTS_DIR,
            `variant-${index}.docx`
          ),
          Buffer.from(await variant.arrayBuffer())
        )
        const complexVariant = await createDocumentDocxBlob(
          ast.slice(0, ast.length - 5 + index),
          state
        )
        await writeFile(
          join(
            process.env.WRITE_TEST_DOCX_VARIANTS_DIR,
            `complex-${index}.docx`
          ),
          Buffer.from(await complexVariant.arrayBuffer())
        )
      }
    }
    if (process.env.WRITE_TEST_DOCX) {
      await writeFile(
        process.env.WRITE_TEST_DOCX,
        Buffer.from(await blob.arrayBuffer())
      )
    }
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const documentXml = await readZipText(zip, "word/document.xml")
    const commentsXml = await readZipText(zip, "word/comments.xml")
    const footnotesXml = await readZipText(zip, "word/footnotes.xml")
    const endnotesXml = await readZipText(zip, "word/endnotes.xml")
    const numberingXml = await readZipText(zip, "word/numbering.xml")
    const stylesXml = await readZipText(zip, "word/styles.xml")
    const settingsXml = await readZipText(zip, "word/settings.xml")
    const headerXml = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((path) => /^word\/header\d+\.xml$/.test(path))
          .map((path) => readZipText(zip, path))
      )
    ).join("\n")

    expect(documentXml).toContain('w:background w:color="f4f1e8"')
    expect(documentXml).toContain("<w:pgBorders")
    expect(documentXml).toContain('w:val="double"')
    expect(documentXml).toContain('w:color="123456"')
    expect(settingsXml).toContain("<w:autoHyphenation")
    expect(headerXml).toContain("EditorInteligenteIAWatermark")
    expect(headerXml).toContain('string="BORRADOR"')
    expect(headerXml).toContain("rotation:-35")
    expect(headerXml).not.toContain("<undefined>")
    expect(documentXml).toContain("<w:commentRangeStart")
    expect(documentXml).toContain("<w:commentReference")
    expect(documentXml).toContain("<w:footnoteReference")
    expect(documentXml).toContain("<w:endnoteReference")
    expect(documentXml).toContain("<w:ins")
    expect(documentXml).toContain("<w:del")
    expect(documentXml.match(/<w:sectPr/g)?.length).toBeGreaterThanOrEqual(2)
    expect(documentXml).toContain("García Márquez")
    expect(documentXml).toContain("Bibliografía")
    expect(documentXml).toContain("Cien años de soledad")
    expect(documentXml).toContain("TOC")
    expect(documentXml).toContain("Arquitectura del sistema")
    expect(documentXml).toContain("<m:oMath>")
    expect(documentXml).toContain("<m:sSup>")
    expect(documentXml).toContain("<v:textbox")
    expect(documentXml).toContain("Idea clave")
    expect(documentXml).toContain("mso-position-horizontal:right")
    expect(documentXml).toContain('fillcolor="#eff6ff"')
    expect(documentXml).toContain(
      'alt="ETITextBox|#eff6ff|#2563eb|solid|16"'
    )
    expect(documentXml).toContain("<w:tblHeader")
    expect(documentXml).toContain("<w:cantSplit")
    expect(documentXml).toContain("<w:gridSpan")
    expect(documentXml).toContain('w:instr="=SUM(ABOVE)"')
    expect(documentXml).toContain('w:val="nil"')
    expect(documentXml).toContain('w:fmt="lowerRoman"')
    expect(documentXml).toContain("<w:lnNumType")
    expect(documentXml).toContain('w:countBy="5"')
    expect(documentXml).toContain('w:start="3"')
    expect(documentXml).toContain('w:restart="newSection"')
    expect(documentXml).toContain("<w:numPr")
    expect(documentXml).toContain("<w:bookmarkStart")
    const bookmarkIds = [
      ...documentXml.matchAll(
        /<w:bookmarkStart\b[^>]*\bw:id="(\d+)"/g
      ),
    ].map((match) => match[1])
    expect(bookmarkIds.length).toBeGreaterThanOrEqual(3)
    expect(new Set(bookmarkIds).size).toBe(bookmarkIds.length)
    expect(documentXml).toContain("REF eti_heading_anexo_")
    expect(documentXml).toContain("REF eti_bookmark_manual_")
    expect(documentXml).toContain("\\h \\w")
    expect(documentXml).toContain("SEQ ETI_figure")
    expect(documentXml).toContain("SEQ ETI_equation")
    expect(documentXml).toContain("eti_heading_anexo_")
    expect(numberingXml).toContain('w:val="%1.%2.%3"')
    expect(stylesXml).toContain('w:val="es-ES"')
    expect(commentsXml).toContain("Revisar esta afirmación")
    expect(footnotesXml).toContain("Fuente primaria consultada.")
    expect(endnotesXml).toContain("Discusión metodológica ampliada.")
    expect(zip.file(/^word\/header\d+\.xml$/).length).toBeGreaterThan(0)
    expect(zip.file(/^word\/footer\d+\.xml$/).length).toBeGreaterThan(0)
  })

  it("convierte LaTeX académico en ecuaciones OMML editables", async () => {
    const blob = await createDocumentDocxBlob([
      {
        type: "equation",
        id: "equation-advanced",
        latex:
          String.raw`\frac{x^2}{\sqrt{y}}+\sum_{i=1}^{n}x_i+\int_0^1 t\,dt`,
        number: 1,
      },
    ])
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const documentXml = await readZipText(zip, "word/document.xml")

    expect(documentXml).toContain("<m:oMath>")
    expect(documentXml).toContain("<m:f>")
    expect(documentXml).toContain("<m:rad>")
    expect(documentXml).toContain("<m:sSup>")
    expect(documentXml).toContain("<m:sSub>")
    expect(documentXml.match(/<m:nary>/g)?.length).toBeGreaterThanOrEqual(2)
    expect(documentXml).toContain("SEQ ETI_equation")
    expect(documentXml).not.toContain(String.raw`\frac`)
  })

  it("exporta el idioma por fragmento y el ajuste cuadrado de imágenes", async () => {
    const blob = await createDocumentDocxBlob(
      [
        {
          type: "paragraph",
          runs: [
            {
              text: "Abstract",
              language: "en-GB",
            },
          ],
        },
        {
          type: "image",
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          width: 180,
          height: 180,
          alt: "Gráfico de resultados",
          align: "right",
          wrap: "tight-right",
          spacing: 18,
        },
      ],
      createDefaultDocumentWorkspaceState()
    )
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const documentXml = await readZipText(zip, "word/document.xml")

    expect(documentXml).toContain('w:lang w:val="en-GB"')
    expect(documentXml).toContain("<wp:anchor")
    expect(documentXml).toContain("<wp:wrapTight")
    expect(documentXml).toContain('relativeFrom="column"')
    expect(documentXml).toContain("Gráfico de resultados")
  })

  it("exporta formato directo y reglas de paginación de párrafo", async () => {
    const blob = await createDocumentDocxBlob(
      [
        {
          type: "paragraph",
          paragraphFormat: {
            leftIndent: 36,
            rightIndent: 18,
            firstLineIndent: -18,
            tabStops: [72],
            spacingBefore: 6,
            spacingAfter: 12,
            lineSpacingRule: "exactly",
            lineSpacing: 24,
            contextualSpacing: true,
            outlineLevel: 2,
            keepWithNext: true,
            keepLinesTogether: true,
            widowOrphanControl: false,
            pageBreakBefore: true,
            suppressLineNumbers: true,
          },
          runs: [{ text: "Párrafo académico" }],
        },
      ],
      createDefaultDocumentWorkspaceState()
    )
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const documentXml = await readZipText(zip, "word/document.xml")

    expect(documentXml).toContain('w:left="720"')
    expect(documentXml).toContain('w:right="360"')
    expect(documentXml).toContain('w:hanging="360"')
    expect(documentXml).toContain('w:pos="1440"')
    expect(documentXml).toContain('w:before="120"')
    expect(documentXml).toContain('w:after="240"')
    expect(documentXml).toContain("<w:keepNext")
    expect(documentXml).toContain("<w:keepLines")
    expect(documentXml).toContain("<w:widowControl")
    expect(documentXml).toContain("<w:pageBreakBefore")
    expect(documentXml).toContain("<w:suppressLineNumbers")
  })

  it("exporta la familia tipográfica y el super/subíndice de cada fragmento", async () => {
    const blob = await createDocumentDocxBlob(
      [
        {
          type: "paragraph",
          runs: [
            { text: "Agua: H" },
            { text: "2", fontFamily: "Roboto, Arial, sans-serif", subscript: true },
            { text: "O y x" },
            { text: "2", superscript: true },
          ],
        },
      ],
      createDefaultDocumentWorkspaceState()
    )
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const documentXml = await readZipText(zip, "word/document.xml")

    expect(documentXml).toContain('w:ascii="Roboto, Arial, sans-serif"')
    expect(documentXml).toContain('w:val="subscript"')
    expect(documentXml).toContain('w:val="superscript"')
  })
})

describe("campos de formulario en el DOCX", () => {
  const formBlocks: BlockNode[] = [
    {
      type: "paragraph",
      runs: [
        { text: "¿Fuma? " },
        { text: "☒", formField: { kind: "checkbox", checked: true, label: "Fumador" } },
        { text: " Cantidad: " },
        {
          text: "15 cigarrillos/día",
          underline: true,
          formField: { kind: "text", value: "15 cigarrillos/día", placeholder: "Cantidad" },
        },
        { text: " Alergias: " },
        {
          text: "__________",
          formField: { kind: "text", value: "", placeholder: "Alergias" },
        },
        { text: " Adherencia: " },
        {
          text: "Buena",
          underline: true,
          formField: { kind: "dropdown", value: "Buena", options: ["Buena", "Regular", "Baja"] },
        },
      ],
    },
  ]

  async function exportForm() {
    const state = createDefaultDocumentWorkspaceState()
    const blob = await createDocumentDocxBlob(formBlocks, state)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    return { zip, documentXml: await readZipText(zip, "word/document.xml") }
  }

  it("escribe controles de contenido, no texto plano", async () => {
    const { documentXml } = await exportForm()
    // Cuatro campos: casilla, dos huecos de texto y un desplegable.
    expect((documentXml.match(/<w:sdt>/g) ?? []).length).toBe(4)
  })

  it("la casilla marcada usa el control moderno de Word", async () => {
    const { documentXml } = await exportForm()
    expect(documentXml).toContain("w14:checkbox")
    expect(documentXml).toMatch(/<w14:checked w14:val="1"\/>/)
  })

  it("el hueco relleno conserva lo respondido y el vacío muestra su etiqueta", async () => {
    const { documentXml } = await exportForm()
    expect(documentXml).toContain("<w:text/>")
    expect(documentXml).toContain("15 cigarrillos/día")
    // Sin responder, Word debe tratarlo como marcador de posición.
    expect(documentXml).toContain("<w:showingPlcHdr/>")
    expect(documentXml).toContain("Alergias")
  })

  it("el desplegable lleva todas sus opciones y la elegida", async () => {
    const { documentXml } = await exportForm()
    expect(documentXml).toContain("dropDownList")
    expect((documentXml.match(/<w:listItem/g) ?? []).length).toBe(3)
    expect(documentXml).toContain('w:lastValue="Buena"')
  })

  it("no deja ninguna marca interna dentro del archivo", async () => {
    const { documentXml } = await exportForm()
    expect(documentXml).not.toContain("__ETI_FORM_")
  })

  it("no deja un w:sdt dentro de un w:r, que invalidaría el documento", async () => {
    const { documentXml } = await exportForm()
    expect(documentXml).not.toMatch(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:sdt>/)
  })

  it("produce XML bien formado pese a insertarse por sustitución de texto", async () => {
    const { documentXml } = await exportForm()
    const validation = XMLValidator.validate(documentXml)
    expect(validation, JSON.stringify(validation)).toBe(true)
  })

  it("declara el espacio de nombres que necesita la casilla", async () => {
    // Sin `xmlns:w14` el documento usa `w14:checkbox` sin declararlo y Word lo
    // rechaza al abrirlo. Es un fallo silencioso: los tests de contenido
    // seguirían pasando.
    const { documentXml } = await exportForm()
    const root = documentXml.match(/<w:document [^>]*>/)?.[0] ?? ""
    expect(root).toContain("xmlns:w14=")
  })

  it("sigue siendo un DOCX completo", async () => {
    const { zip } = await exportForm()
    for (const entry of [
      "[Content_Types].xml",
      "word/document.xml",
      "word/styles.xml",
    ]) {
      expect(zip.file(entry), `Falta ${entry}`).not.toBeNull()
    }
  })

  it("escapa lo que el usuario escriba en un campo", async () => {
    const state = createDefaultDocumentWorkspaceState()
    const blob = await createDocumentDocxBlob(
      [
        {
          type: "paragraph",
          runs: [
            {
              text: 'a & b <c> "d"',
              formField: { kind: "text", value: 'a & b <c> "d"', placeholder: "" },
            },
          ],
        },
      ],
      state
    )
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const documentXml = await readZipText(zip, "word/document.xml")
    expect(documentXml).toContain("a &amp; b &lt;c&gt;")
    expect(documentXml).not.toContain("<c>")
  })
})
