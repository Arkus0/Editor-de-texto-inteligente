import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const {
  extractDocxRevisions,
  injectDocxRevisionMarkers,
  restoreDocxRevisionMarkers,
} = require("../../electron/docx-import-utils.cjs") as {
  extractDocxRevisions: (xml: string) => Array<{
    marker: string
    type: "insertion" | "deletion"
    author: string
    date: string
    text: string
  }>
  injectDocxRevisionMarkers: (
    xml: string,
    revisions: ReturnType<typeof extractDocxRevisions>
  ) => string
  restoreDocxRevisionMarkers: (
    html: string,
    revisions: ReturnType<typeof extractDocxRevisions>
  ) => string
}

const REVISED_DOCUMENT = `
<w:document><w:body>
  <w:p>
    <w:r><w:t xml:space="preserve">El tratamiento </w:t></w:r>
    <w:ins w:id="1" w:author="Ana Ruiz" w:date="2026-07-20T10:00:00Z">
      <w:r><w:t xml:space="preserve">más reciente </w:t></w:r>
    </w:ins>
    <w:del w:id="2" w:author="Luis Prat" w:date="2026-07-21T09:30:00Z">
      <w:r><w:delText xml:space="preserve">antiguo </w:delText></w:r>
    </w:del>
    <w:r><w:t>reduce los síntomas.</w:t></w:r>
  </w:p>
</w:body></w:document>
`

describe("importación de control de cambios desde DOCX", () => {
  it("reconoce inserciones y eliminaciones con su autor y su fecha", () => {
    const revisions = extractDocxRevisions(REVISED_DOCUMENT)
    expect(revisions).toHaveLength(2)

    expect(revisions[0]).toMatchObject({
      type: "insertion",
      author: "Ana Ruiz",
      date: "2026-07-20T10:00:00Z",
      text: "más reciente ",
    })
    expect(revisions[1]).toMatchObject({
      type: "deletion",
      author: "Luis Prat",
      text: "antiguo ",
    })
  })

  it("rescata el texto eliminado, que Word guarda fuera de w:t", () => {
    // Es lo que hacía desaparecer las eliminaciones: mammoth solo lee <w:t>.
    const revisions = extractDocxRevisions(REVISED_DOCUMENT)
    const deletion = revisions.find((item) => item.type === "deletion")
    expect(deletion?.text).toBe("antiguo ")
  })

  it("deja un XML sin revisiones pero con todo el texto a la vista", () => {
    const revisions = extractDocxRevisions(REVISED_DOCUMENT)
    const injected = injectDocxRevisionMarkers(REVISED_DOCUMENT, revisions)

    expect(injected).not.toMatch(/<w:ins\b/)
    expect(injected).not.toMatch(/<w:del\b/)
    for (const revision of revisions) {
      expect(injected).toContain(revision.marker)
    }
  })

  it("devuelve las marcas al HTML que el editor entiende", () => {
    const revisions = extractDocxRevisions(REVISED_DOCUMENT)
    const html = restoreDocxRevisionMarkers(
      `<p>El tratamiento ${revisions[0].marker}${revisions[1].marker}reduce los síntomas.</p>`,
      revisions
    )

    expect(html).toContain('<ins data-revision-id=')
    expect(html).toContain('data-author="Ana Ruiz"')
    expect(html).toContain("más reciente")
    expect(html).toContain('<del data-revision-id=')
    expect(html).toContain('data-author="Luis Prat"')
    expect(html).toContain("antiguo")
    expect(html).not.toContain("__ETI_REVISION_")
  })

  it("ignora las revisiones que solo marcan un cambio de formato", () => {
    // Word las escribe vacías o autocerradas dentro de <w:rPr>; convertirlas
    // en marcas metería texto fantasma en el documento.
    const formatOnly = `
      <w:p><w:pPr><w:rPr>
        <w:ins w:id="9" w:author="Ana" w:date="2026-07-20T10:00:00Z"/>
      </w:rPr></w:pPr>
      <w:r><w:t>Sin cambios de texto</w:t></w:r></w:p>
    `
    expect(extractDocxRevisions(formatOnly)).toHaveLength(0)
    expect(injectDocxRevisionMarkers(formatOnly, [])).toBe(formatOnly)
  })

  it("no toca un documento que no lleva control de cambios", () => {
    const plain = `<w:p><w:r><w:t>Texto normal</w:t></w:r></w:p>`
    expect(extractDocxRevisions(plain)).toHaveLength(0)
    expect(injectDocxRevisionMarkers(plain, [])).toBe(plain)
  })

  it("escapa el autor para que no rompa el HTML", () => {
    const hostile = `
      <w:p><w:ins w:id="1" w:author="A &lt;script&gt;&quot;" w:date="">
        <w:r><w:t>texto</w:t></w:r>
      </w:ins></w:p>
    `
    const revisions = extractDocxRevisions(hostile)
    const html = restoreDocxRevisionMarkers(revisions[0].marker, revisions)
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })
})
