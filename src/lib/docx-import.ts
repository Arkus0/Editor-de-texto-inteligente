import type { DocumentWorkspaceState } from "@/types/document"

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function trailingIdentifier(value: string, prefix: string) {
  const decoded = decodeURIComponent(value)
  const index = decoded.lastIndexOf(prefix)
  return index >= 0 ? decoded.slice(index + prefix.length) : ""
}

/**
 * Mammoth convierte muy bien el contenido de Word, pero representa notas y
 * comentarios como enlaces al final del HTML. Esta normalización los transforma
 * en nodos/marks editables de TipTap y elimina las listas auxiliares.
 */
export function normalizeImportedDocxHtml(
  html: string,
  state: DocumentWorkspaceState
) {
  if (typeof DOMParser === "undefined") return html
  const document = new DOMParser().parseFromString(html, "text/html")

  const knownStyles = new Map([
    ["word-title", { id: "Title", name: "Título" }],
    ["word-subtitle", { id: "Subtitle", name: "Subtítulo" }],
    ["word-normal", { id: "Normal", name: "Normal" }],
    ["word-heading-1", { id: "Heading1", name: "Título 1" }],
    ["word-heading-2", { id: "Heading2", name: "Título 2" }],
    ["word-heading-3", { id: "Heading3", name: "Título 3" }],
  ])
  for (const element of Array.from(
    document.body.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, h5, h6")
  )) {
    let matched = false
    for (const [className, style] of knownStyles) {
      if (!element.classList.contains(className)) continue
      element.dataset.wordStyle = style.id
      element.dataset.wordStyleName = style.name
      matched = true
      break
    }
    if (matched) continue
    for (const style of state.styles) {
      if (!element.classList.contains(`word-style-${slug(style.name)}`)) {
        continue
      }
      element.dataset.wordStyle = style.id
      element.dataset.wordStyleName = style.name
      break
    }
  }

  for (const heading of Array.from(
    document.body.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
  )) {
    const bookmark =
      heading.querySelector<HTMLAnchorElement>("a[id]:not([href])")
    if (!bookmark?.id) continue
    heading.dataset.anchorId = bookmark.id
    bookmark.remove()
  }

  let captionNumber = 0
  for (const paragraph of Array.from(
    document.body.querySelectorAll<HTMLElement>("p.word-caption")
  )) {
    captionNumber += 1
    const bookmark =
      paragraph.querySelector<HTMLAnchorElement>("a[id]:not([href])")
    const match = paragraph.textContent?.trim().match(
      /^(Figura|Tabla|Ecuación)\s+(\d+)[.:]?\s*(.*)$/i
    )
    const label = match?.[1] || "Figura"
    const kind =
      label.toLocaleLowerCase("es") === "tabla" ? "table" : "figure"
    paragraph.dataset.captionId =
      bookmark?.id || `imported-caption-${captionNumber}`
    paragraph.dataset.captionKind = kind
    paragraph.dataset.captionNumber = match?.[2] || String(captionNumber)
    paragraph.dataset.captionLabel =
      kind === "table" ? "Tabla" : "Figura"
    paragraph.dataset.captionTitle = match?.[3] || paragraph.textContent || ""
    bookmark?.remove()
  }

  let equationNumber = 0
  const equationParagraphs = new Set(
    Array.from(
      document.body.querySelectorAll<HTMLElement>("p.word-equation")
    )
  )
  for (const marker of Array.from(
    document.body.querySelectorAll<HTMLElement>(
      "[data-imported-equation='true']"
    )
  )) {
    const paragraph = marker.closest<HTMLElement>("p")
    if (!paragraph) continue
    const residualText = (paragraph.textContent ?? "")
      .replace(marker.textContent ?? "", "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .trim()
    if (!residualText) equationParagraphs.add(paragraph)
  }
  for (const paragraph of equationParagraphs) {
    equationNumber += 1
    const bookmark =
      paragraph.querySelector<HTMLAnchorElement>("a[id]:not([href])")
    const importedEquation = paragraph.querySelector<HTMLElement>(
      "[data-imported-equation='true']"
    )
    const text = paragraph.textContent?.trim() ?? ""
    const numberMatch = text.match(/\s+\((\d+)\)$/)
    const equation = document.createElement("div")
    equation.dataset.equationId =
      bookmark?.id || `imported-equation-${equationNumber}`
    equation.dataset.equationLatex =
      importedEquation?.dataset.equationLatex ||
      text.replace(/\s+\(\d+\)$/, "").trim()
    equation.dataset.equationNumber =
      numberMatch?.[1] || String(equationNumber)
    paragraph.replaceWith(equation)
  }

  for (const title of Array.from(
    document.body.querySelectorAll<HTMLElement>(".word-toc-title")
  )) {
    const entries: Array<{
      id: string
      level: number
      number: string
      text: string
    }> = []
    let sibling = title.nextElementSibling as HTMLElement | null
    while (sibling?.classList.contains("word-toc-entry")) {
      const level = sibling.classList.contains("word-toc-level-3")
        ? 3
        : sibling.classList.contains("word-toc-level-2")
          ? 2
          : 1
      const text = sibling.textContent?.trim() ?? ""
      entries.push({
        id: `imported-toc-${entries.length + 1}`,
        level,
        number: "",
        text,
      })
      const next = sibling.nextElementSibling as HTMLElement | null
      sibling.remove()
      sibling = next
    }
    const toc = document.createElement("nav")
    toc.dataset.tableOfContents = "true"
    toc.dataset.tocTitle = title.textContent?.trim() || "Índice"
    toc.dataset.tocMaxLevel = "3"
    toc.dataset.tocEntries = JSON.stringify(entries)
    title.replaceWith(toc)
  }

  for (const anchor of Array.from(
    document.body.querySelectorAll<HTMLAnchorElement>(
      'a[href*="#footnote-"], a[id*="footnote-ref-"]'
    )
  )) {
    const identifier =
      trailingIdentifier(anchor.getAttribute("href") ?? "", "footnote-") ||
      trailingIdentifier(anchor.id, "footnote-ref-")
    const number = Number.parseInt(identifier, 10)
    if (!Number.isFinite(number) || number <= 0) continue
    const reference = document.createElement("sup")
    reference.dataset.footnoteId =
      state.footnotes.find((footnote) => footnote.number === number)?.id ??
      `footnote-${number}`
    reference.dataset.footnoteNumber = String(number)
    reference.textContent = String(number)
    ;(anchor.closest("sup") ?? anchor).replaceWith(reference)
  }

  for (const anchor of Array.from(
    document.body.querySelectorAll<HTMLAnchorElement>(
      'a[href*="#endnote-"], a[id*="endnote-ref-"]'
    )
  )) {
    const identifier =
      trailingIdentifier(anchor.getAttribute("href") ?? "", "endnote-") ||
      trailingIdentifier(anchor.id, "endnote-ref-")
    const number = Number.parseInt(identifier, 10)
    if (!Number.isFinite(number) || number <= 0) continue
    const reference = document.createElement("sup")
    reference.dataset.endnoteId =
      state.endnotes.find((endnote) => endnote.number === number)?.id ??
      `endnote-${number}`
    reference.dataset.endnoteNumber = String(number)
    reference.textContent = String(number)
    ;(anchor.closest("sup") ?? anchor).replaceWith(reference)
  }

  for (const anchor of Array.from(
    document.body.querySelectorAll<HTMLAnchorElement>(
      'a[href*="#comment-"], a[id*="comment-ref-"]'
    )
  )) {
    const identifier =
      trailingIdentifier(anchor.getAttribute("href") ?? "", "comment-") ||
      trailingIdentifier(anchor.id, "comment-ref-")
    if (!identifier) continue
    const marker = document.createElement("span")
    marker.dataset.commentId = `comment-${identifier}`
    marker.textContent = "💬"
    ;(anchor.closest("sup") ?? anchor).replaceWith(marker)
  }

  for (const list of Array.from(document.body.querySelectorAll("ol, dl"))) {
    if (
      list.querySelector(
        '[id*="footnote-"], [id*="endnote-"], [id*="comment-"], a[href*="footnote-ref-"], a[href*="endnote-ref-"], a[href*="comment-ref-"]'
      )
    ) {
      list.remove()
    }
  }

  return document.body.innerHTML
}
