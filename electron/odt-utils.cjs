const JSZip = require("jszip")
const { XMLParser } = require("fast-xml-parser")

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  trimValues: false,
  processEntities: true,
})

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function nodeTag(node) {
  if (!node || typeof node !== "object") return ""
  return Object.keys(node).find((key) => key !== ":@") || ""
}

function nodeChildren(node) {
  const tag = nodeTag(node)
  return tag && Array.isArray(node[tag]) ? node[tag] : []
}

function nodeAttributes(node) {
  return node?.[":@"] || {}
}

function walk(nodes, visitor) {
  for (const node of nodes || []) {
    visitor(node)
    walk(nodeChildren(node), visitor)
  }
}

function findFirst(nodes, tagName) {
  let match
  walk(nodes, (node) => {
    if (!match && nodeTag(node) === tagName) match = node
  })
  return match
}

function plainText(nodes) {
  return (nodes || [])
    .map((node) => {
      const tag = nodeTag(node)
      if (tag === "#text") return String(node[tag] ?? "")
      if (tag === "text:s") {
        return " ".repeat(
          Math.max(1, Number(nodeAttributes(node)["text:c"]) || 1)
        )
      }
      if (tag === "text:tab") return "\t"
      if (tag === "text:line-break") return "\n"
      return plainText(nodeChildren(node))
    })
    .join("")
}

function lengthToPoints(value, fallback = 0) {
  if (typeof value !== "string") return fallback
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return fallback
  if (value.endsWith("cm")) return (number * 72) / 2.54
  if (value.endsWith("mm")) return (number * 72) / 25.4
  if (value.endsWith("in")) return number * 72
  if (value.endsWith("pc")) return number * 12
  if (value.endsWith("px")) return number * 0.75
  return number
}

function pointsToPixels(points) {
  return (points * 96) / 72
}

function childByTag(node, tagName) {
  return nodeChildren(node).find((child) => nodeTag(child) === tagName)
}

function collectStyles(...documents) {
  const styles = new Map()
  const listStyles = new Map()
  for (const document of documents) {
    walk(document, (node) => {
      const tag = nodeTag(node)
      if (tag === "style:style" || tag === "style:default-style") {
        const attrs = nodeAttributes(node)
        const family = attrs["style:family"] || "paragraph"
        const name =
          tag === "style:default-style"
            ? `__default:${family}`
            : attrs["style:name"]
        if (!name) return
        const paragraphNode = childByTag(node, "style:paragraph-properties")
        const textNode = childByTag(node, "style:text-properties")
        const graphicNode = childByTag(node, "style:graphic-properties")
        const tabStopsNode = paragraphNode
          ? childByTag(paragraphNode, "style:tab-stops")
          : null
        const tabStops = tabStopsNode
          ? nodeChildren(tabStopsNode)
              .filter((child) => nodeTag(child) === "style:tab-stop")
              .map((child) =>
                lengthToPoints(
                  nodeAttributes(child)["style:position"],
                  Number.NaN
                )
              )
              .filter(Number.isFinite)
          : []
        styles.set(name, {
          name,
          displayName:
            attrs["style:display-name"] ||
            (tag === "style:default-style" ? "" : name),
          family,
          parent: attrs["style:parent-style-name"],
          paragraph: paragraphNode ? nodeAttributes(paragraphNode) : {},
          text: textNode ? nodeAttributes(textNode) : {},
          graphic: graphicNode ? nodeAttributes(graphicNode) : {},
          tabStops,
        })
      } else if (tag === "text:list-style") {
        const attrs = nodeAttributes(node)
        const name = attrs["style:name"]
        if (!name) return
        let ordered = false
        walk(nodeChildren(node), (child) => {
          if (nodeTag(child) === "text:list-level-style-number") ordered = true
        })
        listStyles.set(name, ordered ? "ol" : "ul")
      }
    })
  }
  for (const style of styles.values()) {
    if (
      !style.parent &&
      !style.name.startsWith("__default:") &&
      styles.has(`__default:${style.family}`)
    ) {
      style.parent = `__default:${style.family}`
    }
  }
  return { styles, listStyles }
}

function resolveStyle(name, styles, seen = new Set()) {
  if (!name || seen.has(name)) return null
  const style = styles.get(name)
  if (!style) return null
  seen.add(name)
  const parent = resolveStyle(style.parent, styles, seen)
  return {
    ...style,
    paragraph: { ...(parent?.paragraph || {}), ...style.paragraph },
    text: { ...(parent?.text || {}), ...style.text },
    graphic: { ...(parent?.graphic || {}), ...(style.graphic || {}) },
    tabStops: style.tabStops.length ? style.tabStops : parent?.tabStops || [],
  }
}

