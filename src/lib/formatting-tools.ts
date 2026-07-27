export interface FormattingMarkSnapshot {
  type: string
  attrs: Record<string, unknown>
}

export interface FormattingSnapshot {
  blockType: "paragraph" | "heading"
  blockAttrs: Record<string, unknown>
  marks: FormattingMarkSnapshot[]
}

const COPYABLE_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "superscript",
  "subscript",
  "textStyle",
  "highlight",
  "proofingLanguage",
])

const COPYABLE_BLOCK_ATTRIBUTES = new Set([
  "level",
  "styleId",
  "styleName",
  "paragraphFormat",
  "textAlign",
])

export function sanitizeFormattingMarks(
  marks: Array<{ type: string; attrs?: Record<string, unknown> }>
): FormattingMarkSnapshot[] {
  return marks
    .filter((mark) => COPYABLE_MARKS.has(mark.type))
    .map((mark) => ({
      type: mark.type,
      attrs: { ...(mark.attrs ?? {}) },
    }))
}

export function sanitizeFormattingBlock(
  blockType: string,
  attrs: Record<string, unknown>
): Pick<FormattingSnapshot, "blockType" | "blockAttrs"> | null {
  if (blockType !== "paragraph" && blockType !== "heading") return null
  return {
    blockType,
    blockAttrs: Object.fromEntries(
      Object.entries(attrs).filter(([key]) =>
        COPYABLE_BLOCK_ATTRIBUTES.has(key)
      )
    ),
  }
}

export function formattingSnapshotDescription(
  snapshot: FormattingSnapshot
): string[] {
  const descriptions: string[] = []
  const styleName =
    typeof snapshot.blockAttrs.styleName === "string"
      ? snapshot.blockAttrs.styleName
      : typeof snapshot.blockAttrs.styleId === "string"
        ? snapshot.blockAttrs.styleId
        : snapshot.blockType === "heading"
          ? `Título ${snapshot.blockAttrs.level ?? ""}`.trim()
          : "Normal"
  descriptions.push(`Estilo: ${styleName}`)

  const labels: Record<string, string> = {
    bold: "negrita",
    italic: "cursiva",
    underline: "subrayado",
    strike: "tachado",
    code: "código",
    superscript: "superíndice",
    subscript: "subíndice",
  }
  const simpleMarks = snapshot.marks
    .map((mark) => labels[mark.type])
    .filter(Boolean)
  if (simpleMarks.length) {
    descriptions.push(`Énfasis: ${simpleMarks.join(", ")}`)
  }

  const textStyle = snapshot.marks.find((mark) => mark.type === "textStyle")
  if (textStyle) {
    const details = [
      textStyle.attrs.fontFamily,
      textStyle.attrs.fontSize,
      textStyle.attrs.color,
      textStyle.attrs.lineHeight
        ? `interlineado ${textStyle.attrs.lineHeight}`
        : undefined,
    ].filter(
      (value): value is string =>
        typeof value === "string" && value.length > 0
    )
    if (details.length) descriptions.push(`Texto: ${details.join(" · ")}`)
  }

  const highlight = snapshot.marks.find((mark) => mark.type === "highlight")
  if (typeof highlight?.attrs.color === "string") {
    descriptions.push(`Resaltado: ${highlight.attrs.color}`)
  }
  if (typeof snapshot.blockAttrs.textAlign === "string") {
    descriptions.push(`Alineación: ${snapshot.blockAttrs.textAlign}`)
  }
  if (snapshot.blockAttrs.paragraphFormat) {
    descriptions.push("Párrafo: formato avanzado personalizado")
  }
  return descriptions
}
