import { marked } from "marked"
import TurndownService from "turndown"

marked.setOptions({ gfm: true, breaks: false })

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
})
turndown.keep(["u"])

export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "<p></p>"
  return marked.parse(markdown, { async: false }) as string
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return ""
  return turndown.turndown(html).trim()
}
