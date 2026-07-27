export interface MailMergeDataset {
  delimiter: "," | ";" | "\t"
  fields: string[]
  records: Array<Record<string, string>>
}

export interface MailMergeResult {
  html: string
  missingFields: string[]
}

const FIELD_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g
const MAX_RECORDS = 10_000
const MAX_FIELDS = 200

function delimiterCounts(text: string) {
  const counts = new Map<"," | ";" | "\t", number>([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ])
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && (character === "\n" || character === "\r")) {
      break
    } else if (!quoted && counts.has(character as "," | ";" | "\t")) {
      const delimiter = character as "," | ";" | "\t"
      counts.set(delimiter, (counts.get(delimiter) ?? 0) + 1)
    }
  }
  return counts
}

export function detectMailMergeDelimiter(text: string): "," | ";" | "\t" {
  const counts = delimiterCounts(text)
  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1]
  )[0]?.[0] ?? ","
}

function parseRows(text: string, delimiter: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false

  const pushValue = () => {
    row.push(value)
    value = ""
  }
  const pushRow = () => {
    pushValue()
    if (row.some((cell) => cell.trim())) rows.push(row)
    row = []
    if (rows.length > MAX_RECORDS + 1) {
      throw new Error(
        `El archivo supera el límite local de ${MAX_RECORDS.toLocaleString("es-ES")} registros.`
      )
    }
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (!quoted && value.length === 0) {
        quoted = true
      } else if (quoted) {
        quoted = false
      } else {
        value += character
      }
    } else if (!quoted && character === delimiter) {
      pushValue()
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1
      pushRow()
    } else {
      value += character
    }
  }
  if (quoted) {
    throw new Error("El CSV contiene un campo entre comillas sin cerrar.")
  }
  if (value.length > 0 || row.length > 0) pushRow()
  return rows
}

function uniqueFieldNames(header: string[]) {
  const used = new Map<string, number>()
  return header.slice(0, MAX_FIELDS).map((raw, index) => {
    const base = raw.replace(/^\uFEFF/, "").trim() || `Campo ${index + 1}`
    const normalized = base.toLocaleLowerCase()
    const occurrence = (used.get(normalized) ?? 0) + 1
    used.set(normalized, occurrence)
    return occurrence === 1 ? base : `${base} (${occurrence})`
  })
}

export function parseMailMergeDataset(text: string): MailMergeDataset {
  const source = text.replace(/^\uFEFF/, "")
  const delimiter = detectMailMergeDelimiter(source)
  const rows = parseRows(source, delimiter)
  if (rows.length === 0) {
    throw new Error("El archivo no contiene una fila de encabezados.")
  }
  const fields = uniqueFieldNames(rows[0])
  if (fields.length === 0) {
    throw new Error("El archivo no contiene campos utilizables.")
  }
  const records = rows.slice(1).map((row) =>
    Object.fromEntries(
      fields.map((field, index) => [field, row[index]?.trim() ?? ""])
    )
  )
  return { delimiter, fields, records }
}

export function extractMailMergeFields(template: string) {
  return [
    ...new Set(
      [...template.matchAll(FIELD_PATTERN)]
        .map((match) => match[1].trim())
        .filter(Boolean)
    ),
  ]
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replace(/\r?\n/g, "<br>")
}

export function applyMailMergeRecord(
  templateHtml: string,
  record: Record<string, string>
): MailMergeResult {
  const recordByNormalizedField = new Map(
    Object.entries(record).map(([field, value]) => [
      field.trim().toLocaleLowerCase(),
      value,
    ])
  )
  const missingFields = new Set<string>()
  const html = templateHtml.replace(
    FIELD_PATTERN,
    (_placeholder, rawField: string) => {
      const field = rawField.trim()
      const value = recordByNormalizedField.get(field.toLocaleLowerCase())
      if (value === undefined) {
        missingFields.add(field)
        return `{{${field}}}`
      }
      return escapeHtml(value)
    }
  )
  return { html, missingFields: [...missingFields] }
}

