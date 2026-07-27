import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

/**
 * Filtro por formato, como el botón «Formato» del cuadro de búsqueda de Word.
 *
 * Cada atributo es de tres estados: `undefined` no mira ese formato, `true`
 * exige tenerlo y `false` exige no tenerlo. Así se puede buscar «negrita»,
 * «sin negrita» o dar igual, que es exactamente lo que ofrece Word.
 */
export interface DocumentSearchFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  highlight?: boolean
  superscript?: boolean
  subscript?: boolean
}

export interface DocumentSearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  /** Coincidencias solo al principio de palabra («Coincidir prefijo» de Word). */
  matchPrefix?: boolean
  /** Coincidencias solo al final de palabra («Coincidir sufijo» de Word). */
  matchSuffix?: boolean
  format?: DocumentSearchFormat
}

export interface DocumentSearchMatch {
  from: number
  to: number
}

export const DEFAULT_SEARCH_OPTIONS: DocumentSearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
}

/**
 * Códigos del menú «Especial» de Word.
 *
 * Son la forma de buscar lo que no se puede teclear: un tabulador, un espacio
 * de no separación, un guion opcional. Sin ellos había que recurrir a una
 * expresión regular, que es pedirle demasiado a quien solo quiere limpiar los
 * tabuladores de un documento pegado desde otro sitio.
 *
 * No está `^p`: en este editor una coincidencia nunca cruza de un párrafo al
 * siguiente —igual que en Word, y por eso una palabra partida por el formato sí
 * se encuentra—, así que una marca de párrafo no tiene nada que casar dentro de
 * un bloque. Fingir que funciona sería peor que no ofrecerlo.
 */
const SPECIAL_CODES: Record<string, string> = {
  t: "\\t",
  l: "\\n",
  w: "[ \\t\\u00a0]+",
  "#": "\\d",
  $: "\\p{L}",
  s: "\\u00a0",
  "-": "\\u00ad",
  "~": "\\u2011",
  "^": "\\^",
}

/** Los mismos códigos, ya como texto, para el campo de reemplazo. */
const SPECIAL_REPLACEMENTS: Record<string, string> = {
  t: "\t",
  l: "\n",
  s: " ",
  "-": "­",
  "~": "‑",
  "^": "^",
}

export const SPECIAL_SEARCH_CODES: Array<{ code: string; label: string }> = [
  { code: "^t", label: "Tabulador" },
  { code: "^l", label: "Salto de línea" },
  { code: "^w", label: "Cualquier espacio en blanco" },
  { code: "^#", label: "Cualquier dígito" },
  { code: "^$", label: "Cualquier letra" },
  { code: "^s", label: "Espacio de no separación" },
  { code: "^-", label: "Guion opcional" },
  { code: "^~", label: "Guion de no separación" },
  { code: "^^", label: "Signo ^" },
]

/**
 * Traduce los códigos `^` a expresión regular y escapa el resto.
 *
 * Se recorre carácter a carácter en vez de escapar primero y sustituir después
 * porque, tras escapar, un `^t` escrito por el usuario y un `^t` que salga de
 * escapar otra cosa serían indistinguibles.
 */
function expandSpecialCodes(query: string): string {
  let source = ""
  for (let index = 0; index < query.length; index += 1) {
    const character = query[index]
    if (character === "^" && index + 1 < query.length) {
      const code = query[index + 1]
      const expansion = SPECIAL_CODES[code]
      if (expansion) {
        source += expansion
        index += 1
        continue
      }
    }
    source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  return source
}

/** Expande los códigos que tienen sentido al sustituir. */
export function expandReplacementCodes(replacement: string): string {
  let text = ""
  for (let index = 0; index < replacement.length; index += 1) {
    const character = replacement[index]
    if (character === "^" && index + 1 < replacement.length) {
      const expansion = SPECIAL_REPLACEMENTS[replacement[index + 1]]
      if (expansion !== undefined) {
        text += expansion
        index += 1
        continue
      }
    }
    text += character
  }
  return text
}

/**
 * Tope de coincidencias. Buscar « » (un espacio) en una tesis puede dar cientos
 * de miles de resultados; pintarlas todas no aporta nada y bloquea la ventana.
 */
export const MAX_SEARCH_MATCHES = 5_000

/** Marcador para lo que ocupa una posición pero no es texto: una imagen, una
 *  ecuación, una cita. Así los índices siguen cuadrando con las posiciones del
 *  documento y ninguna búsqueda los atraviesa como si no existieran. */
const INLINE_OBJECT = "￼"

export function buildSearchExpression(
  query: string,
  options: DocumentSearchOptions
): RegExp | null {
  if (!query) return null
  try {
    const source = options.regex ? query : expandSpecialCodes(query)
    // «Palabra completa» manda sobre prefijo y sufijo, como en Word: marcar las
    // tres a la vez no debe dejar una búsqueda que no encuentra nada.
    const bounded = options.wholeWord
      ? `\\b(?:${source})\\b`
      : options.matchPrefix && options.matchSuffix
        ? `\\b(?:${source})\\b`
        : options.matchPrefix
          ? `\\b(?:${source})`
          : options.matchSuffix
            ? `(?:${source})\\b`
            : source
    return new RegExp(bounded, options.caseSensitive ? "gu" : "giu")
  } catch {
    // Una expresión regular a medio escribir es lo normal mientras se teclea;
    // no buscar nada es mejor respuesta que un error.
    return null
  }
}

/**
 * Busca en el documento y devuelve posiciones de ProseMirror utilizables para
 * seleccionar o decorar.
 *
 * Trabaja bloque a bloque en vez de sobre el texto entero concatenado por dos
 * razones: una coincidencia no debe cruzar de un párrafo al siguiente —Word
 * tampoco lo hace— y el texto de un párrafo puede venir partido en varios nodos
 * por culpa del formato, de modo que buscar «hola» tiene que encontrarlo aunque
 * la mitad esté en negrita.
 */
/** Nombre de la marca del editor que corresponde a cada filtro de formato. */
const FORMAT_MARK_NAMES: Record<keyof DocumentSearchFormat, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strike",
  code: "code",
  highlight: "highlight",
  superscript: "superscript",
  subscript: "subscript",
}