function textCss(properties) {
  const css = []
  if (properties["fo:font-weight"] === "bold") css.push("font-weight:bold")
  if (properties["fo:font-style"] === "italic") css.push("font-style:italic")
  if (
    properties["style:text-underline-style"] &&
    properties["style:text-underline-style"] !== "none"
  ) {
    css.push("text-decoration-line:underline")
  }
  if (
    properties["style:text-line-through-style"] &&
    properties["style:text-line-through-style"] !== "none"
  ) {
    css.push("text-decoration-line:line-through")
  }
  if (properties["fo:color"]) css.push(`color:${properties["fo:color"]}`)
  if (properties["fo:background-color"]) {
    css.push(`background-color:${properties["fo:background-color"]}`)
  }
  if (properties["fo:font-size"]) {
    css.push(`font-size:${properties["fo:font-size"]}`)
  }
  if (properties["style:font-name"]) {
    css.push(`font-family:${properties["style:font-name"]}`)
  }
  if (String(properties["style:text-position"] || "").startsWith("super")) {
    css.push("vertical-align:super", "font-size:smaller")
  }
  if (String(properties["style:text-position"] || "").startsWith("sub")) {
    css.push("vertical-align:sub", "font-size:smaller")
  }
  return css
}

function paragraphAttributes(styleName, styleMap) {
  const style = resolveStyle(styleName, styleMap.styles)
  if (!style) return { html: "", tabStops: [] }
  const properties = style.paragraph
  const format = {
    leftIndent: lengthToPoints(properties["fo:margin-left"]),
    rightIndent: lengthToPoints(properties["fo:margin-right"]),
    firstLineIndent: lengthToPoints(properties["fo:text-indent"]),
    tabStops: style.tabStops,
    spacingBefore: lengthToPoints(properties["fo:margin-top"]),
    spacingAfter: lengthToPoints(properties["fo:margin-bottom"], 8),
    keepWithNext: properties["fo:keep-with-next"] === "always",
    keepLinesTogether: properties["fo:keep-together"] === "always",
    widowOrphanControl:
      Number(properties["fo:widows"] || 2) > 1 ||
      Number(properties["fo:orphans"] || 2) > 1,
    pageBreakBefore: properties["fo:break-before"] === "page",
    suppressLineNumbers: false,
  }
  const css = [
    properties["fo:text-align"]
      ? `text-align:${properties["fo:text-align"]}`
      : "",
    properties["fo:line-height"]
      ? `line-height:${properties["fo:line-height"]}`
      : "",
    ...textCss(style.text),
  ].filter(Boolean)
  const displayName = String(style.displayName || "")
  const normalizedName = displayName.replace(/\s+/g, "").toLowerCase()
  const knownId =
    normalizedName === "title"
      ? "Title"
      : normalizedName === "subtitle"
        ? "Subtitle"
        : normalizedName === "normal" || normalizedName === "standard"
          ? "Normal"
          : /^heading[1-6]$/.test(normalizedName)
            ? `Heading${normalizedName.at(-1)}`
            : null
  const language = style.text["fo:language"]
    ? `${style.text["fo:language"]}${
        style.text["fo:country"] ? `-${style.text["fo:country"]}` : ""
      }`
    : ""
  return {
    tabStops: style.tabStops,
    html: [
      `data-paragraph-format="${escapeHtml(JSON.stringify(format))}"`,
      `data-word-style-name="${escapeHtml(displayName)}"`,
      knownId ? `data-word-style="${knownId}"` : "",
      css.length ? `style="${escapeHtml(css.join(";"))}"` : "",
      language ? `lang="${escapeHtml(language)}"` : "",
    ]
      .filter(Boolean)
      .join(" "),
  }
}

