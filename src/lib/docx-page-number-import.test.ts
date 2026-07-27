import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const {
  extractDocxComplexFields,
  extractDocxSimpleFields,
  extractDocxTextBoxes,
  extractOmmlEquations,
  extractParagraphFormats,
  injectDocxComplexFieldMarkers,
  injectDocxSimpleFieldMarkers,
  injectDocxTextBoxMarkers,
  injectOmmlEquationMarkers,
  injectParagraphFormats,
  inspectPageNumberField,
  parseLineNumberSettings,
  restoreDocxFieldMarkers,
  restoreDocxTextBoxMarkers,
  restoreOmmlEquationMarkers,
} = require(
  "../../electron/docx-import-utils.cjs"
) as {
  extractDocxComplexFields: (xml: string) => Array<{
    instruction: string
    cachedValue: string
    referenceTarget?: string
    marker?: string
  }>
  extractDocxSimpleFields: (xml: string) => Array<{
    instruction: string
    cachedValue: string
    referenceTarget?: string
    marker?: string
  }>
  extractOmmlEquations: (xml: string) => Array<{
    paragraphIndex: number
    marker: string
    latex: string
  }>
  extractParagraphFormats: (xml: string) => Array<Record<string, unknown> | null>
  extractDocxTextBoxes: (xml: string) => Array<{
    marker: string
    text: string
    width: number
    minHeight: number
    align: "left" | "center" | "right"
    position: "inline" | "float-left" | "float-right"
    background: string
    borderColor: string
    borderStyle: "none" | "solid"
    padding: number
  }>
  injectOmmlEquationMarkers: (
    xml: string,
    equations: Array<{
      paragraphIndex: number
      marker: string
      latex: string
    }>
  ) => string
  injectDocxSimpleFieldMarkers: (
    xml: string,
    fields: Array<{
      instruction: string
      cachedValue: string
      referenceTarget?: string
      marker?: string
    }>
  ) => string
  injectDocxComplexFieldMarkers: (
    xml: string,
    fields: Array<{
      instruction: string
      cachedValue: string
      referenceTarget?: string
      marker?: string
    }>
  ) => string
  injectDocxTextBoxMarkers: (
    xml: string,
    boxes: Array<{ marker: string }>
  ) => string
  injectParagraphFormats: (
    html: string,
    formats: Array<Record<string, unknown> | null>
  ) => string
  inspectPageNumberField: (xml: string) => {
    hasPageNumber: boolean
    alignment: "left" | "center" | "right"
  }
  parseLineNumberSettings: (section: Record<string, unknown>) => {
    mode: "none" | "continuous" | "newPage" | "newSection"
    start: number
    countBy: number
    distance: number
  }
  restoreOmmlEquationMarkers: (
    html: string,
    equations: Array<{
      paragraphIndex: number
      marker: string
      latex: string
    }>
  ) => string
  restoreDocxFieldMarkers: (
    html: string,
    fields: Array<{
      instruction: string
      cachedValue: string
      referenceTarget?: string
      marker?: string
    }>
  ) => string
  restoreDocxTextBoxMarkers: (
    html: string,
    boxes: Array<Record<string, unknown>>
  ) => string
}

describe("importación de cuadros de texto DOCX", () => {
  it("conserva posición, tamaño, color y contenido editable", () => {
    const xml = `<w:document><w:body>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:pict>
        <v:shape style="width:3.75in;height:1in;position:relative;mso-position-horizontal:right;mso-wrap-style:square" fillcolor="#eff6ff" strokecolor="#2563eb" alt="ETITextBox|#eff6ff|#2563eb|double|20">
          <v:textbox><w:txbxContent>
            <w:p><w:r><w:t>Idea clave</w:t></w:r></w:p>
            <w:p><w:r><w:t>Segundo párrafo</w:t></w:r></w:p>
          </w:txbxContent></v:textbox>
        </v:shape>
      </w:pict></w:p>
    </w:body></w:document>`
    const boxes = extractDocxTextBoxes(xml)

    expect(boxes).toHaveLength(1)
    expect(boxes[0]).toMatchObject({
      text: "Idea clave\n\nSegundo párrafo",
      width: 360,
      minHeight: 96,
      align: "right",
      position: "float-right",
      background: "#eff6ff",
      borderColor: "#2563eb",
      borderStyle: "double",
      padding: 20,
    })
    const marked = injectDocxTextBoxMarkers(xml, boxes)
    expect(marked).toContain(boxes[0].marker)
    expect(marked).not.toContain("<v:textbox")

    const restored = restoreDocxTextBoxMarkers(
      `<p>${boxes[0].marker}</p>`,
      boxes
    )
    expect(restored).toContain('data-text-box="true"')
    expect(restored).toContain('data-text-box-position="float-right"')
    expect(restored).toContain("<p>Idea clave</p>")
    expect(restored).toContain("<p>Segundo párrafo</p>")
  })
})

