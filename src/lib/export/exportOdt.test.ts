import { createRequire } from "node:module"
import JSZip from "jszip"
import { describe, expect, it } from "vitest"

import { createDocumentOdtBlob } from "@/lib/export/exportOdt"
import { createDefaultDocumentWorkspaceState } from "@/types/document"
import type { BlockNode } from "@/lib/export/document-ast"

const require = createRequire(import.meta.url)
const { extractOdtDocument } = require(
  "../../../electron/odt-utils.cjs"
) as {
  extractOdtDocument: (bytes: Uint8Array) => Promise<{
    html: string
    documentJson: string
    warnings: string[]
  }>
}

describe("exportación ODT", () => {
  it("crea un paquete OpenDocument editable con estilos, listas y tablas", async () => {
    const blocks: BlockNode[] = [
      {
        type: "heading",
        level: 1,
        anchorId: "intro",
        runs: [{ text: "Informe", bold: true }],
      },
      {
        type: "paragraph",
        paragraphFormat: {
          leftIndent: 18,
          rightIndent: 0,
          firstLineIndent: 12,
          tabStops: [72],
          spacingBefore: 0,
          spacingAfter: 8,
          lineSpacingRule: "multiple",
          lineSpacing: 1,
          contextualSpacing: false,
          outlineLevel: 0,
          keepWithNext: false,
          keepLinesTogether: false,
          widowOrphanControl: true,
          pageBreakBefore: false,
          suppressLineNumbers: false,
        },
        runs: [
          {
            text: "Etiqueta\t",
            italic: true,
            bookmarkId: "bookmark-etiqueta",
            bookmarkName: "Etiqueta",
          },
          { text: "valor", link: "https://example.com" },
        ],
      },
      {
        type: "orderedList",
        items: [[{ type: "paragraph", runs: [{ text: "Primero" }] }]],
      },
      {
        type: "image",
        src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        width: 180,
        height: 180,
        alt: "Gráfico accesible",
        align: "right",
        wrap: "tight-right",
        spacing: 12,
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
        borderStyle: "double",
        padding: 16,
      },
      {
        type: "table",
        repeatHeader: true,
        allowRowBreak: true,
        tableStyle: "banded",
        rows: [
          {
            cells: [
              {
                header: true,
                content: [
                  { type: "paragraph", runs: [{ text: "Columna" }] },
                ],
              },
            ],
          },
          {
            cells: [
              {
                header: false,
                formula: "SUM(ABOVE)",
                content: [
                  { type: "paragraph", runs: [{ text: "12,5" }] },
                ],
              },
            ],
          },
        ],
      },
    ]

    const state = createDefaultDocumentWorkspaceState()
    state.pageAppearance.color = "#f4f1e8"
    state.pageAppearance.borderStyle = "dashed"
    state.pageAppearance.borderColor = "#123456"
    state.pageAppearance.borderWidth = 2
    state.pageAppearance.hyphenation = true
    state.pageAppearance.watermarkText = "BORRADOR"
    state.pageAppearance.watermarkColor = "#808080"
    state.pageAppearance.watermarkAngle = -35
    const blob = await createDocumentOdtBlob(blocks, state, "Informe")
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const content = await zip.file("content.xml")!.async("string")
    const styles = await zip.file("styles.xml")!.async("string")
    const manifest = await zip
      .file("META-INF/manifest.xml")!
      .async("string")

    expect(await zip.file("mimetype")!.async("string")).toBe(
      "application/vnd.oasis.opendocument.text"
    )
    expect(content).toContain('<text:h text:outline-level="1"')
    expect(content).toContain("<text:tab/>")
    expect(content).toContain("<text:list")
    expect(content).toContain("<table:table")
    expect(content).toContain("<draw:text-box>")
    expect(content).toContain("ETITextBox|float-right|right|double")
    expect(content).toContain('table:name="ETI-banded"')
    expect(content).toContain('table:formula="of:=SUM([.A1:.A1])"')
    expect(content).toContain('office:value="12.5"')
    expect(content).toContain('xlink:href="https://example.com"')
    expect(content).toContain('style:position="72pt"')
    expect(content).toContain(
      '<text:bookmark-start text:name="bookmark-etiqueta"/>'
    )
    expect(content).toContain(
      '<text:bookmark-end text:name="bookmark-etiqueta"/>'
    )
    expect(content).toContain('draw:style-name="ImageTightRight"')
    expect(content).toContain('text:anchor-type="paragraph"')
    expect(content).toContain(">Gráfico accesible</svg:title>")
    expect(styles).toContain('style:name="ImageTightRight"')
    expect(styles).toContain("<style:page-layout-properties")
    expect(styles).toContain('fo:background-color="#f4f1e8"')
    expect(styles).toContain("pt dashed #123456")
    expect(styles).toContain('fo:hyphenate="true"')
    expect(styles).toContain('draw:name="EditorInteligenteIAWatermark"')
    expect(styles).toContain(">BORRADOR</text:p>")
    expect(styles).toContain('fo:color="#808080"')
    expect(manifest).toContain('manifest:full-path="content.xml"')
    const reopened = await extractOdtDocument(
      new Uint8Array(await blob.arrayBuffer())
    )
    expect(reopened.html).toContain('data-table-style="banded"')
    expect(reopened.html).toContain('data-table-formula="SUM(ABOVE)"')
    expect(reopened.html).toContain('data-text-box="true"')
    expect(reopened.html).toContain('data-text-box-position="float-right"')
    expect(reopened.html).toContain(">Idea clave")
  })

  it("aplica la fuente, tamaño, negrita y color del estilo con nombre a los párrafos que lo usan", async () => {
    const state = createDefaultDocumentWorkspaceState()
    state.styles = [
      ...state.styles,
      {
        id: "custom-quote",
        name: "Cita destacada",
        fontFamily: "Georgia, serif",
        fontSize: 13,
        bold: true,
        italic: true,
        color: "7C3AED",
      },
    ]
    const blocks: BlockNode[] = [
      {
        type: "paragraph",
        styleId: "custom-quote",
        styleName: "Cita destacada",
        runs: [{ text: "Texto sin formato directo" }],
      },
    ]
    const blob = await createDocumentOdtBlob(blocks, state, "Estilos")
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const content = await zip.file("content.xml")!.async("string")

    expect(content).toContain('style:display-name="Cita destacada"')
    expect(content).toContain('style:font-name="Georgia, serif"')
    expect(content).toContain('fo:font-size="13pt"')
    expect(content).toContain('fo:font-weight="bold"')
    expect(content).toContain('fo:font-style="italic"')
    expect(content).toContain('fo:color="#7C3AED"')
  })

  it("vuelve a abrir el ODT exportado sin perder su estructura principal", async () => {
    const state = createDefaultDocumentWorkspaceState()
    state.sections[0].header.default = "Cabecera local"
    const blob = await createDocumentOdtBlob(
      [
        {
          type: "heading",
          level: 2,
          runs: [{ text: "Resultados" }],
        },
        {
          type: "paragraph",
          runs: [
            {
              text: "Dato ",
              bold: true,
              bookmarkId: "bookmark-dato",
              bookmarkName: "Dato",
            },
            { text: "verificado", underline: true },
          ],
        },
      ],
      state,
      "Prueba"
    )

    const imported = await extractOdtDocument(
      new Uint8Array(await blob.arrayBuffer())
    )
    expect(imported.html).toContain("<h2")
    expect(imported.html).toContain("Resultados")
    expect(imported.html).toContain("font-weight:bold")
    expect(imported.html).toContain("text-decoration-line:underline")
    expect(imported.html).toContain('data-bookmark-id="bookmark-dato"')
    expect(JSON.parse(imported.documentJson).sections[0].header.default).toBe(
      "Cabecera local"
    )
  })
})
