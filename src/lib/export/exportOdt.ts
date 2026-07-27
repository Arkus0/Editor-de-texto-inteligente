import JSZip from "jszip"

import type { BlockNode, TextRun } from "./document-ast"
import { downloadBlob } from "./download"
import type {
  DocumentStyleDefinition,
  DocumentWorkspaceState,
} from "@/types/document"

const ODT_MIME = "application/vnd.oasis.opendocument.text"

interface OdtImage {
  path: string
  mediaType: string
  bytes: Uint8Array
}

interface OdtRenderContext {
  paragraphStyles: Map<string, string>
  textStyles: Map<string, string>
  tableCellStyles: Map<string, string>
  textBoxStyles: Map<string, string>
  automaticStyles: string[]
  images: OdtImage[]
  namedStyles: DocumentStyleDefinition[]
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function xmlText(value: string) {
  return value
    .split(/([ \t\n]+)/)
    .filter(Boolean)
    .map((part) => {
      if (part === "\t") return "<text:tab/>"
      if (part === "\n") return "<text:line-break/>"
      if (/^ +$/.test(part)) {
        return part.length === 1
          ? " "
          : `<text:s text:c="${part.length}"/>`
      }
      if (/^[\t\n]+$/.test(part)) {
        return [...part]
          .map((character) =>
            character === "\t" ? "<text:tab/>" : "<text:line-break/>"
          )
          .join("")
      }
      return escapeXml(part)
    })
    .join("")
}

function lengthValue(value: number, unit: "pt" | "cm") {
  return `${Math.max(0, Math.round(value * 100) / 100)}${unit}`
}

function tableCellStyle(
  context: OdtRenderContext,
  tableStyle: "plain" | "grid" | "header" | "banded" | "academic",
  rowIndex: number,
  header: boolean
) {
  const signature = `${tableStyle}:${rowIndex % 2}:${header}`
  const existing = context.tableCellStyles.get(signature)
  if (existing) return existing
  const name = `TC${context.tableCellStyles.size + 1}`
  const border =
    tableStyle === "plain"
      ? 'fo:border="none"'
      : tableStyle === "academic"
        ? `fo:border-left="none" fo:border-right="none" fo:border-top="none" fo:border-bottom="${
            header || rowIndex === 0 ? "1.5pt" : "0.5pt"
          } solid #6b7280"`
        : 'fo:border="0.5pt solid #d1d5db"'
  const background =
    tableStyle === "header" && (header || rowIndex === 0)
      ? ' fo:background-color="#d9eaf7"'
      : tableStyle === "banded" && rowIndex % 2 === 1
        ? ' fo:background-color="#f3f4f6"'
        : header && tableStyle !== "plain"
          ? ' fo:background-color="#eeeeee"'
          : ""
  context.automaticStyles.push(
    `<style:style style:name="${name}" style:family="table-cell"><style:table-cell-properties ${border}${background}/></style:style>`
  )
  context.tableCellStyles.set(signature, name)
  return name
}

function spreadsheetColumnName(index: number) {
  let value = index + 1
  let result = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function odtTableFormula(
  formula: string | undefined,
  rowIndex: number,
  columnIndex: number
) {
  const match = formula?.match(
    /^(SUM|AVERAGE|COUNT|MIN|MAX)\((ABOVE|LEFT)\)$/
  )
  if (!match) return ""
  const [, operation, direction] = match
  const currentRow = rowIndex + 1
  const currentColumn = spreadsheetColumnName(columnIndex)
  const range =
    direction === "ABOVE" && rowIndex > 0
      ? `.${currentColumn}1:.${currentColumn}${rowIndex}`
      : direction === "LEFT" && columnIndex > 0
        ? `.A${currentRow}:${spreadsheetColumnName(
            columnIndex - 1
          )}${currentRow}`
        : ""
  return range ? `of:=${operation}([${range}])` : ""
}

function tableCellValue(cell: {
  content: BlockNode[]
}) {
  const display = cell.content
    .map((block) =>
      block.type === "paragraph" || block.type === "heading"
        ? block.runs.map((run) => run.text).join("")
        : ""
    )
    .join(" ")
    .trim()
  const normalized = display
    .replace(/\s/g, "")
    .replace(/[%\u20ac$\u00a3\u00a5]/g, "")
  const lastComma = normalized.lastIndexOf(",")
  const lastPeriod = normalized.lastIndexOf(".")
  const decimal =
    lastComma >= 0 && lastPeriod >= 0
      ? lastComma > lastPeriod
        ? normalized.replaceAll(".", "").replace(",", ".")
        : normalized.replaceAll(",", "")
      : lastComma >= 0
        ? normalized.replace(",", ".")
        : normalized
  const number = Number(decimal)
  return Number.isFinite(number) ? number : 0
}

function textBoxStyle(
  context: OdtRenderContext,
  block: Extract<BlockNode, { type: "textBox" }>
) {
  const signature = JSON.stringify({
    background: block.background,
    borderColor: block.borderColor,
    borderStyle: block.borderStyle,
    position: block.position,
    align: block.align,
  })
  const existing = context.textBoxStyles.get(signature)
  if (existing) return existing
  const name = `TB${context.textBoxStyles.size + 1}`
  const stroke =
    block.borderStyle === "none"
      ? 'draw:stroke="none"'
      : `draw:stroke="${
          block.borderStyle === "dashed" ? "dash" : "solid"
        }" svg:stroke-color="${block.borderColor}" svg:stroke-width="${
          block.borderStyle === "double" ? "2pt" : "0.75pt"
        }"`
  const position =
    block.position === "float-left"
      ? ' style:wrap="parallel" style:horizontal-pos="left" style:horizontal-rel="paragraph"'
      : block.position === "float-right"
        ? ' style:wrap="parallel" style:horizontal-pos="right" style:horizontal-rel="paragraph"'
        : ""
  context.automaticStyles.push(
    `<style:style style:name="${name}" style:family="graphic"><style:graphic-properties draw:fill="solid" draw:fill-color="${block.background}" ${stroke}${position} fo:padding="${lengthValue(
      (block.padding * 72) / 96,
      "pt"
    )}"/></style:style>`
  )
  context.textBoxStyles.set(signature, name)
  return name
}

function namedStyleTextProperties(
  context: OdtRenderContext,
  styleId: string | undefined
) {
  const namedStyle = styleId
    ? context.namedStyles.find((candidate) => candidate.id === styleId)
    : undefined
  if (!namedStyle) return ""
  const properties = [
    namedStyle.fontFamily
      ? `style:font-name="${escapeXml(namedStyle.fontFamily)}"`
      : "",
    namedStyle.fontSize ? `fo:font-size="${namedStyle.fontSize}pt"` : "",
    namedStyle.bold ? 'fo:font-weight="bold"' : "",
    namedStyle.italic ? 'fo:font-style="italic"' : "",
    namedStyle.color
      ? `fo:color="${escapeXml(
          namedStyle.color.startsWith("#") ? namedStyle.color : `#${namedStyle.color}`
        )}"`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
  return properties
    ? `<style:text-properties ${properties}/>`
    : ""
}

function paragraphStyle(
  context: OdtRenderContext,
  block: Extract<BlockNode, { type: "paragraph" | "heading" }>
) {
  const format = block.paragraphFormat
  const signature = JSON.stringify({
    align: block.align,
    lineHeight: block.lineHeight,
    styleId: block.styleId,
    styleName: block.styleName,
    format,
  })
  const existing = context.paragraphStyles.get(signature)
  if (existing) return existing

  const name = `P${context.paragraphStyles.size + 1}`
  const properties = [
    block.align ? `fo:text-align="${block.align}"` : "",
    block.lineHeight
      ? `fo:line-height="${escapeXml(block.lineHeight)}"`
      : "",
    format ? `fo:margin-left="${lengthValue(format.leftIndent, "pt")}"` : "",
    format ? `fo:margin-right="${lengthValue(format.rightIndent, "pt")}"` : "",
    format
      ? `fo:text-indent="${format.firstLineIndent}pt"`
      : "",
    format ? `fo:margin-top="${lengthValue(format.spacingBefore, "pt")}"` : "",
    format
      ? `fo:margin-bottom="${lengthValue(format.spacingAfter, "pt")}"`
      : "",
    format?.keepWithNext ? 'fo:keep-with-next="always"' : "",
    format?.keepLinesTogether ? 'fo:keep-together="always"' : "",
    format?.pageBreakBefore ? 'fo:break-before="page"' : "",
    format?.widowOrphanControl
      ? 'fo:widows="2" fo:orphans="2"'
      : "",
  ]
    .filter(Boolean)
    .join(" ")
  const tabStops = format?.tabStops.length
    ? `<style:tab-stops>${format.tabStops
        .map(
          (position) =>
            `<style:tab-stop style:type="left" style:position="${lengthValue(position, "pt")}"/>`
        )
        .join("")}</style:tab-stops>`
    : ""
  const displayName = block.styleName || block.styleId
  const namedTextProperties = namedStyleTextProperties(context, block.styleId)
  context.automaticStyles.push(
    `<style:style style:name="${name}" style:family="paragraph"${
      displayName
        ? ` style:display-name="${escapeXml(displayName)}"`
        : ""
    }><style:paragraph-properties ${properties}>${tabStops}</style:paragraph-properties>${namedTextProperties}</style:style>`
  )
  context.paragraphStyles.set(signature, name)
  return name
}

function textStyle(context: OdtRenderContext, run: TextRun) {
  const signature = JSON.stringify({
    bold: run.bold,
    italic: run.italic,
    underline: run.underline,
    strike: run.strike,
    code: run.code,
    color: run.color,
    highlight: run.highlight,
    fontFamily: run.fontFamily,
    fontSize: run.fontSize,
    superscript: run.superscript,
    subscript: run.subscript,
    language: run.language,
  })
  if (signature === "{}") return null
  const existing = context.textStyles.get(signature)
  if (existing) return existing

  const name = `T${context.textStyles.size + 1}`
  const [language, country] = (run.language ?? "").split("-")
  const properties = [
    run.bold ? 'fo:font-weight="bold"' : "",
    run.italic ? 'fo:font-style="italic"' : "",
    run.underline
      ? 'style:text-underline-style="solid" style:text-underline-type="single"'
      : "",
    run.strike ? 'style:text-line-through-style="solid"' : "",
    run.code ? 'style:font-name="Courier New"' : "",
    run.fontFamily
      ? `style:font-name="${escapeXml(run.fontFamily)}"`
      : "",
    run.fontSize ? `fo:font-size="${escapeXml(run.fontSize)}"` : "",
    run.color ? `fo:color="${escapeXml(run.color)}"` : "",
    run.highlight
      ? `fo:background-color="${escapeXml(run.highlight)}"`
      : "",
    run.superscript ? 'style:text-position="super 58%"' : "",
    run.subscript ? 'style:text-position="sub 58%"' : "",
    language ? `fo:language="${escapeXml(language)}"` : "",
    country ? `fo:country="${escapeXml(country)}"` : "",
  ]
    .filter(Boolean)
    .join(" ")
  context.automaticStyles.push(
    `<style:style style:name="${name}" style:family="text"><style:text-properties ${properties}/></style:style>`
  )
  context.textStyles.set(signature, name)
  return name
}

function renderRuns(context: OdtRenderContext, runs: TextRun[]) {
  const values: string[] = []
  let activeBookmark = ""
  for (const run of runs.filter(
    (candidate) => candidate.revision?.type !== "deletion"
  )) {
    if (activeBookmark && activeBookmark !== run.bookmarkId) {
      values.push(
        `<text:bookmark-end text:name="${escapeXml(activeBookmark)}"/>`
      )
      activeBookmark = ""
    }
    if (run.bookmarkId && !activeBookmark) {
      activeBookmark = run.bookmarkId
      values.push(
        `<text:bookmark-start text:name="${escapeXml(activeBookmark)}"/>`
      )
    }
    const style = textStyle(context, run)
    let value = xmlText(run.text)
    if (style) {
      value = `<text:span text:style-name="${style}">${value}</text:span>`
    }
    if (run.link) {
      value = `<text:a xlink:type="simple" xlink:href="${escapeXml(run.link)}">${value}</text:a>`
    }
    values.push(value)
  }
  if (activeBookmark) {
    values.push(
      `<text:bookmark-end text:name="${escapeXml(activeBookmark)}"/>`
    )
  }
  return values.join("")
}

function imageFromDataUrl(src: string, index: number): OdtImage | null {
  const match = src.match(/^data:([^;,]+);base64,([\s\S]+)$/)
  if (!match) return null
  const mediaType = match[1]
  const extension =
    mediaType === "image/jpeg"
      ? "jpg"
      : mediaType === "image/webp"
        ? "webp"
        : mediaType === "image/gif"
          ? "gif"
          : "png"
  const binary = atob(match[2])
  return {
    path: `Pictures/image-${index}.${extension}`,
    mediaType,
    bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  }
}

function renderBlock(context: OdtRenderContext, block: BlockNode): string {
  switch (block.type) {
    case "paragraph": {
      const style = paragraphStyle(context, block)
      return `<text:p text:style-name="${style}">${renderRuns(context, block.runs)}</text:p>`
    }
    case "heading": {
      const style = paragraphStyle(context, block)
      const bookmark = block.anchorId
        ? `<text:bookmark-start text:name="${escapeXml(block.anchorId)}"/>`
        : ""
      const bookmarkEnd = block.anchorId
        ? `<text:bookmark-end text:name="${escapeXml(block.anchorId)}"/>`
        : ""
      return `<text:h text:outline-level="${block.level}" text:style-name="${style}">${bookmark}${
        block.outlineNumber ? `${escapeXml(block.outlineNumber)} ` : ""
      }${renderRuns(context, block.runs)}${bookmarkEnd}</text:h>`
    }
    case "bulletList":
    case "orderedList": {
      const style =
        block.type === "orderedList" ? "Numbering_20_123" : "List_20_1"
      return `<text:list text:style-name="${style}">${block.items
        .map(
          (item) =>
            `<text:list-item>${item
              .map((child) => renderBlock(context, child))
              .join("")}</text:list-item>`
        )
        .join("")}</text:list>`
    }
    case "blockquote":
      return `<text:section text:name="Quote">${block.content
        .map((child) => renderBlock(context, child))
        .join("")}</text:section>`
    case "codeBlock":
      return `<text:p text:style-name="Code">${xmlText(block.text)}</text:p>`
    case "horizontalRule":
      return '<text:p text:style-name="Horizontal_20_Line">────────</text:p>'
    case "pageBreak":
      return '<text:p text:style-name="PageBreak"/>'
    case "sectionBreak":
      return `<text:p text:style-name="PageBreak"><text:span>${escapeXml(
        `Sección: ${block.breakType}`
      )}</text:span></text:p>`
    case "bibliography":
      return [
        `<text:h text:outline-level="1">${escapeXml(block.heading)}</text:h>`,
        ...block.entries.map(
          (entry) =>
            `<text:p text:style-name="Bibliography">${xmlText(entry)}</text:p>`
        ),
      ].join("")
    case "tableOfContents":
      return [
        `<text:h text:outline-level="1">${escapeXml(block.title)}</text:h>`,
        ...block.entries.map(
          (entry) =>
            `<text:p>${escapeXml(
              `${entry.number ? `${entry.number} ` : ""}${entry.text}`
            )}</text:p>`
        ),
      ].join("")
    case "caption":
      return `<text:p text:style-name="Caption">${escapeXml(
        `${block.label} ${block.number}${block.title ? `. ${block.title}` : ""}`
      )}</text:p>`
    case "equation":
      return `<text:p text:style-name="Equation">${escapeXml(
        block.latex
      )}${block.number ? `    (${block.number})` : ""}</text:p>`
    case "image": {
      const image = imageFromDataUrl(block.src, context.images.length + 1)
      if (!image) return ""
      context.images.push(image)
      const width = Math.max(32, block.width ?? 400)
      const height = Math.max(
        24,
        block.height ??
          Math.round(width * 0.75)
      )
      const frameStyle =
        block.wrap === "square-left"
          ? "ImageWrapLeft"
          : block.wrap === "square-right"
            ? "ImageWrapRight"
            : block.wrap === "tight-left"
              ? "ImageTightLeft"
              : block.wrap === "tight-right"
                ? "ImageTightRight"
                : block.wrap === "behind"
                  ? "ImageBehind"
                  : block.wrap === "in-front"
                    ? "ImageInFront"
                    : ""
      return `<text:p text:style-name="${
        block.align === "left"
          ? "ImageLeft"
          : block.align === "right"
            ? "ImageRight"
            : "ImageCenter"
      }"><draw:frame${frameStyle ? ` draw:style-name="${frameStyle}"` : ""} draw:name="Imagen ${context.images.length}" text:anchor-type="${frameStyle ? "paragraph" : "as-char"}"${block.wrap === "behind" ? ' draw:z-index="0"' : block.wrap === "in-front" ? ' draw:z-index="10"' : ""} svg:width="${lengthValue(
        (width * 2.54) / 96,
        "cm"
      )}" svg:height="${lengthValue(
        (height * 2.54) / 96,
        "cm"
      )}"><draw:image xlink:href="${image.path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/><svg:title>${escapeXml(
        block.alt || "Imagen"
      )}</svg:title></draw:frame></text:p>`
    }
    case "textBox": {
      const style = textBoxStyle(context, block)
      return `<text:p><draw:frame draw:style-name="${style}" draw:name="ETITextBox|${block.position}|${block.align}|${block.borderStyle}" text:anchor-type="${
        block.position === "inline" ? "as-char" : "paragraph"
      }" svg:width="${lengthValue(
        (block.width * 2.54) / 96,
        "cm"
      )}" svg:height="${lengthValue(
        (block.minHeight * 2.54) / 96,
        "cm"
      )}"><draw:text-box>${block.content
        .map((child) => renderBlock(context, child))
        .join("")}</draw:text-box></draw:frame></text:p>`
    }
    case "table": {
      const tableStyle = block.tableStyle ?? "grid"
      return `<table:table table:name="ETI-${tableStyle}"><table:table-column table:number-columns-repeated="${Math.max(
        1,
        ...block.rows.map((row) => row.cells.length)
      )}"/>${block.rows
        .map(
          (row, rowIndex) =>
            `<table:table-row>${row.cells
              .map(
                (cell, columnIndex) => {
                  const formula = odtTableFormula(
                    cell.formula,
                    rowIndex,
                    columnIndex
                  )
                  return `<table:table-cell table:style-name="${tableCellStyle(
                    context,
                    tableStyle,
                    rowIndex,
                    cell.header
                  )}"${
                    cell.colSpan && cell.colSpan > 1
                      ? ` table:number-columns-spanned="${cell.colSpan}"`
                      : ""
                  }${
                    cell.rowSpan && cell.rowSpan > 1
                      ? ` table:number-rows-spanned="${cell.rowSpan}"`
                      : ""
                  }${
                    formula
                      ? ` table:formula="${escapeXml(
                          formula
                        )}" office:value-type="float" office:value="${tableCellValue(
                          cell
                        )}"`
                      : ""
                  }>${cell.content
                    .map((child) => renderBlock(context, child))
                    .join("")}</table:table-cell>`
                }
              )
              .join("")}</table:table-row>`
        )
        .join("")}</table:table>`
    }
  }
}

function pageLayoutXml(state: DocumentWorkspaceState) {
  const section = state.sections[0]
  const layout = section?.layout ?? state.layout
  const appearance = state.pageAppearance
  const portrait =
    layout.pageSize === "letter"
      ? { width: 21.59, height: 27.94 }
      : { width: 21, height: 29.7 }
  const page =
    layout.orientation === "landscape"
      ? { width: portrait.height, height: portrait.width }
      : portrait
  const pxToCm = (value: number) => (value * 2.54) / 96
  const border =
    appearance.borderStyle === "none"
      ? ""
      : ` fo:border="${Math.max(
          0.5,
          appearance.borderWidth * 0.75
        ).toFixed(2)}pt ${appearance.borderStyle} ${appearance.borderColor}"`
  return `<style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="${lengthValue(
    page.width,
    "cm"
  )}" fo:page-height="${lengthValue(
    page.height,
    "cm"
  )}" style:print-orientation="${layout.orientation}" fo:margin-top="${lengthValue(
    pxToCm(layout.margins.top),
    "cm"
  )}" fo:margin-right="${lengthValue(
    pxToCm(layout.margins.right),
    "cm"
  )}" fo:margin-bottom="${lengthValue(
    pxToCm(layout.margins.bottom),
    "cm"
  )}" fo:margin-left="${lengthValue(
    pxToCm(layout.margins.left),
    "cm"
  )}" fo:background-color="${appearance.color}"${border}/></style:page-layout>`
}

