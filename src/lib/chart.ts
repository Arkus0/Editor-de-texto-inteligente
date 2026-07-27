export type ChartKind = "bar" | "line" | "pie"

export interface ChartData {
  labels: string[]
  values: number[]
  seriesName: string
}

export const CHART_KIND_LABELS: Record<ChartKind, string> = {
  bar: "Barras",
  line: "Líneas",
  pie: "Sectores",
}

/**
 * Paleta del gráfico. Arranca en el azul de la interfaz para que un gráfico
 * insertado no desentone con el resto del documento, y sigue con tonos que se
 * distinguen también impresos en blanco y negro, porque bastantes informes
 * acaban en una impresora láser.
 */
const PALETTE = [
  "#2b579a",
  "#c55a11",
  "#548235",
  "#7030a0",
  "#bf8f00",
  "#2e75b6",
  "#a5314b",
  "#4a7a7a",
]

const AXIS_COLOR = "#9aa3ad"
const TEXT_COLOR = "#3b4149"
const GRID_COLOR = "#e2e6ea"

/**
 * Convierte el texto de una celda en número.
 *
 * Tiene que entender lo que la gente escribe de verdad en una tabla: «1.234,5»
 * a la española, «1,234.5» a la inglesa, «85 %», «1.200 €» o un negativo entre
 * paréntesis como en contabilidad.
 *
 * Con los dos separadores presentes no hay ambigüedad: el último es el decimal.
 * Con uno solo sí la hay —«1.200» son mil doscientos en español y uno coma dos
 * en inglés— y se resuelve por la regla de las tres cifras: un separador
 * seguido de exactamente tres dígitos es de millar. Acierta en «1.200 €» y en
 * «82.400», y falla en un «0.500» escrito a la inglesa, que es mucho más raro
 * en un documento redactado en español.
 */
export function parseChartNumber(raw: string): number | null {
  const cleaned = String(raw)
    .replace(/\s| /g, "")
    .replace(/[€$£%]/g, "")
  if (!cleaned) return null

  const negative = /^\(.*\)$/.test(cleaned)
  const body = negative ? cleaned.slice(1, -1) : cleaned
  if (!/^[-+]?[\d.,]+$/.test(body)) return null

  const dots = (body.match(/\./g) ?? []).length
  const commas = (body.match(/,/g) ?? []).length
  let normalized: string

  if (dots > 0 && commas > 0) {
    // Con los dos presentes no hay duda: el último es el separador decimal.
    normalized =
      body.lastIndexOf(",") > body.lastIndexOf(".")
        ? body.replaceAll(".", "").replace(",", ".")
        : body.replaceAll(",", "")
  } else if (dots > 1 || commas > 1) {
    // Varios separadores iguales solo pueden ser de millar: «1.234.567».
    normalized = body.replaceAll(".", "").replaceAll(",", "")
  } else if (dots === 1 || commas === 1) {
    const separator = dots === 1 ? "." : ","
    const decimals = body.length - body.indexOf(separator) - 1
    normalized =
      decimals === 3
        ? body.replace(separator, "")
        : body.replace(separator, ".")
  } else {
    normalized = body
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}

/**
 * Saca del contenido de una tabla las etiquetas y los valores del gráfico.
 *
 * Asume la forma que tiene casi cualquier tabla escrita a mano: una fila de
 * cabecera, la primera columna con los nombres y una columna numérica. Si hay
 * varias columnas de números se queda con la primera, para no obligar a nadie a
 * pasar por un asistente antes de ver su gráfico.
 */
export function extractChartDataFromRows(rows: string[][]): ChartData | null {
  if (rows.length < 2) return null

  const [header, ...body] = rows
  const columnCount = Math.max(...rows.map((row) => row.length))

  let valueColumn = -1
  for (let column = 1; column < columnCount; column += 1) {
    const parsed = body.map((row) => parseChartNumber(row[column] ?? ""))
    const usable = parsed.filter((value) => value !== null).length
    // Más de la mitad de las celdas tienen que ser números para considerar la
    // columna una serie y no una nota suelta con una cifra dentro.
    if (usable > 0 && usable >= Math.ceil(body.length / 2)) {
      valueColumn = column
      break
    }
  }
  if (valueColumn === -1) return null

  const labels: string[] = []
  const values: number[] = []
  for (const row of body) {
    const value = parseChartNumber(row[valueColumn] ?? "")
    if (value === null) continue
    labels.push((row[0] ?? "").trim() || `Fila ${labels.length + 1}`)
    values.push(value)
  }
  if (values.length === 0) return null

  return {
    labels,
    values,
    seriesName: (header[valueColumn] ?? "").trim() || "Serie",
  }
}

function escapeXml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/** Redondea para no llenar el SVG de decimales que nadie ve. */
function round(value: number) {
  return Math.round(value * 100) / 100
}

function formatValue(value: number) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Elige un tope de eje redondo por encima del valor máximo, para que las líneas
 * de referencia caigan en cifras legibles y no en 3.847,33.
 */
export function niceAxisMax(max: number): number {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    const candidate = step * magnitude
    if (candidate >= max) return candidate
  }
  return 10 * magnitude
}

export interface ChartRenderOptions extends ChartData {
  kind: ChartKind
  title?: string
  width?: number
  height?: number
}

/**
 * Dibuja el gráfico como SVG.
 *
 * Se genera a mano en vez de con una biblioteca porque lo que hace falta son
 * tres formas sencillas, y cualquiera de las bibliotecas del mercado costaría
 * más kilobytes de arranque que todo lo que se ahorró sacando KaTeX.
 */