/**
 * Comprueba que toda la coincidencia cumple el filtro de formato.
 *
 * Se exige a cada carácter, no al primero: buscar en negrita no debe devolver
 * una palabra en la que solo la primera letra lo esté, porque al reemplazarla
 * se perdería el formato del resto.
 */
function matchesFormat(
  marksByCharacter: Array<readonly string[]>,
  start: number,
  end: number,
  format?: DocumentSearchFormat
): boolean {
  if (!format) return true
  const required = Object.entries(format).filter(
    ([, value]) => value !== undefined
  ) as Array<[keyof DocumentSearchFormat, boolean]>
  if (required.length === 0) return true

  for (let index = start; index < end; index += 1) {
    const marks = marksByCharacter[index] ?? []
    for (const [key, expected] of required) {
      if (marks.includes(FORMAT_MARK_NAMES[key]) !== expected) return false
    }
  }
  return true
}

export function findDocumentMatches(
  doc: ProseMirrorNode,
  query: string,
  options: DocumentSearchOptions = DEFAULT_SEARCH_OPTIONS
): DocumentSearchMatch[] {
  const expression = buildSearchExpression(query, options)
  if (!expression) return []

  const matches: DocumentSearchMatch[] = []

  doc.descendants((node, position) => {
    if (matches.length >= MAX_SEARCH_MATCHES) return false
    if (!node.isTextblock) return true

    let text = ""
    const positions: number[] = []
    /** Marcas activas en cada carácter, para poder filtrar por formato. */
    const marksByCharacter: Array<readonly string[]> = []
    node.forEach((child, childOffset) => {
      const start = position + 1 + childOffset
      const markNames = child.marks.map((mark) => mark.type.name)
      if (child.isText && child.text) {
        for (let index = 0; index < child.text.length; index += 1) {
          positions.push(start + index)
          marksByCharacter.push(markNames)
        }
        text += child.text
      } else {
        for (let index = 0; index < child.nodeSize; index += 1) {
          positions.push(start + index)
          marksByCharacter.push(markNames)
        }
        // Un salto de línea manual es un salto de línea, no un objeto opaco:
        // así `^l` puede encontrarlo y una búsqueda no lo atraviesa por error.
        text +=
          child.type.name === "hardBreak"
            ? "\n".repeat(child.nodeSize)
            : INLINE_OBJECT.repeat(child.nodeSize)
      }
    })

    if (text) {
      expression.lastIndex = 0
      let match = expression.exec(text)
      while (match) {
        // Una expresión que casa con la cadena vacía avanzaría eternamente.
        if (match[0].length === 0) {
          expression.lastIndex += 1
        } else {
          const from = positions[match.index]
          const to = positions[match.index + match[0].length - 1]
          if (
            from !== undefined &&
            to !== undefined &&
            matchesFormat(
              marksByCharacter,
              match.index,
              match.index + match[0].length,
              options.format
            )
          ) {
            matches.push({ from, to: to + 1 })
          }
          if (matches.length >= MAX_SEARCH_MATCHES) return false
        }
        match = expression.exec(text)
      }
    }

    // Un bloque de texto no contiene otros bloques de texto.
    return false
  })

  return matches
}

/**
 * Índice de la coincidencia a la que saltar desde una posición del cursor.
 * `forward` busca la primera que empieza después del cursor; hacia atrás, la
 * última que empieza antes. En ambos sentidos se da la vuelta al llegar al
 * final, como en Word.
 */
export function matchIndexFromCursor(
  matches: DocumentSearchMatch[],
  cursor: number,
  forward: boolean
): number {
  if (matches.length === 0) return -1
  if (forward) {
    const next = matches.findIndex((match) => match.from >= cursor)
    return next === -1 ? 0 : next
  }
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    if (matches[index].from < cursor) return index
  }
  return matches.length - 1
}

/** Avanza o retrocede un puesto dando la vuelta. */
export function stepMatchIndex(
  current: number,
  total: number,
  forward: boolean
): number {
  if (total === 0) return -1
  if (current < 0) return forward ? 0 : total - 1
  return forward ? (current + 1) % total : (current - 1 + total) % total
}

/**
 * Texto de sustitución para una coincidencia. Con expresiones regulares se
 * respetan los grupos (`$1`, `$&`); sin ellas el reemplazo es literal, para que
 * un `$` escrito por el usuario no desaparezca.
 */
export function resolveReplacement(
  matchedText: string,
  query: string,
  replacement: string,
  options: DocumentSearchOptions
): string {
  // Sin expresiones regulares el reemplazo es literal salvo por los códigos
  // `^`, que también funcionan aquí: sustituir un tabulador por un espacio
  // necesita poder escribir el tabulador en los dos campos.
  if (!options.regex) return expandReplacementCodes(replacement)
  const expression = buildSearchExpression(query, options)
  if (!expression) return replacement
  expression.lastIndex = 0
  return matchedText.replace(expression, replacement)
}
