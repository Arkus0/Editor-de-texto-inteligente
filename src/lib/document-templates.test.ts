import { describe, expect, it } from "vitest"

import {
  DOCUMENT_TEMPLATES,
  getDocumentTemplate,
} from "@/lib/document-templates"

describe("plantillas de documento", () => {
  it("ofrece plantillas generales con identificadores únicos", () => {
    expect(new Set(DOCUMENT_TEMPLATES.map((template) => template.id)).size).toBe(
      DOCUMENT_TEMPLATES.length
    )
    expect(DOCUMENT_TEMPLATES.map((template) => template.id)).toEqual(
      expect.arrayContaining([
        "report",
        "letter",
        "resume",
        "meeting",
        "project",
        "academic",
      ])
    )
  })

  it("usa estilos semánticos compatibles con Word", () => {
    for (const template of DOCUMENT_TEMPLATES) {
      expect(template.html).toContain('data-word-style="')
      expect(template.html).toMatch(/data-word-style="(?:Title|Normal|Heading1)"/)
      expect(getDocumentTemplate(template.id)).toBe(template)
    }
  })
})
