import JSZip from "jszip"
import { XMLValidator } from "fast-xml-parser"
import { describe, expect, it } from "vitest"

import { createDefaultDocumentWorkspaceState } from "../../types/document"
import type { CitationSource } from "../../types/citation"
import type { BlockNode } from "./document-ast"
import { createDocumentDocxBlob } from "./exportDocx"

const ZOTERO_SOURCE: CitationSource = {
  id: "source-one",
  author: "García Márquez, Gabriel",
  title: "Cien años de soledad",
  year: "1967",
  publisher: "Editorial Sudamericana",
  url: "",
  itemType: "book",
  zoteroLinks: [
    {
      mode: "web",
      libraryType: "user",
      libraryId: "482906",
      itemKey: "ABCD1234",
      version: 12,
    },
  ],
}

function documentWithCitation(): BlockNode[] {
  return [
    {
      type: "paragraph",
      runs: [
        {
          text: "(García Márquez, 1967)",
          citationSourceId: "source-one",
          citationClusterId: "cluster-one",
          citationMode: "parenthetical",
          citationItems: [
            { sourceId: "source-one", locator: "42", label: "page" },
          ],
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
  ]
}

async function exportAndReadDocumentXml(
  sources: CitationSource[]
): Promise<string> {
  const state = createDefaultDocumentWorkspaceState()
  state.bibliography.sources = sources
  state.bibliography.style = "apa"
  const blob = await createDocumentDocxBlob(documentWithCitation(), state)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const entry = zip.file("word/document.xml")
  expect(entry).not.toBeNull()
  return entry!.async("string")
}

describe("profundidad de párrafo en el DOCX exportado", () => {
  async function documentXmlFor(
    paragraphFormat: Record<string, unknown>
  ): Promise<string> {
    const state = createDefaultDocumentWorkspaceState()
    const blob = await createDocumentDocxBlob(
      [
        {
          type: "paragraph",
          paragraphFormat: paragraphFormat as never,
          runs: [{ text: "Texto" }],
        },
      ],
      state
    )
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    return zip.file("word/document.xml")!.async("string")
  }

  const base = {
    leftIndent: 0,
    rightIndent: 0,
    firstLineIndent: 0,
    tabStops: [],
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
  }

  it("escribe el interlineado exacto en veinteavos de punto, no en líneas", async () => {
    // Sin `w:lineRule`, Word interpretaba «exacto de 24 pt» como 24 líneas.
    const xml = await documentXmlFor({
      ...base,
      lineSpacingRule: "exactly",
      lineSpacing: 24,
    })
    expect(xml).toMatch(/w:lineRule="exact"/)
    expect(xml).toMatch(/w:line="480"/)
  })

  it("distingue «mínimo» de «exacto»", async () => {
    const xml = await documentXmlFor({
      ...base,
      lineSpacingRule: "atLeast",
      lineSpacing: 18,
    })
    expect(xml).toMatch(/w:lineRule="atLeast"/)
    expect(xml).toMatch(/w:line="360"/)
  })

  it("un múltiplo se sigue midiendo en líneas de 240", async () => {
    const xml = await documentXmlFor({
      ...base,
      lineSpacingRule: "multiple",
      lineSpacing: 2,
    })
    expect(xml).toMatch(/w:line="480"/)
    expect(xml).not.toMatch(/w:lineRule="exact"/)
  })

  it("exporta el espaciado contextual y el nivel de esquema", async () => {
    const xml = await documentXmlFor({
      ...base,
      contextualSpacing: true,
      outlineLevel: 2,
    })
    expect(xml).toContain("contextualSpacing")
    expect(xml).toContain("outlineLvl")
  })
})

describe("citas de Zotero en el DOCX exportado", () => {
  it("escribe la cita como campo que Zotero reconoce", async () => {
    // Antes salía como texto corriente: se veía bien, pero en Word era texto
    // muerto. Zotero no podía actualizarla, ni editar el localizador, ni
    // regenerar la bibliografía al añadir una fuente.
    const documentXml = await exportAndReadDocumentXml([ZOTERO_SOURCE])

    expect(documentXml).toContain("ADDIN ZOTERO_ITEM CSL_CITATION")
    expect(documentXml).toContain('w:fldCharType="begin"')
    expect(documentXml).toContain('w:fldCharType="separate"')
    expect(documentXml).toContain('w:fldCharType="end"')
  })

  it("incluye el URI de Zotero, que es lo que identifica el elemento", async () => {
    const documentXml = await exportAndReadDocumentXml([ZOTERO_SOURCE])
    expect(documentXml).toContain(
      "http://zotero.org/users/482906/items/ABCD1234"
    )
  })

  it("conserva el localizador y los datos CSL del elemento", async () => {
    const documentXml = await exportAndReadDocumentXml([ZOTERO_SOURCE])
    const instruction = documentXml.match(
      /ADDIN ZOTERO_ITEM CSL_CITATION (\{[\s\S]*?\})<\/w:instrText>/
    )?.[1]
    expect(instruction).toBeTruthy()

    const payload = JSON.parse(
      instruction!.replaceAll("&quot;", '"').replaceAll("&amp;", "&")
    )
    expect(payload.citationID).toBe("cluster-one")
    expect(payload.properties.plainCitation).toBe("(García Márquez, 1967)")
    expect(payload.citationItems).toHaveLength(1)
    expect(payload.citationItems[0].locator).toBe("42")
    expect(payload.citationItems[0].label).toBe("page")
    expect(payload.citationItems[0].itemData.title).toBe(
      "Cien años de soledad"
    )
    expect(payload.citationItems[0].itemData.author[0]).toEqual({
      family: "García Márquez",
      given: "Gabriel",
    })
  })

  it("envuelve la bibliografía para que Zotero pueda regenerarla", async () => {
    const documentXml = await exportAndReadDocumentXml([ZOTERO_SOURCE])
    expect(documentXml).toContain("ADDIN ZOTERO_BIBL")
    expect(documentXml).toContain("CSL_BIBLIOGRAPHY")
    // Sin la preferencia de estilo, Zotero pregunta cuál usar al refrescar.
    expect(documentXml).toContain("ZOTERO_PREF_1")
    expect(documentXml).toContain("www.zotero.org/styles/apa")
  })

  it("la cita se sigue leyendo igual para quien no tenga Zotero", async () => {
    const documentXml = await exportAndReadDocumentXml([ZOTERO_SOURCE])
    expect(documentXml).toContain("(García Márquez, 1967)")
    expect(documentXml).toContain("Cien años de soledad")
  })

  it("no deja ninguna marca interna suelta en el documento", async () => {
    // Las marcas son texto normal hasta que el post-proceso las sustituye; si
    // una se escapa, el lector la ve escrita en mitad del párrafo.
    for (const sources of [[ZOTERO_SOURCE], [{ ...ZOTERO_SOURCE, zoteroLinks: undefined }]]) {
      const documentXml = await exportAndReadDocumentXml(sources)
      expect(documentXml).not.toContain("__ETI_CITE_")
      expect(documentXml).not.toContain("__ETI_BIBL_")
    }
  })

  it("sin vínculo con Zotero deja la cita como texto, sin campos vacíos", async () => {
    const documentXml = await exportAndReadDocumentXml([
      { ...ZOTERO_SOURCE, zoteroLinks: undefined },
    ])
    expect(documentXml).not.toContain("ZOTERO_ITEM")
    expect(documentXml).toContain("(García Márquez, 1967)")
  })

  it("produce un XML válido", async () => {
    const documentXml = await exportAndReadDocumentXml([ZOTERO_SOURCE])
    expect(XMLValidator.validate(documentXml)).toBe(true)
  })
})