describe("importación de numeración de páginas DOCX", () => {
  it("reconoce campos PAGE complejos y conserva su alineación", () => {
    const result = inspectPageNumberField(`
      <w:hdr>
        <w:p>
          <w:pPr><w:jc w:val="right"/></w:pPr>
          <w:r><w:fldChar w:fldCharType="begin"/></w:r>
          <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="end"/></w:r>
        </w:p>
      </w:hdr>
    `)

    expect(result).toEqual({ hasPageNumber: true, alignment: "right" })
  })

  it("reconoce fldSimple y normaliza start/end", () => {
    expect(
      inspectPageNumberField(`
        <w:ftr><w:p><w:pPr><w:jc w:val="start"/></w:pPr>
        <w:fldSimple w:instr=" PAGE \\* MERGEFORMAT "/></w:p></w:ftr>
      `)
    ).toEqual({ hasPageNumber: true, alignment: "left" })
  })

  it("no confunde texto normal con un campo de página", () => {
    expect(
      inspectPageNumberField(
        "<w:hdr><w:p><w:r><w:t>Página de portada</w:t></w:r></w:p></w:hdr>"
      )
    ).toEqual({ hasPageNumber: false, alignment: "center" })
  })
})

describe("importación de campos nativos DOCX", () => {
  it("conserva SEQ y reconstruye REF como referencia cruzada editable", () => {
    const xml = `
      <w:p>
        <w:r><w:t>Figura </w:t></w:r>
        <w:fldSimple w:instr="SEQ ETI_figure \\* ARABIC"><w:r><w:t>3</w:t></w:r></w:fldSimple>
        <w:r><w:t>. Resultado</w:t></w:r>
        <w:fldSimple w:instr="REF eti_figure_three \\h"><w:r><w:t>Figura 3</w:t></w:r></w:fldSimple>
      </w:p>
    `

    const fields = extractDocxSimpleFields(xml)
    expect(fields).toHaveLength(2)
    expect(fields[0]).toMatchObject({
      instruction: "SEQ ETI_figure \\* ARABIC",
      cachedValue: "3",
    })
    expect(fields[1]).toMatchObject({
      referenceTarget: "eti_figure_three",
      cachedValue: "Figura 3",
    })

    const preparedXml = injectDocxSimpleFieldMarkers(xml, fields)
    expect(preparedXml).toContain("<w:t xml:space=\"preserve\">3</w:t>")
    expect(preparedXml).toContain(fields[1].marker)
    expect(preparedXml).not.toContain("<w:fldSimple")

    const restoredHtml = restoreDocxFieldMarkers(
      `<p>Véase ${fields[1].marker}</p>`,
      fields
    )
    expect(restoredHtml).toContain(
      'data-reference-target="eti_figure_three"'
    )
    expect(restoredHtml).toContain(">Figura 3</span>")
  })

  it("recupera los campos complejos que genera Word de escritorio", () => {
    const xml = `
      <w:p>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText xml:space="preserve"> SEQ Figura \\* ARABIC </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>4</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
        <w:r><w:t> y </w:t></w:r>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText xml:space="preserve"> REF _Ref12345 \\h </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>Figura 4</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p>
    `

    const fields = extractDocxComplexFields(xml)
    expect(fields).toHaveLength(2)
    expect(fields[0]).toMatchObject({
      instruction: "SEQ Figura \\* ARABIC",
      cachedValue: "4",
    })
    expect(fields[1]).toMatchObject({
      instruction: "REF _Ref12345 \\h",
      cachedValue: "Figura 4",
      referenceTarget: "_Ref12345",
    })

    const preparedXml = injectDocxComplexFieldMarkers(xml, fields)
    expect(preparedXml).toContain("<w:t xml:space=\"preserve\">4</w:t>")
    expect(preparedXml).toContain(fields[1].marker)
    expect(preparedXml).not.toContain("<w:fldChar")

    const restoredHtml = restoreDocxFieldMarkers(
      `<p>${fields[1].marker}</p>`,
      fields
    )
    expect(restoredHtml).toContain('data-reference-target="_Ref12345"')
    expect(restoredHtml).toContain(">Figura 4</span>")
  })

  it("no consume campos TOC que abarcan varios párrafos", () => {
    const xml = `
      <w:body>
        <w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>TOC \\o "1-3"</w:instrText></w:r></w:p>
        <w:p><w:r><w:t>Entrada del índice</w:t></w:r></w:p>
        <w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
      </w:body>
    `

    const fields = extractDocxComplexFields(xml)
    expect(fields).toEqual([])
    expect(injectDocxComplexFieldMarkers(xml, fields)).toBe(xml)
  })
})