export interface MailMergeDocument {
  html: string
  /** Nombre de archivo sin extensión, ya saneado. */
  name: string
  missingFields: string[]
}

/**
 * Nombres de dispositivo heredados de MS-DOS. Windows los sigue reservando en
 * cualquier carpeta y con cualquier extensión: un destinatario apellidado «Con»
 * o una columna con el valor «AUX» generaban un archivo que el sistema se niega
 * a crear, y la combinación entera fallaba al descomprimir el ZIP.
 */
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Deja un nombre utilizable como archivo en Windows, macOS y Linux. */
export function toSafeFileName(value: string, fallback: string): string {
  const cleaned = value
    .normalize("NFC")
    // Además de los caracteres que Windows prohíbe, se quitan los de control
    // (`Cc`) y los de formato (`Cf`): un salto de línea dentro de una celda
    // entrecomillada del CSV llegaba hasta aquí, y una marca de dirección
    // invisible permite disfrazar la extensión real del archivo.
    .replace(/[\\/:*?"<>|]|\p{Cc}|\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    // Windows descarta los puntos y espacios finales al crear el archivo, así
    // que «Etc.» y «Etc» acabarían siendo el mismo y uno pisaría al otro.
    .replace(/[. ]+$/, "")
  if (!cleaned) return fallback
  return WINDOWS_RESERVED_NAMES.test(cleaned) ? `${cleaned}_` : cleaned
}

/**
 * Un documento independiente por destinatario, en vez de todos concatenados.
 *
 * Concatenar sirve para imprimir de una tirada, pero no para lo que hace la
 * mayoría de quien usa esto: mandar a cada persona su informe, su dieta o su
 * certificado. Con un único archivo hay que trocearlo a mano, y con treinta
 * destinatarios eso es media tarde.
 *
 * `nameField` decide cómo se llama cada archivo; si la columna no existe o
 * viene vacía, se cae al número de fila para que nunca se pisen entre sí.
 */
export function buildMailMergeDocuments(
  templateHtml: string,
  records: Array<Record<string, string>>,
  nameField?: string
): MailMergeDocument[] {
  /**
   * Nombres ya repartidos, en minúsculas: Windows y macOS no distinguen
   * mayúsculas, así que «ana» y «Ana» son dos entradas del ZIP pero un único
   * archivo al descomprimirlo, y la segunda pisaría a la primera.
   */
  const taken = new Set<string>()
  /** Último sufijo probado por nombre base, para no recorrerlos desde uno. */
  const lastSuffix = new Map<string, number>()

  const uniqueName = (base: string) => {
    const key = base.toLocaleLowerCase()
    let suffix = lastSuffix.get(key) ?? 1
    let candidate = base
    // El bucle, y no un simple contador, porque el nombre desambiguado puede
    // existir por sí mismo en los datos: una fila llamada literalmente «Ana (2)».
    while (taken.has(candidate.toLocaleLowerCase())) {
      suffix += 1
      candidate = `${base} (${suffix})`
    }
    lastSuffix.set(key, suffix)
    taken.add(candidate.toLocaleLowerCase())
    return candidate
  }

  return records.map((record, index) => {
    const result = applyMailMergeRecord(templateHtml, record)
    const rawName = nameField
      ? (Object.entries(record).find(
          ([field]) =>
            field.trim().toLocaleLowerCase() ===
            nameField.trim().toLocaleLowerCase()
        )?.[1] ?? "")
      : ""
    const base = toSafeFileName(rawName, `documento-${index + 1}`)
    return {
      html: result.html,
      name: uniqueName(base),
      missingFields: result.missingFields,
    }
  })
}

export function buildMailMergeBatchHtml(
  templateHtml: string,
  records: Array<Record<string, string>>
): MailMergeResult {
  const missingFields = new Set<string>()
  const html = records
    .map((record) => {
      const result = applyMailMergeRecord(templateHtml, record)
      for (const field of result.missingFields) missingFields.add(field)
      return result.html
    })
    .join('<div data-page-break="true"></div>')
  return { html, missingFields: [...missingFields] }
}