function renderInline(nodes, context) {
  return (nodes || [])
    .map((node) => {
      const tag = nodeTag(node)
      const attrs = nodeAttributes(node)
      const children = nodeChildren(node)
      if (tag === "#text") return escapeHtml(node[tag])
      if (tag === "text:s") {
        return " ".repeat(Math.max(1, Number(attrs["text:c"]) || 1))
      }
      if (tag === "text:line-break") return "<br>"
      if (tag === "text:tab") {
        const fallback = Math.max(36, (context.tabIndex + 1) * 36)
        const stop =
          context.tabStops.find((position) => position > context.lastTabStop) ||
          fallback
        context.tabIndex += 1
        context.lastTabStop = stop
        return `<span data-tab-stop="${Math.round(stop * 2) / 2}"></span>`
      }
      if (tag === "text:span") {
        const style = resolveStyle(attrs["text:style-name"], context.styles)
        const css = style ? textCss(style.text) : []
        const language = style?.text["fo:language"]
          ? `${style.text["fo:language"]}${
              style.text["fo:country"] ? `-${style.text["fo:country"]}` : ""
            }`
          : ""
        return `<span${css.length ? ` style="${escapeHtml(css.join(";"))}"` : ""}${
          language ? ` lang="${escapeHtml(language)}"` : ""
        }>${renderInline(children, context)}</span>`
      }
      if (tag === "text:a") {
        const href = attrs["xlink:href"] || ""
        return `<a href="${escapeHtml(href)}">${renderInline(
          children,
          context
        )}</a>`
      }
      if (tag === "text:note") {
        const body = findFirst(children, "text:note-body")
        const citation = findFirst(children, "text:note-citation")
        const label = plainText(nodeChildren(citation)) || "nota"
        const noteText = plainText(nodeChildren(body)).trim()
        return `<sup title="${escapeHtml(noteText)}">[${escapeHtml(label)}]</sup>`
      }
      if (tag === "draw:frame") return renderFrame(node, context)
      if (tag === "text:bookmark-start") {
        const name = attrs["text:name"] || ""
        return `<span data-bookmark-id="${escapeHtml(
          name
        )}" data-bookmark-name="${escapeHtml(name)}">`
      }
      if (tag === "text:bookmark-end") {
        return "</span>"
      }
      return renderInline(children, context)
    })
    .join("")
}