describe("importación de ecuaciones OMML DOCX", () => {
  it("recupera fracciones, raíces, scripts, sumatorios e integrales como LaTeX", () => {
    const xml = `
      <w:document><w:body><w:p><w:pPr><w:pStyle w:val="Equation"/></w:pPr>
        <m:oMath>
          <m:f>
            <m:num><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:num>
            <m:den><m:rad><m:deg/><m:e><m:r><m:t>y</m:t></m:r></m:e></m:rad></m:den>
          </m:f>
          <m:r><m:t>+</m:t></m:r>
          <m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub><m:r><m:t>i=1</m:t></m:r></m:sub><m:sup><m:r><m:t>n</m:t></m:r></m:sup><m:e/></m:nary>
          <m:sSub><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sub><m:r><m:t>i</m:t></m:r></m:sub></m:sSub>
          <m:r><m:t>+</m:t></m:r>
          <m:nary><m:naryPr><m:chr m:val="∫"/></m:naryPr><m:sub><m:r><m:t>0</m:t></m:r></m:sub><m:sup><m:r><m:t>1</m:t></m:r></m:sup><m:e><m:r><m:t>t</m:t></m:r></m:e></m:nary>
        </m:oMath>
      </w:p></w:body></w:document>
    `

    const equations = extractOmmlEquations(xml)
    expect(equations).toHaveLength(1)
    expect(equations[0].latex).toContain(
      String.raw`\frac{{x}^{2}}{\sqrt{y}}`
    )
    expect(equations[0].latex).toContain(String.raw`\sum_{i=1}^{n}{x}_{i}`)
    expect(equations[0].latex).toContain(String.raw`\int_{0}^{1}t`)

    const preparedXml = injectOmmlEquationMarkers(xml, equations)
    expect(preparedXml).toContain(equations[0].marker)
    expect(preparedXml).not.toContain("<m:oMath>")

    const restoredHtml = restoreOmmlEquationMarkers(
      `<p class="word-equation">${equations[0].marker} (1)</p>`,
      equations
    )
    expect(restoredHtml).toContain(String.raw`\frac`)
    expect(restoredHtml).toContain('data-imported-equation="true"')
    expect(restoredHtml).not.toContain(equations[0].marker)
  })
})

describe("importación de numeración de líneas DOCX", () => {
  it("conserva reinicio, inicio, intervalo y distancia de la sección", () => {
    expect(
      parseLineNumberSettings({
        "w:lnNumType": {
          "@w:restart": "newSection",
          "@w:start": "3",
          "@w:countBy": "5",
          "@w:distance": "420",
        },
      })
    ).toEqual({
      mode: "newSection",
      start: 3,
      countBy: 5,
      distance: 28,
    })
  })

  it("desactiva la numeración si la sección no contiene lnNumType", () => {
    expect(parseLineNumberSettings({})).toEqual({
      mode: "none",
      start: 1,
      countBy: 1,
      distance: 24,
    })
  })
})

describe("importación de formato directo de párrafo DOCX", () => {
  it("conserva sangrías, espaciado y controles de paginación", () => {
    const formats = extractParagraphFormats(`
      <w:document><w:body>
        <w:p><w:pPr>
          <w:ind w:left="720" w:right="360" w:hanging="360"/>
          <w:spacing w:before="120" w:after="240"/>
          <w:keepNext/><w:keepLines/>
          <w:widowControl w:val="0"/>
          <w:pageBreakBefore/>
          <w:suppressLineNumbers/>
        </w:pPr><w:r><w:t>Título</w:t></w:r></w:p>
        <w:p><w:r><w:t>Normal</w:t></w:r></w:p>
      </w:body></w:document>
    `)

    expect(formats).toEqual([
      {
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
      null,
    ])
  })

  it("inyecta el formato en párrafos, títulos y elementos de lista", () => {
    const html = injectParagraphFormats(
      "<h2>Uno</h2><li>Dos</li><p>Tres</p>",
      [
        { leftIndent: 36 },
        null,
        { spacingAfter: 12 },
      ]
    )

    expect(html).toContain(
      '<h2 data-paragraph-format="{&quot;leftIndent&quot;:36}">'
    )
    expect(html).toContain("<li>Dos</li>")
    expect(html).toContain(
      '<p data-paragraph-format="{&quot;spacingAfter&quot;:12}">'
    )
  })
})