export function renderChartSvg(options: ChartRenderOptions): string {
  const width = options.width ?? 560
  const height = options.height ?? 320
  const { kind, labels, values, seriesName } = options
  const title = options.title?.trim() || seriesName

  const titleHeight = title ? 28 : 8
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(
      title
    )}">`
  )
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`)
  if (title) {
    parts.push(
      `<text x="${width / 2}" y="20" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="${TEXT_COLOR}">${escapeXml(
        title
      )}</text>`
    )
  }

  if (kind === "pie") {
    const total = values.reduce((sum, value) => sum + Math.abs(value), 0)
    const radius = Math.min(width * 0.28, (height - titleHeight) * 0.4)
    const cx = width * 0.32
    const cy = titleHeight + (height - titleHeight) / 2
    let angle = -Math.PI / 2

    if (total === 0) {
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${round(
          radius
        )}" fill="none" stroke="${AXIS_COLOR}"/>`
      )
    } else {
      values.forEach((value, index) => {
        const slice = (Math.abs(value) / total) * Math.PI * 2
        const end = angle + slice
        const x1 = cx + radius * Math.cos(angle)
        const y1 = cy + radius * Math.sin(angle)
        const x2 = cx + radius * Math.cos(end)
        const y2 = cy + radius * Math.sin(end)
        const largeArc = slice > Math.PI ? 1 : 0
        // Un único valor daría un arco de 360° que no se dibuja: se pinta el
        // círculo completo.
        const path =
          values.length === 1
            ? `<circle cx="${cx}" cy="${cy}" r="${round(radius)}" fill="${
                PALETTE[0]
              }"/>`
            : `<path d="M ${round(cx)} ${round(cy)} L ${round(x1)} ${round(
                y1
              )} A ${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${round(
                x2
              )} ${round(y2)} Z" fill="${
                PALETTE[index % PALETTE.length]
              }" stroke="#ffffff" stroke-width="1"/>`
        parts.push(path)
        angle = end
      })
    }

    labels.forEach((label, index) => {
      const legendY = titleHeight + 14 + index * 20
      if (legendY > height - 8) return
      const percent =
        total === 0 ? 0 : Math.round((Math.abs(values[index]) / total) * 100)
      parts.push(
        `<rect x="${round(width * 0.62)}" y="${legendY - 9}" width="11" height="11" rx="2" fill="${
          PALETTE[index % PALETTE.length]
        }"/>`
      )
      parts.push(
        `<text x="${round(
          width * 0.62 + 18
        )}" y="${legendY}" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="${TEXT_COLOR}">${escapeXml(
          `${label} · ${percent}%`
        )}</text>`
      )
    })
    parts.push("</svg>")
    return parts.join("")
  }

  const padding = { top: titleHeight + 8, right: 16, bottom: 46, left: 56 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxValue = niceAxisMax(Math.max(0, ...values))
  const minValue = Math.min(0, ...values)
  const span = maxValue - minValue || 1
  const yOf = (value: number) =>
    padding.top + plotHeight - ((value - minValue) / span) * plotHeight

  for (let step = 0; step <= 4; step += 1) {
    const value = minValue + (span * step) / 4
    const y = round(yOf(value))
    parts.push(
      `<line x1="${padding.left}" y1="${y}" x2="${
        padding.left + plotWidth
      }" y2="${y}" stroke="${GRID_COLOR}" stroke-width="1"/>`
    )
    parts.push(
      `<text x="${padding.left - 8}" y="${
        y + 4
      }" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="${TEXT_COLOR}">${escapeXml(
        formatValue(round(value))
      )}</text>`
    )
  }

  const slotWidth = plotWidth / Math.max(1, values.length)
  if (kind === "bar") {
    const barWidth = Math.max(4, slotWidth * 0.62)
    values.forEach((value, index) => {
      const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2
      const top = yOf(Math.max(value, 0))
      const bottom = yOf(Math.min(value, 0))
      parts.push(
        `<rect x="${round(x)}" y="${round(top)}" width="${round(
          barWidth
        )}" height="${round(Math.max(1, bottom - top))}" fill="${
          PALETTE[index % PALETTE.length]
        }" rx="2"/>`
      )
    })
  } else {
    const points = values
      .map(
        (value, index) =>
          `${round(padding.left + slotWidth * (index + 0.5))},${round(
            yOf(value)
          )}`
      )
      .join(" ")
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${PALETTE[0]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
    )
    values.forEach((value, index) => {
      parts.push(
        `<circle cx="${round(
          padding.left + slotWidth * (index + 0.5)
        )}" cy="${round(yOf(value))}" r="3.5" fill="${PALETTE[0]}"/>`
      )
    })
  }

  parts.push(
    `<line x1="${padding.left}" y1="${round(
      yOf(Math.max(minValue, 0))
    )}" x2="${padding.left + plotWidth}" y2="${round(
      yOf(Math.max(minValue, 0))
    )}" stroke="${AXIS_COLOR}" stroke-width="1"/>`
  )

  // Con muchas categorías las etiquetas se solaparían: se muestran salteadas.
  const labelStep = Math.ceil(labels.length / Math.floor(plotWidth / 52) || 1)
  labels.forEach((label, index) => {
    if (index % labelStep !== 0) return
    const x = padding.left + slotWidth * (index + 0.5)
    const shown = label.length > 12 ? `${label.slice(0, 11)}…` : label
    parts.push(
      `<text x="${round(x)}" y="${
        height - padding.bottom + 18
      }" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="${TEXT_COLOR}">${escapeXml(
        shown
      )}</text>`
    )
  })

  parts.push(
    `<text x="${padding.left}" y="${
      height - 8
    }" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="${TEXT_COLOR}">${escapeXml(
      seriesName
    )}</text>`
  )
  parts.push("</svg>")
  return parts.join("")
}