function renderFrame(node, context) {
  const attrs = nodeAttributes(node)
  const textBoxNode = findFirst(nodeChildren(node), "draw:text-box")
  if (textBoxNode) {
    const style = resolveStyle(
      attrs["draw:style-name"],
      context.styleMap.styles
    )
    const graphic = style?.graphic || {}
    const nameParts = String(attrs["draw:name"] || "").split("|")
    const position =
      nameParts[0] === "ETITextBox" &&
      (nameParts[1] === "float-left" || nameParts[1] === "float-right")
        ? nameParts[1]
        : "inline"
    const align =
      nameParts[0] === "ETITextBox" &&
      (nameParts[2] === "left" || nameParts[2] === "right")
        ? nameParts[2]
        : "center"
    const borderStyle =
      nameParts[0] === "ETITextBox" &&
      ["none", "solid", "dashed", "double"].includes(nameParts[3])
        ? nameParts[3]
        : graphic["draw:stroke"] === "none"
          ? "none"
          : graphic["draw:stroke"] === "dash"
            ? "dashed"
            : "solid"
    const width = Math.round(
      pointsToPixels(lengthToPoints(attrs["svg:width"], 270))
    )
    const minHeight = Math.round(
      pointsToPixels(lengthToPoints(attrs["svg:height"], 72))
    )
    const padding = Math.round(
      pointsToPixels(lengthToPoints(graphic["fo:padding"], 12))
    )
    const background = /^#[0-9a-f]{6}$/i.test(
      graphic["draw:fill-color"] || ""
    )
      ? graphic["draw:fill-color"]
      : "#f8fafc"
    const borderColor = /^#[0-9a-f]{6}$/i.test(
      graphic["svg:stroke-color"] || ""
    )
      ? graphic["svg:stroke-color"]
      : "#94a3b8"
    return `<div data-text-box="true" data-text-box-width="${Math.min(
      720,
      Math.max(160, width)
    )}" data-text-box-height="${Math.min(
      600,
      Math.max(48, minHeight)
    )}" data-text-box-align="${align}" data-text-box-position="${position}" data-text-box-background="${escapeHtml(
      background
    )}" data-text-box-border-color="${escapeHtml(
      borderColor
    )}" data-text-box-border-style="${borderStyle}" data-text-box-padding="${Math.min(
      48,
      Math.max(4, padding)
    )}">${renderBlocks(nodeChildren(textBoxNode), context)}</div>`
  }
  const imageNode = findFirst(nodeChildren(node), "draw:image")
  if (!imageNode) return ""
  const href = nodeAttributes(imageNode)["xlink:href"] || ""
  const src = context.images.get(href.replace(/^\.\//, ""))
  if (!src) return ""
  const titleNode = findFirst(nodeChildren(node), "svg:title")
  const alt = titleNode ? plainText(nodeChildren(titleNode)).trim() : ""
  const width = Math.max(
    24,
    pointsToPixels(lengthToPoints(attrs["svg:width"], 300))
  )
  const height = Math.max(
    18,
    pointsToPixels(lengthToPoints(attrs["svg:height"], width * 0.75))
  )
  return `<img src="${src}" alt="${escapeHtml(alt)}" width="${Math.round(
    width
  )}" height="${Math.round(height)}">`
}

function renderBlocks(nodes, context, tableHeader = false) {
  return (nodes || [])
    .map((node) => {
      const tag = nodeTag(node)
      const attrs = nodeAttributes(node)
      const children = nodeChildren(node)
      if (tag === "text:p" || tag === "text:h") {
        const textBoxFrame = children.find(
          (child) =>
            nodeTag(child) === "draw:frame" &&
            findFirst(nodeChildren(child), "draw:text-box")
        )
        if (textBoxFrame) return renderFrame(textBoxFrame, context)
        const style = paragraphAttributes(
          attrs["text:style-name"],
          context.styleMap
        )
        const inlineContext = {
          ...context,
          tabStops: style.tabStops,
          tabIndex: 0,
          lastTabStop: 0,
        }
        const level = Math.min(
          6,
          Math.max(1, Number(attrs["text:outline-level"]) || 1)
        )
        const element = tag === "text:h" ? `h${level}` : "p"
        return `<${element}${style.html ? ` ${style.html}` : ""}>${renderInline(
          children,
          inlineContext
        )}</${element}>`
      }
      if (tag === "text:list") {
        const element =
          context.styleMap.listStyles.get(attrs["text:style-name"]) || "ul"
        return `<${element}>${children
          .filter((child) => nodeTag(child) === "text:list-item")
          .map(
            (item) =>
              `<li>${renderBlocks(nodeChildren(item), context)}</li>`
          )
          .join("")}</${element}>`
      }
      if (tag === "table:table") {
        const tableName = attrs["table:name"] || ""
        const styleMatch = tableName.match(
          /^ETI-(plain|grid|header|banded|academic)$/
        )
        return `<table${
          styleMatch ? ` data-table-style="${styleMatch[1]}"` : ""
        }><tbody>${renderBlocks(children, context)}</tbody></table>`
      }
      if (tag === "table:table-header-rows") {
        return renderBlocks(children, context, true)
      }
      if (tag === "table:table-row") {
        return `<tr>${renderBlocks(children, context, tableHeader)}</tr>`
      }
      if (tag === "table:table-cell") {
        const element = tableHeader ? "th" : "td"
        const colspan = Number(attrs["table:number-columns-spanned"]) || 1
        const rowspan = Number(attrs["table:number-rows-spanned"]) || 1
        const formulaMatch = String(attrs["table:formula"] || "").match(
          /^(?:of:)?=(SUM|AVERAGE|COUNT|MIN|MAX)\(\[\.([A-Z]+)\d+:\.([A-Z]+)\d+\]\)$/
        )
        const formula = formulaMatch
          ? `${formulaMatch[1]}(${
              formulaMatch[2] === formulaMatch[3] ? "ABOVE" : "LEFT"
            })`
          : ""
        return `<${element}${colspan > 1 ? ` colspan="${colspan}"` : ""}${
          rowspan > 1 ? ` rowspan="${rowspan}"` : ""
        }${
          formula ? ` data-table-formula="${formula}"` : ""
        }>${renderBlocks(children, context)}</${element}>`
      }
      if (tag === "text:soft-page-break") {
        return '<div data-page-break="true" data-label="Salto de página"></div>'
      }
      if (tag === "draw:frame") {
        const frame = renderFrame(node, context)
        return frame ? `<p>${frame}</p>` : ""
      }
      if (
        tag === "office:text" ||
        tag === "office:body" ||
        tag === "text:section"
      ) {
        return renderBlocks(children, context)
      }
      return ""
    })
    .join("")
}

function extractWorkspace(stylesDocument, styleMap) {
  const pageProperties = findFirst(
    stylesDocument,
    "style:page-layout-properties"
  )
  const attrs = pageProperties ? nodeAttributes(pageProperties) : {}
  const widthPoints = lengthToPoints(attrs["fo:page-width"], 595)
  const heightPoints = lengthToPoints(attrs["fo:page-height"], 842)
  const orientation =
    attrs["style:print-orientation"] === "landscape" ||
    widthPoints > heightPoints
      ? "landscape"
      : "portrait"
  const shortSide = Math.min(widthPoints, heightPoints)
  const pageSize = Math.abs(shortSide - 612) < 10 ? "letter" : "a4"
  const genericMargin = pointsToPixels(
    lengthToPoints(attrs["fo:margin"], 72)
  )
  const margin = (name) =>
    attrs[name]
      ? pointsToPixels(lengthToPoints(attrs[name], 72))
      : genericMargin
  const margins = {
    top: margin("fo:margin-top"),
    right: margin("fo:margin-right"),
    bottom: margin("fo:margin-bottom"),
    left: margin("fo:margin-left"),
    header: 36,
    footer: 36,
  }
  const layout = {
    pageSize,
    orientation,
    margin: margins.top,
    margins,
    columns: 1,
    columnGap: 24,
    zoom: 1,
    showRuler: true,
    showFormattingMarks: false,
    lineNumbers: { mode: "none", start: 1, countBy: 1, distance: 24 },
  }
  const headerNode = findFirst(stylesDocument, "style:header")
  const footerNode = findFirst(stylesDocument, "style:footer")
  let proofingLanguage = "es-ES"
  for (const style of styleMap.styles.values()) {
    if (style.text["fo:language"]) {
      proofingLanguage = `${style.text["fo:language"]}${
        style.text["fo:country"] ? `-${style.text["fo:country"]}` : ""
      }`
      break
    }
  }
  return {
    proofingLanguage,
    layout,
    sections: [
      {
        id: "section-default",
        name: "Sección 1",
        breakType: "nextPage",
        layout,
        header: {
          default: headerNode
            ? plainText(nodeChildren(headerNode)).trim()
            : "",
          first: "",
          even: "",
        },
        footer: {
          default: footerNode
            ? plainText(nodeChildren(footerNode)).trim()
            : "",
          first: "",
          even: "",
        },
        differentFirstPage: false,
        differentOddEven: false,
        pageNumberPosition: "footer-center",
        pageNumberFormat: "decimal",
      },
    ],
  }
}

function mediaTypeForPath(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".svg")) return "image/svg+xml"
  return "image/png"
}

