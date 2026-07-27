import { describe, expect, it } from "vitest"

import {
  buildEditorAssistantContext,
  editorActionLabel,
  parseEditorAssistantResponse,
} from "@/lib/editor-assistant"
import { createDefaultDocumentWorkspaceState } from "@/types/document"

describe("protocolo de acciones del editor para Gemini", () => {
  it("extrae acciones válidas y oculta el bloque de control", () => {
    const parsed = parseEditorAssistantResponse(`Preparado.
<editor_actions>
[
  {"type":"insertTable","rows":4,"columns":3,"headerRow":true},
  {"type":"setLayout","orientation":"landscape","columns":2}
]
</editor_actions>`)

    expect(parsed.content).toBe("Preparado.")
    expect(parsed.actions).toEqual([
      { type: "insertTable", rows: 4, columns: 3, headerRow: true },
      { type: "setLayout", orientation: "landscape", columns: 2 },
    ])
  })

  it("descarta acciones desconocidas y acota parámetros peligrosos", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"deleteDocument"},
  {"type":"insertTable","rows":900,"columns":900},
  {"type":"insertSectionBreak","breakType":"inventado"}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      { type: "insertTable", rows: 30, columns: 12, headerRow: true },
    ])
  })

  it("valida formato avanzado, citas y opciones de diseño", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"formatSelection","fontSize":200,"fontFamily":"Aptos","textColor":"#2f5496","listType":"bullet","clearFormatting":true},
  {"type":"insertCitation","sourceIds":["source-1","source-2"],"mode":"narrative"},
  {"type":"insertCrossReference","targetId":"heading-introduction"},
  {"type":"setLayout","margin":200,"columnGap":4,"showRuler":false,"showFormattingMarks":true}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "formatSelection",
        fontFamily: "Aptos",
        fontSize: 96,
        textColor: "#2f5496",
        listType: "bullet",
        clearFormatting: true,
      },
      {
        type: "insertCitation",
        sourceIds: ["source-1", "source-2"],
        mode: "narrative",
      },
      {
        type: "insertCrossReference",
        targetId: "heading-introduction",
      },
      {
        type: "setLayout",
        margin: 144,
        columnGap: 12,
        showRuler: false,
        showFormattingMarks: true,
      },
    ])
  })

  it("valida acciones de imagen, tabla y numeración académica", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"formatSelectedImage","width":5000,"align":"right","alt":"Esquema conceptual","wrap":"tight-right","spacing":80,"crop":{"top":-10,"right":60,"bottom":5,"left":8},"brightness":4,"contrast":0,"saturation":1.4,"grayscale":2,"maxDimension":9000,"imageFormat":"jpeg"},
  {"type":"editTable","operation":"addColumn"},
  {"type":"editTable","operation":"sortDescending"},
  {"type":"editTable","operation":"applyFormula","formulaOperation":"AVERAGE","formulaDirection":"LEFT"},
  {"type":"editTable","operation":"applyFormula","formulaOperation":"INVENTED","formulaDirection":"BELOW"},
  {"type":"editTable","operation":"setStyle","tableStyle":"academic"},
  {"type":"editTable","operation":"setStyle","tableStyle":"invented"},
  {"type":"setPageNumbering","format":"lowerRoman","position":"footer-center","start":0},
  {"type":"createThesisStructure"},
  {"type":"setProofingLanguage","language":"en-GB","scope":"selection"},
  {"type":"configureWritingAssistant","profile":"academic","disabledRules":["long-sentence","invented"]}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "formatSelectedImage",
        width: 1200,
        align: "right",
        alt: "Esquema conceptual",
        wrap: "tight-right",
        spacing: 48,
        crop: { top: 0, right: 45, bottom: 5, left: 8 },
        brightness: 2,
        contrast: 0.25,
        saturation: 1.4,
        grayscale: 1,
        maxDimension: 4096,
        imageFormat: "jpeg",
      },
      { type: "editTable", operation: "addColumn" },
      { type: "editTable", operation: "sortDescending" },
      {
        type: "editTable",
        operation: "applyFormula",
        formulaOperation: "AVERAGE",
        formulaDirection: "LEFT",
      },
      {
        type: "editTable",
        operation: "applyFormula",
        formulaOperation: "SUM",
        formulaDirection: "ABOVE",
      },
      {
        type: "editTable",
        operation: "setStyle",
        tableStyle: "academic",
      },
      {
        type: "setPageNumbering",
        format: "lowerRoman",
        position: "footer-center",
        start: 1,
      },
      { type: "createThesisStructure" },
      {
        type: "setProofingLanguage",
        language: "en-GB",
        scope: "selection",
      },
      {
        type: "configureWritingAssistant",
        profile: "academic",
        disabledRules: ["long-sentence"],
      },
    ])
  })

  it("valida la apariencia de página y permite retirar una marca de agua", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"setPageAppearance","color":"#F4F1E8","borderStyle":"double","borderColor":"#123456","borderWidth":50,"watermarkText":" BORRADOR ","watermarkColor":"#808080","watermarkOpacity":2,"watermarkAngle":-500,"hyphenation":true},
  {"type":"setPageAppearance","watermarkText":""}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "setPageAppearance",
        color: "#f4f1e8",
        borderStyle: "double",
        borderColor: "#123456",
        borderWidth: 8,
        watermarkText: "BORRADOR",
        watermarkColor: "#808080",
        watermarkOpacity: 0.8,
        watermarkAngle: -180,
        hyphenation: true,
      },
      { type: "setPageAppearance", watermarkText: "" },
    ])
  })

  it("prepara campos y abre el flujo local de correspondencia", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"insertMailMergeField","field":"Nombre del estudiante"},
  {"type":"openPanel","panel":"mailMerge"}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "insertMailMergeField",
        field: "Nombre del estudiante",
      },
      { type: "openPanel", panel: "mailMerge" },
    ])
  })

  it("configura la autocorrección local y abre sus controles", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"configureAutocorrect","enabled":true,"capitalizeSentences":false,"smartQuotes":true,"smartDashes":false,"replacement":{"from":"  pq  ","to":"porque","caseSensitive":false}},
  {"type":"configureAutocorrect","removeReplacement":"(tm)"},
  {"type":"openPanel","panel":"writing"}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "configureAutocorrect",
        enabled: true,
        capitalizeSentences: false,
        smartQuotes: true,
        smartDashes: false,
        replacement: {
          from: "pq",
          to: "porque",
          caseSensitive: false,
        },
      },
      {
        type: "configureAutocorrect",
        removeReplacement: "(tm)",
      },
      { type: "openPanel", panel: "writing" },
    ])
  })

  it("inserta solo caracteres admitidos por la galería local", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"insertSymbol","symbol":"Ω"},
  {"type":"insertSymbol","symbol":"texto arbitrario"}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      { type: "insertSymbol", symbol: "Ω" },
    ])
  })

  it("crea y formatea cuadros de texto con parámetros acotados", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"insertTextBox","text":"Conclusión clave","preset":"highlight","width":5000,"position":"float-right","background":"#FFF7ED"},
  {"type":"formatTextBox","preset":"quote","minHeight":20,"padding":100,"borderStyle":"double"},
  {"type":"formatTextBox","preset":"inventado"}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "insertTextBox",
        text: "Conclusión clave",
        preset: "highlight",
        width: 720,
        position: "float-right",
        background: "#fff7ed",
      },
      {
        type: "formatTextBox",
        preset: "quote",
        minHeight: 48,
        borderStyle: "double",
        padding: 48,
      },
    ])
  })

  it("crea y elimina marcadores mediante acciones revisables", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"addBookmark","name":" Concepto central "},
  {"type":"removeBookmark","bookmarkId":"bookmark-concepto"}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      { type: "addBookmark", name: "Concepto central" },
      { type: "removeBookmark", bookmarkId: "bookmark-concepto" },
    ])
  })

  it("permite insertar notas finales nativas", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"insertEndnote","text":"Debate historiográfico ampliado."}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "insertEndnote",
        text: "Debate historiográfico ampliado.",
      },
    ])
  })

  it("permite que Gemini abra la comprobación local de accesibilidad", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"openPanel","panel":"accessibility"},
  {"type":"openPanel","panel":"reader"},
  {"type":"openPanel","panel":"cloudCollaboration"}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      { type: "openPanel", panel: "accessibility" },
      { type: "openPanel", panel: "reader" },
    ])
  })

  it("valida numeración de líneas académica por sección", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"setLineNumbering","mode":"newSection","start":0,"countBy":500,"distance":-5}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "setLineNumbering",
        mode: "newSection",
        start: 1,
        countBy: 100,
        distance: 0,
      },
    ])
  })

  it("valida sangrías y reglas de paginación de párrafo", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"formatParagraph","leftIndent":900,"rightIndent":18,"firstLineIndent":-500,"spacingBefore":6,"spacingAfter":12,"keepWithNext":true,"keepLinesTogether":true,"widowOrphanControl":false,"pageBreakBefore":true,"suppressLineNumbers":true}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "formatParagraph",
        leftIndent: 720,
        rightIndent: 18,
        firstLineIndent: -360,
        spacingBefore: 6,
        spacingAfter: 12,
        keepWithNext: true,
        keepLinesTogether: true,
        widowOrphanControl: false,
        pageBreakBefore: true,
        suppressLineNumbers: true,
      },
    ])
  })

  it("permite gestionar comentarios y encabezados con acciones revisables", () => {
    const parsed = parseEditorAssistantResponse(`<editor_actions>
[
  {"type":"replyToComment","commentId":"comment-1","text":"Cambio incorporado; revisa la cifra final."},
  {"type":"resolveComment","commentId":"comment-1","resolved":true},
  {"type":"setHeaderFooter","target":"header","variant":"default","content":"Informe trimestral"},
  {"type":"setHeaderFooter","target":"footer","variant":"first","content":""}
]
</editor_actions>`)

    expect(parsed.actions).toEqual([
      {
        type: "replyToComment",
        commentId: "comment-1",
        text: "Cambio incorporado; revisa la cifra final.",
      },
      {
        type: "resolveComment",
        commentId: "comment-1",
        resolved: true,
      },
      {
        type: "setHeaderFooter",
        target: "header",
        variant: "default",
        content: "Informe trimestral",
      },
      {
        type: "setHeaderFooter",
        target: "footer",
        variant: "first",
        content: "",
      },
    ])
  })

  it("describe a Gemini la estructura y las capacidades reales del documento", () => {
    const workspace = createDefaultDocumentWorkspaceState()
    workspace.bibliography.sources.push({
      id: "source-kant",
      author: "Immanuel Kant",
      title: "Crítica de la razón pura",
      year: "1781",
      publisher: "",
      url: "",
    })
    workspace.comments.push({
      id: "comment-1",
      author: "María",
      initials: "M",
      text: "Verifica esta cifra antes de publicar.",
      createdAt: "2026-07-25T08:00:00.000Z",
      resolved: false,
      replies: [
        {
          id: "reply-1",
          author: "Luis",
          text: "La fuente está en el anexo.",
          createdAt: "2026-07-25T08:05:00.000Z",
        },
      ],
      anchorText: "42 %",
    })
    const context = buildEditorAssistantContext(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, anchorId: "heading-introduction" },
            content: [
              {
                type: "text",
                text: "Introducción",
                marks: [
                  {
                    type: "bookmark",
                    attrs: {
                      bookmarkId: "bookmark-intro",
                      name: "Inicio",
                    },
                  },
                ],
              },
            ],
          },
          {
            type: "table",
            attrs: { tableStyle: "academic" },
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    attrs: { formula: "SUM(ABOVE)" },
                  },
                ],
              },
            ],
          },
          {
            type: "textBox",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Idea central" }],
              },
            ],
          },
          { type: "citation" },
        ],
      },
      workspace,
      true
    )

    expect(context).toContain("Selección activa: sí")
    expect(context).toContain("títulos=1")
    expect(context).toContain("tablas=1")
    expect(context).toContain("cuadros de texto=1")
    expect(context).toContain("estilos=academic=1")
    expect(context).toContain("celdas con fórmula=1")
    expect(context).toContain("Objeto activo: text")
    expect(context).toContain("1:Introducción")
    expect(context).toContain("insertTableOfContents")
    expect(context).toContain("heading-introduction|título nivel 1|Introducción")
    expect(context).toContain(
      "source-kant|Immanuel Kant|1781|Crítica de la razón pura"
    )
    expect(context).toContain("insertCrossReference")
    expect(context).toContain("addBookmark")
    expect(context).toContain("bookmark-intro|marcador|Inicio")
    expect(context).toContain("insertCitation")
    expect(context).toContain("formatSelectedImage")
    expect(context).toContain("createThesisStructure")
    expect(context).toContain("configureWritingAssistant")
    expect(context).toContain("configureAutocorrect")
    expect(context).toContain("Autocorrección=activa")
    expect(context).toContain("Tesauro local completo de LibreOffice")
    expect(context).toContain("insertEndnote")
    expect(context).toContain("setLineNumbering")
    expect(context).toContain("setPageAppearance")
    expect(context).toContain("insertMailMergeField")
    expect(context).toContain("insertSymbol")
    expect(context).toContain("insertTextBox")
    expect(context).toContain("formatTextBox")
    expect(context).toContain("mailMerge")
    expect(context).toContain("writing")
    expect(context).toContain("formatParagraph")
    expect(context).toContain("replyToComment")
    expect(context).toContain("setHeaderFooter")
    expect(context).toContain("ACCESIBILIDAD LOCAL")
    expect(context).toContain("openPanel: panel references")
    expect(context).toContain("accessibility")
    expect(context).toContain("comment-1|abierto")
    expect(context).toContain("Verifica esta cifra")
    expect(context).toContain("ESTILOS DISPONIBLES")
  })
})

