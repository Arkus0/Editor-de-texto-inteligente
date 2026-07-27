import { describe, expect, it } from "vitest"

import {
  formatBibliographyEntry,
  formatInlineCitation,
  type CitationSource,
} from "./useCitationStore"

const source: CitationSource = {
  id: "source-1",
  author: "Arendt, Hannah",
  title: "The Human Condition",
  year: "1958",
  publisher: "University of Chicago Press",
  url: "https://example.com/arendt",
}

describe("formato bibliográfico", () => {
  it("genera citas breves para APA, MLA y Chicago", () => {
    expect(formatInlineCitation(source, "apa")).toBe("(Arendt, 1958)")
    expect(formatInlineCitation(source, "mla")).toBe("(Arendt 1958)")
    expect(formatInlineCitation(source, "chicago")).toBe("(Arendt 1958)")
  })

  it("genera entradas bibliográficas con los metadatos disponibles", () => {
    expect(formatBibliographyEntry(source, "apa")).toContain("(1958)")
    expect(formatBibliographyEntry(source, "mla")).toContain("The Human Condition")
    expect(formatBibliographyEntry(source, "chicago")).toContain("University of Chicago Press")
  })
})

