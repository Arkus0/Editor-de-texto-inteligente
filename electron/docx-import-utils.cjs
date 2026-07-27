const { XMLParser } = require("fast-xml-parser")

const PAGE_FIELD_PATTERN =
  /<w:instrText\b[^>]*>[\s\S]*?\bPAGE\b[\s\S]*?<\/w:instrText>|<w:fldSimple\b[^>]*\bw:instr=(?:"[^"]*\bPAGE\b[^"]*"|'[^']*\bPAGE\b[^']*')/i

function pageNumberAlignment(paragraphXml) {
  const match = paragraphXml.match(
    /<w:jc\b[^>]*\bw:val=(?:"(left|center|right|start|end)"|'(left|center|right|start|end)')[^>]*\/?>/i
  )
  const value = (match?.[1] ?? match?.[2] ?? "center").toLowerCase()
  if (value === "start") return "left"
  if (value === "end") return "right"
  return value
}

function inspectPageNumberField(xml) {
  const paragraphs =
    String(xml).match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi) ?? []
  const paragraph = paragraphs.find((candidate) =>
    PAGE_FIELD_PATTERN.test(candidate)
  )
  if (!paragraph) {
    return { hasPageNumber: false, alignment: "center" }
  }
  return {
    hasPageNumber: true,
    alignment: pageNumberAlignment(paragraph),
  }
}

function parseLineNumberSettings(section) {
  const lineNumberType = section?.["w:lnNumType"]
  const importedRestart = lineNumberType?.["@w:restart"]
  const mode = lineNumberType
    ? ["continuous", "newPage", "newSection"].includes(importedRestart)
      ? importedRestart
      : "newPage"
    : "none"
  const start = Number.parseInt(lineNumberType?.["@w:start"] ?? "1", 10)
  const countBy = Number.parseInt(lineNumberType?.["@w:countBy"] ?? "1", 10)
  const distanceTwips = Number.parseInt(
    lineNumberType?.["@w:distance"] ?? "",
    10
  )
  return {
    mode,
    start: Number.isFinite(start) ? Math.max(1, start) : 1,
    countBy: Number.isFinite(countBy) ? Math.max(1, countBy) : 1,
    distance: Number.isFinite(distanceTwips)
      ? Math.max(0, Math.round(distanceTwips / 15))
      : 24,
  }
}

function xmlAttribute(xml, name) {
  const match = String(xml).match(
    new RegExp(`\\bw:${name}=(?:"([^"]*)"|'([^']*)')`, "i")
  )
  return match?.[1] ?? match?.[2]
}

function twipsToPoints(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round((parsed / 20) * 100) / 100
}

function onOffProperty(propertiesXml, name, fallback) {
  const match = String(propertiesXml).match(
    new RegExp(`<w:${name}\\b([^>]*)\\/?>`, "i")
  )
  if (!match) return fallback
  const value = xmlAttribute(match[0], "val")
  return !["0", "false", "off", "no"].includes(
    String(value ?? "true").toLowerCase()
  )
}

function extractParagraphFormats(documentXml) {
  const paragraphs =
    String(documentXml).match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi) ?? []

  return paragraphs.map((paragraph) => {
    const properties =
      paragraph.match(
        /<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>|<w:pPr\b[^>]*\/>/i
      )?.[0] ?? ""
    if (!properties) return null

    const indentation = properties.match(/<w:ind\b[^>]*\/?>/i)?.[0] ?? ""
    const spacing = properties.match(/<w:spacing\b[^>]*\/?>/i)?.[0] ?? ""
    const left = xmlAttribute(indentation, "left")
      ?? xmlAttribute(indentation, "start")
    const right = xmlAttribute(indentation, "right")
      ?? xmlAttribute(indentation, "end")
    const firstLine = xmlAttribute(indentation, "firstLine")
    const hanging = xmlAttribute(indentation, "hanging")
    const before = xmlAttribute(spacing, "before")
    const after = xmlAttribute(spacing, "after")
    const supportedProperty =
      Boolean(indentation || spacing) ||
      /<w:(?:keepNext|keepLines|widowControl|pageBreakBefore|suppressLineNumbers)\b/i.test(
        properties
      )
    if (!supportedProperty) return null

    return {
      leftIndent: Math.max(0, twipsToPoints(left, 0)),
      rightIndent: Math.max(0, twipsToPoints(right, 0)),
      firstLineIndent:
        firstLine !== undefined
          ? twipsToPoints(firstLine, 0)
          : hanging !== undefined
            ? -Math.abs(twipsToPoints(hanging, 0))
            : 0,
      spacingBefore: Math.max(0, twipsToPoints(before, 0)),
      spacingAfter: Math.max(0, twipsToPoints(after, 8)),
      keepWithNext: onOffProperty(properties, "keepNext", false),
      keepLinesTogether: onOffProperty(properties, "keepLines", false),
      widowOrphanControl: onOffProperty(
        properties,
        "widowControl",
        true
      ),
      pageBreakBefore: onOffProperty(
        properties,
        "pageBreakBefore",
        false
      ),
      suppressLineNumbers: onOffProperty(
        properties,
        "suppressLineNumbers",
        false
      ),
    }
  })
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function decodeXmlValue(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number(code))
    )
}

function escapeXmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function extractDocxSimpleFields(documentXml) {
  const fields = []
  const pattern =
    /<w:fldSimple\b([^>]*?)(?:\/>|>([\s\S]*?)<\/w:fldSimple>)/gi
  for (const match of String(documentXml).matchAll(pattern)) {
    const attributes = match[1] ?? ""
    const instruction = decodeXmlValue(
      attributes.match(/\bw:instr=(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
        attributes.match(/\bw:instr=(?:"([^"]*)"|'([^']*)')/i)?.[2] ??
        ""
    ).trim()
    const cachedValue = decodeXmlValue(
      [...String(match[2] ?? "").matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)]
        .map((textMatch) => textMatch[1])
        .join("")
    )
    const referenceTarget = instruction.match(/\bREF\s+([^\s\\]+)/i)?.[1]
    fields.push({
      instruction,
      cachedValue,
      referenceTarget,
      marker: referenceTarget
        ? `__ETI_REFERENCE_${String(fields.length + 1).padStart(4, "0")}__`
        : undefined,
    })
  }
  return fields
}

const COMPLEX_FIELD_PATTERN =
  /<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:fldChar\b[^>]*\bw:fldCharType=(?:"begin"|'begin')[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>([\s\S]*?)<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:fldChar\b[^>]*\bw:fldCharType=(?:"end"|'end')[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/gi

function extractDocxComplexFields(documentXml) {
  const fields = []
  const paragraphs =
    String(documentXml).match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi) ?? []
  for (const paragraph of paragraphs) {
    for (const match of paragraph.matchAll(COMPLEX_FIELD_PATTERN)) {
      const body = match[1] ?? ""
      const unsupportedNested =
        /<w:fldChar\b[^>]*\bw:fldCharType=(?:"begin"|'begin')/i.test(body)
      const separator = body.match(
        /<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:fldChar\b[^>]*\bw:fldCharType=(?:"separate"|'separate')[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/i
      )
      const instructionXml = separator
        ? body.slice(0, separator.index)
        : body
      const cachedXml = separator
        ? body.slice((separator.index ?? 0) + separator[0].length)
        : ""
      const instruction = decodeXmlValue(
        [...instructionXml.matchAll(/<w:instrText\b[^>]*>([\s\S]*?)<\/w:instrText>/gi)]
          .map((instructionMatch) => instructionMatch[1])
          .join("")
      ).trim()
      const cachedValue = decodeXmlValue(
        [...cachedXml.matchAll(/<w:(?:t|delText)\b[^>]*>([\s\S]*?)<\/w:(?:t|delText)>/gi)]
          .map((textMatch) => textMatch[1])
          .join("")
      )
      const referenceTarget = instruction.match(/\bREF\s+([^\s\\]+)/i)?.[1]
      fields.push({
        instruction,
        cachedValue,
        referenceTarget,
        unsupportedNested,
        marker:
          referenceTarget && !unsupportedNested
            ? `__ETI_COMPLEX_REFERENCE_${String(fields.length + 1).padStart(4, "0")}__`
            : undefined,
      })
    }
  }
  return fields
}

/**
 * Citas de Zotero incrustadas por Word.
 *
 * Zotero guarda cada cita como un campo cuya instrucción es
 * `ADDIN ZOTERO_ITEM CSL_CITATION` seguida de un JSON con los elementos
 * citados, sus datos bibliográficos completos y el URI que los identifica en la
 * biblioteca. Al abrir el documento de un coautor, ese JSON es todo lo que hace
 * falta para reconstruir las citas y las fuentes sin pedirle nada al usuario;
 * sin leerlo, las citas entraban como texto plano y la bibliografía vacía.
 */
const ZOTERO_CITATION_INSTRUCTION = /^ADDIN\s+ZOTERO_ITEM\s+CSL_CITATION\s+/i

/** Tipos CSL traducidos al vocabulario de fuentes del editor. */
const ITEM_TYPE_BY_CSL_TYPE = {
  "article-journal": "journalArticle",
  chapter: "bookSection",
  "paper-conference": "conferencePaper",
  thesis: "thesis",
  webpage: "webpage",
  report: "report",
  manuscript: "manuscript",
  "article-newspaper": "newspaperArticle",
  "article-magazine": "magazineArticle",
  book: "book",
}

function cslNameToText(name) {
  if (!name || typeof name !== "object") return ""
  if (name.literal) return String(name.literal)
  const family = String(name.family ?? "").trim()
  const given = String(name.given ?? "").trim()
  if (family && given) return `${family}, ${given}`
  return family || given
}

/** Deshace `zoteroItemUri`: del URI se recuperan biblioteca y clave. */
function parseZoteroUri(uri) {
  const match = String(uri ?? "").match(
    /zotero\.org\/(users|groups)\/([^/]+)\/items\/([^/?#]+)/i
  )
  if (!match) return null
  return {
    mode: "web",
    libraryType: match[1].toLowerCase() === "groups" ? "group" : "user",
    libraryId: match[2],
    itemKey: match[3],
    version: 0,
  }
}

function cslItemToSource(item, uris) {
  const data = item && typeof item === "object" ? item : {}
  const authors = Array.isArray(data.author)
    ? data.author.map(cslNameToText).filter(Boolean)
    : []
  const issuedParts = data.issued?.["date-parts"]?.[0]
  const year = Array.isArray(issuedParts) ? String(issuedParts[0] ?? "") : ""
  const links = (Array.isArray(uris) ? uris : [])
    .map(parseZoteroUri)
    .filter(Boolean)
  return {
    // El identificador de Zotero es estable entre documentos; usarlo evita que
    // abrir dos veces el mismo archivo duplique todas las fuentes.
    id: links[0]
      ? `zotero-${links[0].libraryId}-${links[0].itemKey}`
      : String(data.id ?? ""),
    author: authors.join("; "),
    title: String(data.title ?? ""),
    year,
    publisher: String(data.publisher ?? data["container-title"] ?? ""),
    url: String(data.URL ?? ""),
    doi: data.DOI ? String(data.DOI) : undefined,
    isbn: data.ISBN ? String(data.ISBN) : undefined,
    itemType: ITEM_TYPE_BY_CSL_TYPE[String(data.type ?? "")] ?? "book",
    volume: data.volume ? String(data.volume) : undefined,
    issue: data.issue ? String(data.issue) : undefined,
    pages: data.page ? String(data.page) : undefined,
    edition: data.edition ? String(data.edition) : undefined,
    language: data.language ? String(data.language) : undefined,
    zoteroLinks: links,
  }
}

function extractZoteroCitations(documentXml) {
  const citations = []
  const sourcesById = new Map()
  for (const field of extractDocxComplexFields(documentXml)) {
    if (!ZOTERO_CITATION_INSTRUCTION.test(field.instruction)) continue
    const json = field.instruction.replace(ZOTERO_CITATION_INSTRUCTION, "")
    let payload = null
    try {
      payload = JSON.parse(json)
    } catch {
      // Una instrucción truncada por Word no debe impedir abrir el documento:
      // esa cita se queda como el texto que ya se ve, y las demás se recuperan.
      continue
    }
    const rawItems = Array.isArray(payload?.citationItems)
      ? payload.citationItems
      : []
    const items = []
    for (const rawItem of rawItems) {
      const source = cslItemToSource(rawItem?.itemData, rawItem?.uris)
      if (!source.id) continue
      if (!sourcesById.has(source.id)) sourcesById.set(source.id, source)
      items.push({
        sourceId: source.id,
        locator: rawItem?.locator ? String(rawItem.locator) : undefined,
        label: rawItem?.label ? String(rawItem.label) : undefined,
        prefix: rawItem?.prefix ? String(rawItem.prefix) : undefined,
        suffix: rawItem?.suffix ? String(rawItem.suffix) : undefined,
        suppressAuthor: Boolean(rawItem?.["suppress-author"]),
      })
    }
    if (items.length === 0) continue
    citations.push({
      marker: `__ETI_ZOTERO_CITE_${String(citations.length + 1).padStart(
        4,
        "0"
      )}__`,
      clusterId: String(payload?.citationID ?? `cluster-${citations.length + 1}`),
      // `noteIndex` mayor que cero significa que el estilo lleva las citas a
      // nota al pie; se conserva el modo para no cambiarle el estilo al autor.
      mode: Number(payload?.properties?.noteIndex) > 0 ? "note" : "parenthetical",
      items,
      label:
        String(payload?.properties?.plainCitation ?? "") ||
        field.cachedValue ||
        "(Referencia)",
    })
  }
  return { citations, sources: [...sourcesById.values()] }
}

/**
 * Sustituye el campo entero por una marca, para que mammoth no lo desarme y la
 * cita conserve su sitio exacto dentro del párrafo.
 */
function injectZoteroCitationMarkers(documentXml, citations) {
  if (!citations.length) return String(documentXml)
  let index = 0
  return String(documentXml).replace(COMPLEX_FIELD_PATTERN, (field) => {
    if (!ZOTERO_CITATION_INSTRUCTION.test(fieldInstructionOf(field))) {
      return field
    }
    const citation = citations[index]
    index += 1
    if (!citation) return field
    return `<w:r><w:t xml:space="preserve">${escapeXmlText(
      citation.marker
    )}</w:t></w:r>`
  })
}

function fieldInstructionOf(fieldXml) {
  return decodeXmlValue(
    [...String(fieldXml).matchAll(/<w:instrText\b[^>]*>([\s\S]*?)<\/w:instrText>/gi)]
      .map((match) => match[1])
      .join("")
  ).trim()
}

/** Devuelve las marcas al HTML como citas que el editor sabe leer. */
function restoreZoteroCitationMarkers(html, citations) {
  let restored = String(html)
  for (const citation of citations) {
    restored = restored.replaceAll(
      citation.marker,
      `<span data-citation-cluster-id="${escapeHtmlAttribute(
        citation.clusterId
      )}" data-citation-source-id="${escapeHtmlAttribute(
        citation.items[0]?.sourceId ?? ""
      )}" data-citation-items="${escapeHtmlAttribute(
        JSON.stringify(citation.items)
      )}" data-citation-mode="${escapeHtmlAttribute(
        citation.mode
      )}" data-citation-label="${escapeHtmlAttribute(
        citation.label
      )}">${escapeHtmlAttribute(citation.label)}</span>`
    )
  }
  return restored
}

function injectDocxSimpleFieldMarkers(documentXml, fields) {
  let fieldIndex = 0
  return String(documentXml).replace(
    /<w:fldSimple\b[^>]*?(?:\/>|>[\s\S]*?<\/w:fldSimple>)/gi,
    () => {
      const field = fields[fieldIndex]
      fieldIndex += 1
      if (!field) return ""
      const text = field.marker ?? field.cachedValue
      return text
        ? `<w:r><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>`
        : ""
    }
  )
}

function injectDocxComplexFieldMarkers(documentXml, fields) {
  let fieldIndex = 0
  return String(documentXml).replace(
    /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi,
    (paragraph) =>
      paragraph.replace(COMPLEX_FIELD_PATTERN, (fieldXml) => {
        const field = fields[fieldIndex]
        fieldIndex += 1
        if (!field || field.unsupportedNested) return fieldXml
        const text = field.marker ?? field.cachedValue
        return text
          ? `<w:r><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>`
          : ""
      })
  )
}

function restoreDocxFieldMarkers(html, fields) {
  let restored = String(html)
  for (const field of fields) {
    if (!field.marker || !field.referenceTarget) continue
    const text = field.cachedValue || "Referencia"
    restored = restored.replaceAll(
      field.marker,
      `<span data-reference-target="${escapeHtmlAttribute(
        field.referenceTarget
      )}" data-reference-text="${escapeHtmlAttribute(
        text
      )}">${escapeHtmlAttribute(text)}</span>`
    )
  }
  return restored
}

function injectParagraphFormats(html, paragraphFormats) {
  let paragraphIndex = 0
  return String(html).replace(
    /<(p|h[1-6]|li)\b([^>]*)>/gi,
    (openingTag, tagName, attributes) => {
      const format = paragraphFormats[paragraphIndex]
      paragraphIndex += 1
      if (!format) return openingTag
      const serialized = escapeHtmlAttribute(JSON.stringify(format))
      const nextAttributes = /\sdata-paragraph-format=/i.test(attributes)
        ? attributes.replace(
            /\sdata-paragraph-format=(?:"[^"]*"|'[^']*')/i,
            ` data-paragraph-format="${serialized}"`
          )
        : `${attributes} data-paragraph-format="${serialized}"`
      return `<${tagName}${nextAttributes}>`
    }
  )
}

const orderedXmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  trimValues: false,
})

function orderedElementName(node) {
  return Object.keys(node ?? {}).find((key) => key !== ":@")
}

function orderedLocalName(node) {
  return String(orderedElementName(node) ?? "").replace(/^.*:/, "")
}

function orderedChildren(node) {
  const name = orderedElementName(node)
  const value = name ? node[name] : undefined
  return Array.isArray(value)
    ? value.filter((child) => child && typeof child === "object")
    : []
}

function orderedText(node) {
  if (Object.hasOwn(node ?? {}, "#text")) {
    return String(node["#text"] ?? "")
  }
  return orderedChildren(node).map(orderedText).join("")
}

function directChild(node, localName) {
  return orderedChildren(node).find(
    (child) => orderedLocalName(child) === localName
  )
}

function descendantAttribute(node, localName, attributeName = "val") {
  if (orderedLocalName(node) === localName) {
    const attributes = node[":@"] ?? {}
    const key = Object.keys(attributes).find(
      (candidate) => candidate.replace(/^@_.*:/, "").replace(/^@_/, "") === attributeName
    )
    if (key) return String(attributes[key])
  }
  for (const child of orderedChildren(node)) {
    const value = descendantAttribute(child, localName, attributeName)
    if (value !== undefined) return value
  }
}

function latexDelimiter(value) {
  if (value === "{") return "\\{"
  if (value === "}") return "\\}"
  if (value === "⟨") return "\\langle"
  if (value === "⟩") return "\\rangle"
  return value
}

function ommlChildrenToLatex(node) {
  return orderedChildren(node).map(ommlNodeToLatex).join("")
}

function ommlNodeToLatex(node) {
  const name = orderedLocalName(node)
  if (name === "#text") {
    const text = orderedText(node)
    return /\S/.test(text) ? text : ""
  }
  if (name === "t") return orderedText(node)
  if (["r", "e", "num", "den", "sup", "sub", "deg"].includes(name)) {
    return ommlChildrenToLatex(node)
  }
  if (
    name.endsWith("Pr") ||
    ["ctrlPr", "rPr", "argPr", "phantPr"].includes(name)
  ) {
    return ""
  }
  if (name === "f") {
    return `\\frac{${ommlNodeToLatex(directChild(node, "num") ?? {})}}{${
      ommlNodeToLatex(directChild(node, "den") ?? {})
    }}`
  }
  if (name === "rad") {
    const degree = ommlNodeToLatex(directChild(node, "deg") ?? {})
    const body = ommlNodeToLatex(directChild(node, "e") ?? {})
    return degree ? `\\sqrt[${degree}]{${body}}` : `\\sqrt{${body}}`
  }
  if (name === "sSup") {
    return `{${ommlNodeToLatex(directChild(node, "e") ?? {})}}^{${
      ommlNodeToLatex(directChild(node, "sup") ?? {})
    }}`
  }
  if (name === "sSub") {
    return `{${ommlNodeToLatex(directChild(node, "e") ?? {})}}_{${
      ommlNodeToLatex(directChild(node, "sub") ?? {})
    }}`
  }
  if (name === "sSubSup") {
    return `{${ommlNodeToLatex(directChild(node, "e") ?? {})}}_{${
      ommlNodeToLatex(directChild(node, "sub") ?? {})
    }}^{${ommlNodeToLatex(directChild(node, "sup") ?? {})}}`
  }
  if (name === "nary") {
    const symbol = descendantAttribute(node, "chr") ?? "∑"
    const operator =
      symbol === "∑"
        ? "\\sum"
        : /^[∫∬∭∮]$/.test(symbol)
          ? "\\int"
          : symbol
    const sub = ommlNodeToLatex(directChild(node, "sub") ?? {})
    const sup = ommlNodeToLatex(directChild(node, "sup") ?? {})
    const body = ommlNodeToLatex(directChild(node, "e") ?? {})
    return `${operator}${sub ? `_{${sub}}` : ""}${
      sup ? `^{${sup}}` : ""
    }${body}`
  }
  if (name === "d") {
    const opening = latexDelimiter(
      descendantAttribute(node, "begChr") ?? "("
    )
    const closing = latexDelimiter(
      descendantAttribute(node, "endChr") ?? ")"
    )
    return `\\left${opening}${ommlNodeToLatex(
      directChild(node, "e") ?? {}
    )}\\right${closing}`
  }
  if (name === "func") {
    const functionName = ommlNodeToLatex(directChild(node, "fName") ?? {})
    const body = ommlNodeToLatex(directChild(node, "e") ?? {})
    return `\\operatorname{${functionName}}\\left(${body}\\right)`
  }
  if (name === "limLow") {
    return `${ommlNodeToLatex(directChild(node, "e") ?? {})}_{${
      ommlNodeToLatex(directChild(node, "lim") ?? {})
    }}`
  }
  if (name === "limUpp") {
    return `${ommlNodeToLatex(directChild(node, "e") ?? {})}^{${
      ommlNodeToLatex(directChild(node, "lim") ?? {})
    }}`
  }
  if (name === "acc") {
    const accent = descendantAttribute(node, "chr") ?? "̂"
    const body = ommlNodeToLatex(directChild(node, "e") ?? {})
    const command =
      accent.includes("⃗") || accent.includes("→")
        ? "vec"
        : accent.includes("¯") || accent.includes("‾")
          ? "overline"
          : "hat"
    return `\\${command}{${body}}`
  }
  if (name === "bar") {
    const body = ommlNodeToLatex(directChild(node, "e") ?? {})
    const position = descendantAttribute(node, "pos") ?? "top"
    return position === "bot"
      ? `\\underline{${body}}`
      : `\\overline{${body}}`
  }
  if (name === "m") {
    const rows = orderedChildren(node)
      .filter((child) => orderedLocalName(child) === "mr")
      .map((row) =>
        orderedChildren(row)
          .filter((child) => orderedLocalName(child) === "e")
          .map(ommlNodeToLatex)
          .join("&")
      )
      .join("\\\\")
    return `\\begin{matrix}${rows}\\end{matrix}`
  }
  if (name === "eqArr") {
    const rows = orderedChildren(node)
      .filter((child) => orderedLocalName(child) === "e")
      .map(ommlNodeToLatex)
      .join("\\\\")
    return `\\begin{aligned}${rows}\\end{aligned}`
  }
  return ommlChildrenToLatex(node)
}

function ommlToLatex(fragment) {
  try {
    const parsed = orderedXmlParser.parse(`<root>${fragment}</root>`)
    const root = parsed?.[0]
    const math = orderedChildren(root).find(
      (node) => orderedLocalName(node) === "oMath"
    )
    return (math ? ommlChildrenToLatex(math) : "").trim()
  } catch {
    return ""
  }
}

function extractOmmlEquations(documentXml) {
  const equations = []
  const paragraphs =
    String(documentXml).match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi) ?? []
  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    const mathFragments =
      paragraph.match(/<m:oMath(?:\s[^>]*)?>[\s\S]*?<\/m:oMath>/gi) ?? []
    if (mathFragments.length === 0) continue
    const latex = mathFragments
      .map(ommlToLatex)
      .filter(Boolean)
      .join("\\quad ")
    if (!latex) continue
    equations.push({
      paragraphIndex,
      marker: `__ETI_EQUATION_${String(equations.length + 1).padStart(4, "0")}__`,
      latex,
    })
  }
  return equations
}

function injectOmmlEquationMarkers(documentXml, equations) {
  const byParagraph = new Map(
    equations.map((equation) => [equation.paragraphIndex, equation])
  )
  let paragraphIndex = 0
  return String(documentXml).replace(
    /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi,
    (paragraph) => {
      const equation = byParagraph.get(paragraphIndex)
      paragraphIndex += 1
      if (!equation) return paragraph
      let inserted = false
      return paragraph.replace(
        /<m:oMath(?:\s[^>]*)?>[\s\S]*?<\/m:oMath>/gi,
        () => {
          if (inserted) return ""
          inserted = true
          return `<w:r><w:t xml:space="preserve">${equation.marker}</w:t></w:r>`
        }
      )
    }
  )
}

function restoreOmmlEquationMarkers(html, equations) {
  let restored = String(html)
  for (const equation of equations) {
    const latex = escapeHtmlAttribute(equation.latex)
    restored = restored.replaceAll(
      equation.marker,
      `<span data-imported-equation="true" data-equation-latex="${latex}">${latex}</span>`
    )
  }
  return restored
}

const TEXT_BOX_PARAGRAPH_PATTERN =
  /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:pict\b[^>]*>[\s\S]*?<v:textbox\b[^>]*>[\s\S]*?<\/v:textbox>[\s\S]*?<\/w:pict>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/gi

function vmlLengthToPixels(value, fallback) {
  const number = Number.parseFloat(String(value ?? ""))
  if (!Number.isFinite(number)) return fallback
  const unit = String(value).trim().toLowerCase()
  if (unit.endsWith("in")) return number * 96
  if (unit.endsWith("cm")) return (number * 96) / 2.54
  if (unit.endsWith("mm")) return (number * 96) / 25.4
  if (unit.endsWith("pt")) return (number * 96) / 72
  return number
}

function vmlStyleMap(value) {
  return Object.fromEntries(
    decodeXmlValue(value)
      .split(";")
      .map((part) => part.split(":"))
      .filter((parts) => parts.length >= 2 && parts[0].trim())
      .map(([key, ...rest]) => [
        key.trim().toLowerCase(),
        rest.join(":").trim(),
      ])
  )
}

function textFromWordXml(xml) {
  return [
    ...String(xml).matchAll(
      /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:(?:br|cr)\b[^>]*\/?>/gi
    ),
  ]
    .map((match) =>
      match[1] !== undefined
        ? decodeXmlValue(match[1])
        : /^<w:tab/i.test(match[0])
          ? "\t"
          : "\n"
    )
    .join("")
}

function extractDocxTextBoxes(documentXml) {
  const boxes = []
  for (const paragraph of String(documentXml).matchAll(
    TEXT_BOX_PARAGRAPH_PATTERN
  )) {
    const xml = paragraph[0]
    const shape = xml.match(/<v:shape\b([^>]*)>/i)
    const shapeAttributes = shape?.[1] ?? ""
    const rawStyle =
      shapeAttributes.match(/\bstyle=(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
      shapeAttributes.match(/\bstyle=(?:"([^"]*)"|'([^']*)')/i)?.[2] ??
      ""
    const style = vmlStyleMap(rawStyle)
    const content =
      xml.match(
        /<w:txbxContent\b[^>]*>([\s\S]*?)<\/w:txbxContent>/i
      )?.[1] ?? ""
    const paragraphs =
      content.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gi) ?? []
    const text = (
      paragraphs.length > 0
        ? paragraphs.map(textFromWordXml)
        : [textFromWordXml(content)]
    ).join("\n\n")
    const horizontal = String(
      style["mso-position-horizontal"] ?? ""
    ).toLowerCase()
    const floating = style["mso-wrap-style"] === "square"
    const position =
      floating && horizontal === "left"
        ? "float-left"
        : floating && horizontal === "right"
          ? "float-right"
          : "inline"
    const align =
      horizontal === "left" || horizontal === "right"
        ? horizontal
        : /<w:jc\b[^>]*\bw:val=(?:"right"|'right')/i.test(xml)
          ? "right"
          : /<w:jc\b[^>]*\bw:val=(?:"left"|'left')/i.test(xml)
            ? "left"
            : "center"
    const shapeFill =
      shapeAttributes.match(/\bfillcolor=(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
      shapeAttributes.match(/\bfillcolor=(?:"([^"]*)"|'([^']*)')/i)?.[2]
    const shapeStroke =
      shapeAttributes.match(/\bstrokecolor=(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
      shapeAttributes.match(/\bstrokecolor=(?:"([^"]*)"|'([^']*)')/i)?.[2]
    const semantic =
      shapeAttributes.match(/\balt=(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
      shapeAttributes.match(/\balt=(?:"([^"]*)"|'([^']*)')/i)?.[2] ??
      ""
    const semanticParts = decodeXmlValue(semantic).split("|")
    const editorMetadata =
      semanticParts[0] === "ETITextBox" ? semanticParts : []
    const metadataBackground = editorMetadata[1]
    const metadataBorderColor = editorMetadata[2]
    const metadataBorderStyle = editorMetadata[3]
    const metadataPadding = Number(editorMetadata[4])
    boxes.push({
      marker: `__ETI_TEXT_BOX_${String(boxes.length + 1).padStart(
        4,
        "0"
      )}__`,
      text,
      width: Math.min(
        720,
        Math.max(160, Math.round(vmlLengthToPixels(style.width, 360)))
      ),
      minHeight: Math.min(
        600,
        Math.max(48, Math.round(vmlLengthToPixels(style.height, 96)))
      ),
      align,
      position,
      background:
        metadataBackground && /^#[0-9a-f]{6}$/i.test(metadataBackground)
          ? metadataBackground.toLowerCase()
          : shapeFill && /^#[0-9a-f]{6}$/i.test(shapeFill)
            ? shapeFill.toLowerCase()
          : "#f8fafc",
      borderColor:
        metadataBorderColor && /^#[0-9a-f]{6}$/i.test(metadataBorderColor)
          ? metadataBorderColor.toLowerCase()
          : shapeStroke && /^#[0-9a-f]{6}$/i.test(shapeStroke)
            ? shapeStroke.toLowerCase()
          : "#94a3b8",
      borderStyle:
        ["none", "solid", "dashed", "double"].includes(
          metadataBorderStyle
        )
          ? metadataBorderStyle
          : /\bstroked=(?:"f"|'f'|"false"|'false')/i.test(
                shapeAttributes
              )
            ? "none"
            : /<v:stroke\b[^>]*\bdashstyle=/i.test(xml)
              ? "dashed"
              : "solid",
      padding: Number.isFinite(metadataPadding)
        ? Math.min(48, Math.max(4, Math.round(metadataPadding)))
        : 16,
    })
  }
  return boxes
}

function injectDocxTextBoxMarkers(documentXml, boxes) {
  let index = 0
  return String(documentXml).replace(
    TEXT_BOX_PARAGRAPH_PATTERN,
    (paragraph) => {
      const box = boxes[index]
      index += 1
      if (!box) return paragraph
      return `<w:p><w:r><w:t xml:space="preserve">${escapeXmlText(
        box.marker
      )}</w:t></w:r></w:p>`
    }
  )
}

function restoreDocxTextBoxMarkers(html, boxes) {
  let restored = String(html)
  for (const box of boxes) {
    const content = String(box.text || "")
      .split(/\n{2,}/)
      .map(
        (paragraph) =>
          `<p>${escapeHtmlAttribute(paragraph).replaceAll(
            "\n",
            "<br>"
          )}</p>`
      )
      .join("")
    const element = `<div data-text-box="true" data-text-box-width="${box.width}" data-text-box-height="${box.minHeight}" data-text-box-align="${box.align}" data-text-box-position="${box.position}" data-text-box-background="${box.background}" data-text-box-border-color="${box.borderColor}" data-text-box-border-style="${box.borderStyle}" data-text-box-padding="${box.padding}">${content || "<p></p>"}</div>`
    const paragraphPattern = new RegExp(
      `<p(?:\\s[^>]*)?>\\s*${box.marker}\\s*</p>`,
      "g"
    )
    restored = restored.replace(paragraphPattern, element)
    restored = restored.replaceAll(box.marker, element)
  }
  return restored
}

/**
 * Control de cambios de Word.
 *
 * Mammoth no sabe nada de revisiones: da por aceptadas las inserciones y tira
 * las eliminaciones, porque el texto borrado viaja en `<w:delText>` y no en
 * `<w:t>`. Al abrir el DOCX que devuelve un coautor revisado, sus cambios
 * desaparecían y solo quedaba un aviso diciendo cuántos había.
 *
 * Se resuelve igual que las ecuaciones y los cuadros de texto: antes de pasar
 * el archivo por mammoth se sustituye cada revisión por una marca de texto
 * plano, y en el HTML resultante se vuelve a convertir en `<ins>` o `<del>`,
 * que es lo que reconocen las marcas del editor.
 */
const REVISION_PATTERN = /<w:(ins|del)\b([^>]*)>([\s\S]*?)<\/w:\1>/gi

/**
 * Igual que `textFromWordXml`, pero también lee `<w:delText>`, que es donde
 * Word guarda el texto que alguien borró con el control de cambios activo.
 */
function revisionTextFromWordXml(xml) {
  return [
    ...String(xml).matchAll(
      /<w:(?:t|delText)\b[^>]*>([\s\S]*?)<\/w:(?:t|delText)>|<w:tab\b[^>]*\/?>|<w:(?:br|cr)\b[^>]*\/?>/gi
    ),
  ]
    .map((match) =>
      match[1] !== undefined
        ? decodeXmlValue(match[1])
        : /^<w:tab/i.test(match[0])
          ? "\t"
          : "\n"
    )
    .join("")
}

function extractDocxRevisions(documentXml) {
  const revisions = []
  for (const match of String(documentXml).matchAll(REVISION_PATTERN)) {
    const type = match[1].toLowerCase() === "ins" ? "insertion" : "deletion"
    const attributes = match[2] ?? ""
    const body = match[3] ?? ""
    const text = revisionTextFromWordXml(body)
    // Una revisión sin texto solo marca un cambio de formato o de fin de
    // párrafo; no hay nada que enseñar y convertirla en marca solo ensuciaría
    // el documento.
    if (!text) continue
    const author =
      attributes.match(/\bw:author=(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
      attributes.match(/\bw:author=(?:"([^"]*)"|'([^']*)')/i)?.[2] ??
      "Autor"
    const date =
      attributes.match(/\bw:date=(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
      attributes.match(/\bw:date=(?:"([^"]*)"|'([^']*)')/i)?.[2] ??
      ""
    const ordinal = String(revisions.length + 1).padStart(4, "0")
    revisions.push({
      // La marca solo vive dentro del XML de camino a mammoth; el documento
      // final lleva el identificador limpio, que es el que verá el panel de
      // revisión y el que volverá al DOCX al exportar.
      marker: `__ETI_REVISION_${ordinal}__`,
      revisionId: `docx-revision-${ordinal}`,
      type,
      author: decodeXmlValue(author),
      date: decodeXmlValue(date),
      text,
    })
  }
  return revisions
}

function injectDocxRevisionMarkers(documentXml, revisions) {
  let index = 0
  return String(documentXml).replace(REVISION_PATTERN, (original, _tag, _attributes, body) => {
    if (!revisionTextFromWordXml(body ?? "")) return original
    const revision = revisions[index]
    index += 1
    if (!revision) return original
    return `<w:r><w:t xml:space="preserve">${escapeXmlText(
      revision.marker
    )}</w:t></w:r>`
  })
}

function restoreDocxRevisionMarkers(html, revisions) {
  let restored = String(html)
  for (const revision of revisions) {
    const tag = revision.type === "insertion" ? "ins" : "del"
    const element =
      `<${tag} data-revision-id="${escapeHtmlAttribute(revision.revisionId)}"` +
      ` data-author="${escapeHtmlAttribute(revision.author)}"` +
      ` data-date="${escapeHtmlAttribute(revision.date)}">` +
      `${escapeHtmlAttribute(revision.text).replaceAll("\n", "<br>")}` +
      `</${tag}>`
    restored = restored.replaceAll(revision.marker, element)
  }
  return restored
}

module.exports = {
  extractZoteroCitations,
  injectZoteroCitationMarkers,
  restoreZoteroCitationMarkers,
  extractDocxComplexFields,
  extractDocxRevisions,
  extractDocxSimpleFields,
  extractOmmlEquations,
  extractParagraphFormats,
  extractDocxTextBoxes,
  injectDocxComplexFieldMarkers,
  injectDocxRevisionMarkers,
  injectDocxSimpleFieldMarkers,
  injectOmmlEquationMarkers,
  injectParagraphFormats,
  injectDocxTextBoxMarkers,
  inspectPageNumberField,
  parseLineNumberSettings,
  restoreDocxFieldMarkers,
  restoreDocxRevisionMarkers,
  restoreOmmlEquationMarkers,
  restoreDocxTextBoxMarkers,
}
