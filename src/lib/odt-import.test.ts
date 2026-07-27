import { createRequire } from "node:module"
import JSZip from "jszip"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { extractOdtDocument } = require(
  "../../electron/odt-utils.cjs"
) as {
  extractOdtDocument: (bytes: Uint8Array) => Promise<{
    html: string
    documentJson: string
    warnings: string[]
  }>
}

describe("importación ODT", () => {
  it("convierte títulos, estilos, tabulaciones, listas, tablas e imágenes", async () => {
    const zip = new JSZip()
    zip.file("mimetype", "application/vnd.oasis.opendocument.text")
    zip.file(
      "styles.xml",
      `<?xml version="1.0"?>
      <office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
        <office:styles>
          <style:style style:name="P1" style:display-name="Normal" style:family="paragraph">
            <style:paragraph-properties fo:margin-left="1cm">
              <style:tab-stops><style:tab-stop style:position="2.54cm"/></style:tab-stops>
            </style:paragraph-properties>
          </style:style>
          <text:list-style style:name="L1"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style>
        </office:styles>
        <office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin="2cm"/></style:page-layout></office:automatic-styles>
      </office:document-styles>`
    )
    zip.file(
      "content.xml",
      `<?xml version="1.0"?>
      <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0">
        <office:body><office:text>
          <text:h text:outline-level="1">Informe</text:h>
          <text:p text:style-name="P1">Etiqueta<text:tab/>Valor</text:p>
          <text:list text:style-name="L1"><text:list-item><text:p>Primero</text:p></text:list-item></text:list>
          <table:table><table:table-row><table:table-cell><text:p>Dato</text:p></table:table-cell></table:table-row></table:table>
          <text:p><draw:frame svg:width="2cm" svg:height="1cm"><draw:image xlink:href="Pictures/test.png"/><svg:title>Gráfico</svg:title></draw:frame></text:p>
        </office:text></office:body>
      </office:document-content>`
    )
    zip.file(
      "Pictures/test.png",
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
    const bytes = await zip.generateAsync({ type: "uint8array" })

    const imported = await extractOdtDocument(bytes)
    expect(imported.html).toContain("<h1>Informe</h1>")
    expect(imported.html).toContain('data-tab-stop="72"')
    expect(imported.html).toContain("<ol>")
    expect(imported.html).toContain("<table>")
    expect(imported.html).toContain("data:image/png;base64,")
    expect(imported.html).toContain(
      "&quot;leftIndent&quot;:28.346"
    )
    expect(JSON.parse(imported.documentJson).layout.pageSize).toBe("a4")
  })
})
