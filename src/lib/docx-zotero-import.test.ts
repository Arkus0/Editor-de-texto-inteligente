import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

import {
  buildCitationFieldInstruction,
  buildZoteroCitationPayload,
} from "@/lib/citation-csl"
import type { CitationSource } from "@/types/citation"

const require = createRequire(import.meta.url)

interface ImportedCitation {
  marker: string
  clusterId: string
  mode: string
  label: string
  items: Array<{
    sourceId: string
    locator?: string
    label?: string
    suppressAuthor?: boolean
  }>
}

interface ImportedSource {
  id: string
  author: string
  title: string
  year: string
  publisher: string
  itemType?: string
  doi?: string
  zoteroLinks?: Array<{
    libraryType: string
    libraryId: string
    itemKey: string
  }>
}

const {
  extractZoteroCitations,
  injectZoteroCitationMarkers,
  restoreZoteroCitationMarkers,
} = require("../../electron/docx-import-utils.cjs") as {
  extractZoteroCitations: (xml: string) => {
    citations: ImportedCitation[]
    sources: ImportedSource[]
  }
  injectZoteroCitationMarkers: (
    xml: string,
    citations: ImportedCitation[]
  ) => string
  restoreZoteroCitationMarkers: (
    html: string,
    citations: ImportedCitation[]
  ) => string
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

/** Un campo de Word tal y como lo escribe Zotero. */
function zoteroFieldXml(instruction: string, visible: string) {
  return (
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:instrText xml:space="preserve">${escapeXml(
      instruction
    )}</w:instrText></w:r>` +
    `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r><w:t>${escapeXml(visible)}</w:t></w:r>` +
    `<w:r><w:fldChar w:fldCharType="end"/></w:r>`
  )
}

const SOURCE: CitationSource = {
  id: "source-one",
  author: "García Márquez, Gabriel",
  title: "Cien años de soledad",
  year: "1967",
  publisher: "Editorial Sudamericana",
  url: "",
  doi: "10.1234/abcd",
  itemType: "book",
  zoteroLinks: [
    {
      mode: "web",
      libraryType: "user",
      libraryId: "482906",
      itemKey: "ABCD1234",
      version: 3,
    },
  ],
}

function documentWithZoteroCitation() {
  const payload = buildZoteroCitationPayload(
    {
      id: "cluster-one",
      mode: "parenthetical",
      items: [{ sourceId: "source-one", locator: "42", label: "page" }],
    },
    new Map([["source-one", SOURCE]]),
    "(García Márquez, 1967, p. 42)"
  )
  const instruction = buildCitationFieldInstruction(payload)
  return (
    `<w:document><w:body><w:p><w:r><w:t>Según </w:t></w:r>` +
    zoteroFieldXml(instruction, "(García Márquez, 1967, p. 42)") +
    `<w:r><w:t> la novela…</w:t></w:r></w:p></w:body></w:document>`
  )
}

describe("lectura de citas de Zotero al abrir un DOCX", () => {
  it("recupera la cita de un campo de Zotero", () => {
    // Sin esto, el documento de un coautor entraba con las citas convertidas en
    // texto plano y la bibliografía vacía.
    const { citations } = extractZoteroCitations(documentWithZoteroCitation())
    expect(citations).toHaveLength(1)
    expect(citations[0].clusterId).toBe("cluster-one")
    expect(citations[0].label).toBe("(García Márquez, 1967, p. 42)")
    expect(citations[0].items[0].locator).toBe("42")
    expect(citations[0].items[0].label).toBe("page")
  })

  it("reconstruye la fuente con sus datos bibliográficos", () => {
    const { sources } = extractZoteroCitations(documentWithZoteroCitation())
    expect(sources).toHaveLength(1)
    expect(sources[0].title).toBe("Cien años de soledad")
    expect(sources[0].author).toBe("García Márquez, Gabriel")
    expect(sources[0].year).toBe("1967")
    expect(sources[0].publisher).toBe("Editorial Sudamericana")
    expect(sources[0].doi).toBe("10.1234/abcd")
    expect(sources[0].itemType).toBe("book")
  })

  it("conserva el vínculo con la biblioteca de Zotero", () => {
    const { sources } = extractZoteroCitations(documentWithZoteroCitation())
    expect(sources[0].zoteroLinks?.[0]).toMatchObject({
      libraryType: "user",
      libraryId: "482906",
      itemKey: "ABCD1234",
    })
  })

  it("da a la fuente un identificador estable entre documentos", () => {
    // Si el identificador cambiara en cada apertura, abrir dos archivos que
    // citan el mismo libro llenaría la bibliografía de duplicados.
    const first = extractZoteroCitations(documentWithZoteroCitation())
    const second = extractZoteroCitations(documentWithZoteroCitation())
    expect(first.sources[0].id).toBe(second.sources[0].id)
    expect(first.sources[0].id).toContain("ABCD1234")
  })

  it("no repite una fuente citada varias veces", () => {
    const xml = documentWithZoteroCitation().replace(
      "</w:body>",
      `<w:p>${documentWithZoteroCitation().match(
        /<w:r><w:fldChar[\s\S]*fldCharType="end"\/><\/w:r>/
      )?.[0] ?? ""}</w:p></w:body>`
    )
    const { sources } = extractZoteroCitations(xml)
    expect(new Set(sources.map((source) => source.id)).size).toBe(
      sources.length
    )
  })

  it("sustituye el campo por una marca y la devuelve como cita del editor", () => {
    const xml = documentWithZoteroCitation()
    const { citations } = extractZoteroCitations(xml)
    const marked = injectZoteroCitationMarkers(xml, citations)

    expect(marked).toContain(citations[0].marker)
    expect(marked).not.toContain("ZOTERO_ITEM")

    const html = restoreZoteroCitationMarkers(
      `<p>Según ${citations[0].marker} la novela…</p>`,
      citations
    )
    expect(html).toContain('data-citation-cluster-id="cluster-one"')
    expect(html).toContain('data-citation-mode="parenthetical"')
    expect(html).toContain("data-citation-items=")
    expect(html).not.toContain(citations[0].marker)
  })

  it("ignora un campo con el JSON roto sin perder el resto del documento", () => {
    const broken =
      `<w:document><w:body><w:p>` +
      zoteroFieldXml(
        "ADDIN ZOTERO_ITEM CSL_CITATION {esto no es json",
        "(Roto, 2020)"
      ) +
      `</w:p></w:body></w:document>`
    expect(() => extractZoteroCitations(broken)).not.toThrow()
    expect(extractZoteroCitations(broken).citations).toHaveLength(0)
  })

  it("ida y vuelta: lo exportado se vuelve a leer como cita y como fuente", async () => {
    // La prueba que de verdad importa: se exporta un documento con una cita,
    // se vuelve a abrir el archivo generado y tiene que reaparecer la cita con
    // su localizador y la fuente con su vínculo a Zotero, no un texto suelto.
    const JSZip = (await import("jszip")).default
    const { createDocumentDocxBlob } = await import("@/lib/export/exportDocx")
    const { createDefaultDocumentWorkspaceState } = await import(
      "@/types/document"
    )

    const state = createDefaultDocumentWorkspaceState()
    state.bibliography.sources = [SOURCE]
    const blob = await createDocumentDocxBlob(
      [
        {
          type: "paragraph",
          runs: [
            {
              text: "(García Márquez, 1967, p. 42)",
              citationSourceId: "source-one",
              citationClusterId: "cluster-one",
              citationMode: "parenthetical",
              citationItems: [
                { sourceId: "source-one", locator: "42", label: "page" },
              ],
            },
          ],
        },
      ],
      state
    )

    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const documentXml = await zip.file("word/document.xml")!.async("string")
    const { citations, sources } = extractZoteroCitations(documentXml)

    expect(citations).toHaveLength(1)
    expect(citations[0].label).toBe("(García Márquez, 1967, p. 42)")
    expect(citations[0].items[0].locator).toBe("42")
    expect(sources).toHaveLength(1)
    expect(sources[0].title).toBe("Cien años de soledad")
    expect(sources[0].zoteroLinks?.[0].itemKey).toBe("ABCD1234")
  })

  it("no toca los campos de Word que no son de Zotero", () => {
    const xml =
      `<w:document><w:body><w:p>` +
      zoteroFieldXml("PAGE \\* MERGEFORMAT", "3") +
      `</w:p></w:body></w:document>`
    const { citations } = extractZoteroCitations(xml)
    expect(citations).toHaveLength(0)
    expect(injectZoteroCitationMarkers(xml, [])).toBe(xml)
  })
})