async function extractOdtDocument(bytes) {
  const zip = await JSZip.loadAsync(bytes)
  const contentFile = zip.file("content.xml")
  if (!contentFile) throw new Error("El archivo ODT no contiene content.xml")
  const contentXml = await contentFile.async("string")
  const stylesXml = zip.file("styles.xml")
    ? await zip.file("styles.xml").async("string")
    : ""
  const contentDocument = parser.parse(contentXml)
  const stylesDocument = stylesXml ? parser.parse(stylesXml) : []
  const styleMap = collectStyles(stylesDocument, contentDocument)
  const images = new Map()
  const imageEntries = Object.values(zip.files).filter(
    (entry) =>
      !entry.dir &&
      /\.(?:png|jpe?g|gif|webp|svg)$/i.test(entry.name)
  )
  await Promise.all(
    imageEntries.map(async (entry) => {
      const base64 = await entry.async("base64")
      images.set(
        entry.name.replace(/^\.\//, ""),
        `data:${mediaTypeForPath(entry.name)};base64,${base64}`
      )
    })
  )
  const officeText = findFirst(contentDocument, "office:text")
  const html = officeText
    ? renderBlocks(nodeChildren(officeText), {
        styleMap,
        styles: styleMap.styles,
        images,
      })
    : ""
  const warnings = []
  if (contentXml.includes("<text:tracked-changes")) {
    warnings.push(
      "El ODT contiene control de cambios; el texto visible se ha importado, pero algunas decisiones pendientes pueden requerir revisión en LibreOffice."
    )
  }
  if (contentXml.includes("<office:annotation")) {
    warnings.push(
      "El ODT contiene comentarios; su texto se conserva cuando forma parte del contenido, pero los hilos no siempre son portables."
    )
  }
  if (
    contentXml.includes("<draw:custom-shape") ||
    contentXml.includes("<chart:chart")
  ) {
    warnings.push(
      "Algunas formas o gráficos de LibreOffice se han simplificado durante la importación."
    )
  }
  return {
    html: html || "<p></p>",
    documentJson: JSON.stringify(extractWorkspace(stylesDocument, styleMap)),
    warnings,
  }
}

module.exports = {
  extractOdtDocument,
  lengthToPoints,
}