describe("acción de tema de estilos", () => {
  const parse = (json: string) =>
    parseEditorAssistantResponse(
      `Listo.\n<editor_actions>\n${json}\n</editor_actions>`
    ).actions

  it("acepta los temas reales del editor", () => {
    expect(parse('[{"type":"applyStyleTheme","theme":"editorial"}]')).toEqual([
      { type: "applyStyleTheme", theme: "editorial" },
    ])
  })

  it("descarta un tema inventado en vez de aplicarlo a ciegas", () => {
    expect(parse('[{"type":"applyStyleTheme","theme":"cyberpunk"}]')).toEqual([])
    expect(parse('[{"type":"applyStyleTheme"}]')).toEqual([])
  })

  it("etiqueta la acción con el nombre visible del tema", () => {
    expect(
      editorActionLabel({ type: "applyStyleTheme", theme: "corporate" })
    ).toContain("Corporativo")
  })

  it("ofrece el tema al modelo como alternativa a encadenar formatos", () => {
    const context = buildEditorAssistantContext(
      null,
      createDefaultDocumentWorkspaceState(),
      false,
      "none",
      { detail: "full" }
    )
    expect(context).toContain("applyStyleTheme")
    expect(context).toContain("editorial: Editorial")
    expect(context).toContain("prefiérela antes que encadenar muchos formatSelection")
  })
})