function stylesXml(state: DocumentWorkspaceState) {
  const section = state.sections[0]
  const header = section?.header.default ?? ""
  const footer = section?.footer.default ?? ""
  const watermark = state.pageAppearance.watermarkText
  const watermarkRotation = (
    (state.pageAppearance.watermarkAngle * Math.PI) /
    180
  ).toFixed(4)
  const [language = "es", country = "ES"] =
    state.proofingLanguage.split("-")
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3">
  <office:styles>
    <style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="8pt" fo:hyphenate="${state.pageAppearance.hyphenation ? "true" : "false"}"/><style:text-properties style:font-name="Liberation Sans" fo:font-size="11pt" fo:language="${escapeXml(
      language
    )}" fo:country="${escapeXml(country)}"/></style:default-style>
    <text:list-style style:name="List_20_1"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></text:list-style>
    <text:list-style style:name="Numbering_20_123"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style>
    <style:style style:name="Code" style:family="paragraph"><style:text-properties style:font-name="Liberation Mono"/></style:style>
    <style:style style:name="Bibliography" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="6pt"/></style:style>
    <style:style style:name="Caption" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
    <style:style style:name="Equation" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
    <style:style style:name="Horizontal_20_Line" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
    <style:style style:name="ImageLeft" style:family="paragraph"><style:paragraph-properties fo:text-align="left"/></style:style>
    <style:style style:name="ImageCenter" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>
    <style:style style:name="ImageRight" style:family="paragraph"><style:paragraph-properties fo:text-align="right"/></style:style>
    <style:style style:name="ImageWrapLeft" style:family="graphic"><style:graphic-properties style:wrap="parallel" style:horizontal-pos="left" style:horizontal-rel="paragraph" fo:margin-right="0.32cm" fo:margin-bottom="0.32cm"/></style:style>
    <style:style style:name="ImageWrapRight" style:family="graphic"><style:graphic-properties style:wrap="parallel" style:horizontal-pos="right" style:horizontal-rel="paragraph" fo:margin-left="0.32cm" fo:margin-bottom="0.32cm"/></style:style>
    <style:style style:name="ImageTightLeft" style:family="graphic"><style:graphic-properties style:wrap="parallel" style:wrap-contour="true" style:horizontal-pos="left" style:horizontal-rel="paragraph" fo:margin-right="0.2cm"/></style:style>
    <style:style style:name="ImageTightRight" style:family="graphic"><style:graphic-properties style:wrap="parallel" style:wrap-contour="true" style:horizontal-pos="right" style:horizontal-rel="paragraph" fo:margin-left="0.2cm"/></style:style>
    <style:style style:name="ImageBehind" style:family="graphic"><style:graphic-properties style:wrap="run-through" style:run-through="background"/></style:style>
    <style:style style:name="ImageInFront" style:family="graphic"><style:graphic-properties style:wrap="run-through" style:run-through="foreground"/></style:style>
    <style:style style:name="PageBreak" style:family="paragraph"><style:paragraph-properties fo:break-before="page"/></style:style>
    ${
      watermark
        ? `<style:style style:name="EditorWatermarkFrame" style:family="graphic"><style:graphic-properties draw:fill="none" draw:opacity="${Math.round(
            state.pageAppearance.watermarkOpacity * 100
          )}%" style:wrap="run-through" style:run-through="background"/></style:style><style:style style:name="EditorWatermarkText" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="42pt" fo:font-weight="bold" fo:color="${state.pageAppearance.watermarkColor}"/></style:style>`
        : ""
    }
  </office:styles>
  <office:automatic-styles>${pageLayoutXml(state)}</office:automatic-styles>
  <office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1">${
    watermark
      ? `<draw:frame draw:style-name="EditorWatermarkFrame" draw:name="EditorInteligenteIAWatermark" text:anchor-type="page" svg:x="3cm" svg:y="12cm" svg:width="15cm" svg:height="3cm" draw:z-index="0" draw:transform="rotate (${watermarkRotation})"><draw:text-box><text:p text:style-name="EditorWatermarkText">${xmlText(
          watermark
        )}</text:p></draw:text-box></draw:frame>`
      : ""
  }${
    header ? `<style:header><text:p>${xmlText(header)}</text:p></style:header>` : ""
  }${
    footer ? `<style:footer><text:p>${xmlText(footer)}</text:p></style:footer>` : ""
  }</style:master-page></office:master-styles>
