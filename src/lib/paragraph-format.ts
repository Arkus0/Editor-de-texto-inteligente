/**
 * Regla de interlineado, la misma que ofrece el cuadro «Párrafo» de Word.
 *
 * `multiple` es un factor sobre la altura de la línea —sencillo, 1,5, doble—.
 * `atLeast` y `exactly` se miden en puntos: «mínimo» deja crecer la línea si
 * entra una fórmula o una fuente mayor, y «exacto» la clava aunque se recorte.
 * Sin estos dos no se puede cumplir lo que piden las revistas y las plantillas
 * de tesis, que se redacta literalmente como «interlineado exacto de 24 pt».
 */
export type LineSpacingRule = "multiple" | "atLeast" | "exactly"

export interface ParagraphFormat {
  leftIndent: number
  rightIndent: number
  firstLineIndent: number
  tabStops: number[]
  spacingBefore: number
  spacingAfter: number
  lineSpacingRule: LineSpacingRule
  /** Factor con `multiple`; puntos con `atLeast` y `exactly`. */
  lineSpacing: number
  /**
   * «No agregar espacio entre párrafos del mismo estilo».
   *
   * Es la casilla que resuelve la queja más repetida de quien escribe listas o
   * apartados seguidos: el espacio posterior se suma entre párrafos hermanos y
   * separa lo que debería ir junto.
   */
  contextualSpacing: boolean
  /**
   * Nivel de esquema: 0 es texto independiente y 1–9 son niveles de título.
   * Permite que un párrafo entre en la tabla de contenido y en el panel de
   * navegación sin tener que darle formato de título.
   */
  outlineLevel: number
  keepWithNext: boolean
  keepLinesTogether: boolean
  widowOrphanControl: boolean
  pageBreakBefore: boolean
  suppressLineNumbers: boolean
}

export const DEFAULT_PARAGRAPH_FORMAT: ParagraphFormat = {
  leftIndent: 0,
  rightIndent: 0,
  firstLineIndent: 0,
  tabStops: [],
  spacingBefore: 0,
  spacingAfter: 8,
  lineSpacingRule: "multiple",
  lineSpacing: 1,
  contextualSpacing: false,
  outlineLevel: 0,
  keepWithNext: false,
  keepLinesTogether: false,
  widowOrphanControl: true,
  pageBreakBefore: false,
  suppressLineNumbers: false,
}

export const LINE_SPACING_RULE_OPTIONS: Array<{
  value: LineSpacingRule
  label: string
  unit: string
}> = [
  { value: "multiple", label: "Múltiple", unit: "líneas" },
  { value: "atLeast", label: "Mínimo", unit: "pt" },
  { value: "exactly", label: "Exacto", unit: "pt" },
]

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback
}

export function normalizeParagraphFormat(
  value: unknown
): ParagraphFormat {
  const input =
    value && typeof value === "object"
      ? (value as Partial<ParagraphFormat>)
      : {}
  const rule: LineSpacingRule =
    input.lineSpacingRule === "atLeast" || input.lineSpacingRule === "exactly"
      ? input.lineSpacingRule
      : "multiple"
  return {
    leftIndent: boundedNumber(input.leftIndent, 0, 0, 720),
    rightIndent: boundedNumber(input.rightIndent, 0, 0, 720),
    firstLineIndent: boundedNumber(input.firstLineIndent, 0, -360, 360),
    tabStops: Array.isArray(input.tabStops)
      ? [
          ...new Set(
            input.tabStops
              .map((stop) => boundedNumber(stop, 0, 0, 720))
              .filter((stop) => stop > 0)
              .map((stop) => Math.round(stop * 2) / 2)
          ),
        ].sort((left, right) => left - right)
      : [],
    spacingBefore: boundedNumber(input.spacingBefore, 0, 0, 240),
    spacingAfter: boundedNumber(input.spacingAfter, 8, 0, 240),
    lineSpacingRule: rule,
    // Los márgenes dependen de la regla: un factor razonable llega a 10, pero
    // «exacto» se mide en puntos y admite valores mucho mayores.
    lineSpacing:
      rule === "multiple"
        ? boundedNumber(input.lineSpacing, 1, 0.25, 10)
        : boundedNumber(input.lineSpacing, 12, 1, 480),
    contextualSpacing: Boolean(input.contextualSpacing),
    outlineLevel: Math.round(boundedNumber(input.outlineLevel, 0, 0, 9)),
    keepWithNext: Boolean(input.keepWithNext),
    keepLinesTogether: Boolean(input.keepLinesTogether),
    widowOrphanControl:
      input.widowOrphanControl === undefined
        ? true
        : Boolean(input.widowOrphanControl),
    pageBreakBefore: Boolean(input.pageBreakBefore),
    suppressLineNumbers: Boolean(input.suppressLineNumbers),
  }
}

/**
 * `exactly` se traduce con una altura fija, que es justo lo que significa:
 * aunque entre una fórmula alta, la línea no crece. `atLeast` usa `min-height`
 * sobre la línea, el equivalente más cercano que ofrece CSS.
 */
function lineSpacingCss(format: ParagraphFormat) {
  if (format.lineSpacingRule === "exactly") {
    return `line-height:${format.lineSpacing}pt`
  }
  if (format.lineSpacingRule === "atLeast") {
    return `line-height:calc(max(${format.lineSpacing}pt, 1.2em))`
  }
  return format.lineSpacing === 1 ? "" : `line-height:${format.lineSpacing}`
}

export function paragraphFormatCss(format: ParagraphFormat) {
  return [
    `margin-left:${format.leftIndent}pt`,
    `margin-right:${format.rightIndent}pt`,
    `text-indent:${format.firstLineIndent}pt`,
    `margin-top:${format.spacingBefore}pt`,
    // El espacio posterior se anula cuando el párrafo pide no separarse de sus
    // hermanos; el navegador ya funde márgenes verticales, así que basta con
    // no escribirlo.
    `margin-bottom:${format.contextualSpacing ? 0 : format.spacingAfter}pt`,
    lineSpacingCss(format),
    format.keepWithNext ? "break-after:avoid-page" : "",
    format.keepLinesTogether ? "break-inside:avoid-page" : "",
    format.pageBreakBefore ? "break-before:page" : "",
    `widows:${format.widowOrphanControl ? 2 : 1}`,
    `orphans:${format.widowOrphanControl ? 2 : 1}`,
  ]
    .filter(Boolean)
    .join(";")
}