describe("tope de acciones por respuesta", () => {
  it("admite un rediseño completo de más de veinte pasos", () => {
    const many = Array.from({ length: 30 }, () => ({
      type: "insertPageBreak",
    }))
    const parsed = parseEditorAssistantResponse(
      `Plan.\n<editor_actions>\n${JSON.stringify(many)}\n</editor_actions>`
    )
    expect(parsed.actions).toHaveLength(30)
  })

  it("sigue frenando una respuesta desbocada", () => {
    const tooMany = Array.from({ length: 120 }, () => ({
      type: "insertPageBreak",
    }))
    const parsed = parseEditorAssistantResponse(
      `Plan.\n<editor_actions>\n${JSON.stringify(tooMany)}\n</editor_actions>`
    )
    expect(parsed.actions).toHaveLength(40)
  })
})

describe("contexto del editor por nivel de detalle", () => {
  const workspace = createDefaultDocumentWorkspaceState()
  const doc = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, anchorId: "h1" },
        content: [{ type: "text", text: "Introducción" }],
      },
      { type: "table", attrs: { tableStyle: "grid" } },
    ],
  }

  const build = (detail: "slim" | "bibliography" | "full", proactive = false) =>
    buildEditorAssistantContext(doc, workspace, true, "text", {
      detail,
      proactive,
    })

  it("mantiene el catálogo completo por defecto", () => {
    const porDefecto = buildEditorAssistantContext(doc, workspace, true)
    expect(porDefecto).toBe(build("full"))
    expect(porDefecto).toContain("insertTableOfContents")
  })

  it("ahorra el catálogo de acciones en Escribir", () => {
    const slim = build("slim")
    expect(slim).not.toContain("<editor_actions>")
    expect(slim).not.toContain("insertTableOfContents")
    expect(slim).not.toContain("ESTILOS DISPONIBLES")
    // Lo esencial sigue estando.
    expect(slim).toContain("Selección activa: sí")
    expect(slim).toContain("Introducción")
    expect(slim).toContain("tablas=1")
  })

  it("recorta el contexto a una fracción del completo", () => {
    expect(build("slim").length).toBeLessThan(build("full").length / 5)
  })

  it("da a Investigar las fuentes y solo las acciones de citar", () => {
    const research = build("bibliography")
    expect(research).toContain("FUENTES DISPONIBLES")
    expect(research).toContain("insertCitation")
    expect(research).toContain("insertBibliography")
    // Nada de maquetar desde este perfil.
    expect(research).not.toContain("setLayout")
    expect(research).not.toContain("setPageAppearance")
    expect(research).not.toContain("insertTableOfContents")
  })

  it("vuelve proactivo el protocolo solo cuando se pide", () => {
    expect(build("full", true)).toContain("sin esperar a que te la pidan")
    expect(build("full", false)).toContain(
      "cuando el usuario pida explícitamente"
    )
  })

  it("en modo proactivo pide el plan antes de emitir acciones", () => {
    expect(build("full", true)).toContain(
      "responde con el plan en texto y no emitas todavía el bloque"
    )
  })

  it("prohíbe filtrar nombres internos de acciones al texto visible", () => {
    expect(build("full", true)).toContain("nómbralos en castellano llano")
    expect(build("full", true)).toContain("nunca escribas identificadores")
  })
})
