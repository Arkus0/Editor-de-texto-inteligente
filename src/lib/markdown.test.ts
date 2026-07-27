import { describe, expect, it } from "vitest"

import { htmlToMarkdown, markdownToHtml } from "./markdown"

describe("conversión Markdown/HTML", () => {
  it("mantiene títulos, énfasis y listas durante una ida y vuelta", () => {
    const markdown = "## Título\n\nUn texto con **énfasis**.\n\n- Uno\n- Dos"
    const html = markdownToHtml(markdown)
    const roundTrip = htmlToMarkdown(html)

    expect(roundTrip).toContain("## Título")
    expect(roundTrip).toContain("**énfasis**")
    expect(roundTrip).toMatch(/-\s+Uno/)
  })
})