</office:document-styles>`
}

export async function createDocumentOdtBlob(
  blocks: BlockNode[],
  state: DocumentWorkspaceState,
  title = "Documento"
) {
  const context: OdtRenderContext = {
    paragraphStyles: new Map(),
    textStyles: new Map(),
    tableCellStyles: new Map(),
    textBoxStyles: new Map(),
    automaticStyles: [],
    images: [],
    namedStyles: state.styles,
  }
  const body = blocks.map((block) => renderBlock(context, block)).join("")
  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3">
  <office:automatic-styles>${context.automaticStyles.join("")}</office:automatic-styles>
  <office:body><office:text>${body}</office:text></office:body>
</office:document-content>`
  const metaXml = `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"><office:meta><dc:title>${escapeXml(
    title
  )}</dc:title><meta:generator>Editor Inteligente IA</meta:generator></office:meta></office:document-meta>`
  const settingsXml =
    '<?xml version="1.0" encoding="UTF-8"?><office:document-settings xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.3"><office:settings/></office:document-settings>'
  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MIME}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/>${context.images
    .map(
      (image) =>
        `<manifest:file-entry manifest:full-path="${image.path}" manifest:media-type="${image.mediaType}"/>`
    )
    .join("")}</manifest:manifest>`

  const zip = new JSZip()
  zip.file("mimetype", ODT_MIME, { compression: "STORE" })
  zip.file("content.xml", contentXml)
  zip.file("styles.xml", stylesXml(state))
  zip.file("meta.xml", metaXml)
  zip.file("settings.xml", settingsXml)
  zip.folder("META-INF")?.file("manifest.xml", manifestXml)
  for (const image of context.images) zip.file(image.path, image.bytes)
  return zip.generateAsync({
    type: "blob",
    mimeType: ODT_MIME,
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })
}

export async function exportDocumentToOdt(
  blocks: BlockNode[],
  filename: string,
  state: DocumentWorkspaceState
) {
  downloadBlob(
    filename,
    await createDocumentOdtBlob(
      blocks,
      state,
      filename.replace(/\.odt$/i, "")
    )
  )
}
