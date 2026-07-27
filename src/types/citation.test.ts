import { describe, expect, it } from "vitest"

import {
  ACADEMIC_CSL_STYLE_PRESETS,
  CSL_LOCALE_OPTIONS,
  compareCitationSources,
  deduplicateCitationSources,
  formatCitationClusterFallback,
  mergeCitationSources,
  normalizeDoi,
  normalizeIsbn,
  normalizeUrl,
  type CitationSource,
} from "./citation"

describe("catálogo CSL académico", () => {
  it("ofrece estilos actuales sin identificadores duplicados", () => {
    const styleIds = ACADEMIC_CSL_STYLE_PRESETS.map((preset) => preset.id)

    expect(new Set(styleIds).size).toBe(styleIds.length)
    expect(styleIds).toContain("modern-language-association")
    expect(styleIds).toContain("nlm-citation-sequence")
    expect(styleIds).toContain("oscola")
    expect(styleIds).not.toContain("modern-language-association-9th-edition")
    expect(styleIds).not.toContain("vancouver")
    expect(
      CSL_LOCALE_OPTIONS.every((option) =>
        /^[a-z]{2,3}-[A-Z]{2}$/.test(option.value)
      )
    ).toBe(true)
  })
})

function source(
  id: string,
  overrides: Partial<CitationSource> = {}
): CitationSource {
  return {
    id,
    author: "García Márquez, Gabriel",
    title: "Cien años de soledad",
    year: "1967",
    publisher: "Editorial Sudamericana",
    url: "",
    ...overrides,
  }
}

describe("identidad bibliográfica y duplicados", () => {
  it("normaliza DOI, ISBN y URL antes de comparar", () => {
    expect(normalizeDoi("https://doi.org/10.1000/ABC.123")).toBe(
      "10.1000/abc.123"
    )
    expect(normalizeIsbn("ISBN 978-84-376-0494-7")).toBe("9788437604947")
    expect(
      normalizeUrl(
        "https://www.example.org/obra/?utm_source=boletin&lang=es#capitulo"
      )
    ).toBe("example.org/obra?lang=es")
  })

  it("identifica el mismo DOI aunque esté registrado de formas distintas", () => {
    const candidate = compareCitationSources(
      source("zotero", { doi: "https://doi.org/10.1000/ABC.123" }),
      source("manual", { doi: "doi:10.1000/abc.123" })
    )

    expect(candidate.score).toBe(100)
    expect(candidate.confidence).toBe("exact")
    expect(candidate.reasons).toContain("Mismo DOI")
  })

  it("detecta títulos equivalentes con acentos o puntuación diferentes", () => {
    const candidate = compareCitationSources(
      source("one"),
      source("two", {
        author: "Gabriel Garcia Marquez",
        title: "Cien anos de soledad.",
      })
    )

    expect(candidate.score).toBeGreaterThanOrEqual(90)
    expect(candidate.reasons).toContain("Mismo título normalizado")
  })

  it("no fusiona automáticamente solo por compartir título", () => {
    const result = deduplicateCitationSources(
      [
        source("one", { author: "", year: "", publisher: "" }),
        source("two", { author: "", year: "", publisher: "" }),
      ],
      92
    )

    expect(result.sources).toHaveLength(2)
    expect(result.mergedCount).toBe(0)
  })

  it("fusiona la coincidencia segura conservando metadatos y vínculos de Zotero", () => {
    const result = deduplicateCitationSources([
      source("canonical", {
        doi: "10.1000/abc.123",
        publisher: "",
        zoteroKeys: ["user:42:AAAA"],
      }),
      source("duplicate", {
        doi: "https://doi.org/10.1000/ABC.123",
        publisher: "Editorial Sudamericana, Buenos Aires",
        zoteroKeys: ["group:7:BBBB"],
      }),
    ])

    expect(result.sources).toHaveLength(1)
    expect(result.replacements).toEqual({ duplicate: "canonical" })
    expect(result.sources[0]).toMatchObject({
      id: "canonical",
      title: "Cien años de soledad",
      publisher: "Editorial Sudamericana, Buenos Aires",
      doi: "10.1000/abc.123",
      zoteroKeys: ["user:42:AAAA", "group:7:BBBB"],
    })
  })

  it("actualiza una referencia de Zotero reimportada sin duplicar su identidad", () => {
    const result = deduplicateCitationSources([
      source("zotero-user-42-AAAA", { publisher: "" }),
      source("zotero-user-42-AAAA", {
        publisher: "Editorial actualizada desde Zotero",
      }),
    ])

    expect(result.sources).toHaveLength(1)
    expect(result.mergedCount).toBe(1)
    expect(result.sources[0].publisher).toBe(
      "Editorial actualizada desde Zotero"
    )
  })

  it("compone citas múltiples con localizadores y modo narrativo", () => {
    const first = source("one")
    const second = source("two", {
      author: "Borges, Jorge Luis",
      title: "Ficciones",
      year: "1944",
    })
    const rendered = formatCitationClusterFallback(
      {
        id: "cluster-one",
        mode: "parenthetical",
        items: [
          { sourceId: first.id, locator: "23–25", label: "page" },
          { sourceId: second.id },
        ],
      },
      [first, second],
      "apa"
    )

    expect(rendered).toContain("García Márquez")
    expect(rendered).toContain("23–25")
    expect(rendered).toContain("Borges")
  })

  it("respeta la elección de campos al fusionar y conserva adjuntos", () => {
    const merged = mergeCitationSources(
      source("canonical", {
        title: "Título existente",
        attachments: [
          {
            key: "AAAA",
            title: "PDF",
            filename: "uno.pdf",
            contentType: "application/pdf",
            parentItem: "PARENT1",
          },
        ],
      }),
      source("duplicate", {
        title: "Título preferido",
        attachments: [
          {
            key: "BBBB",
            title: "Datos",
            filename: "datos.csv",
            contentType: "text/csv",
            parentItem: "PARENT2",
          },
        ],
      }),
      { title: "duplicate" }
    )

    expect(merged.title).toBe("Título preferido")
    expect(merged.attachments).toHaveLength(2)
  })
})
