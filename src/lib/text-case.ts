export type TextCaseMode = "sentence" | "lower" | "upper" | "title" | "toggle"

const MINOR_WORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "o", "a", "en", "un", "una",
  "the", "of", "and", "or", "a", "an", "in", "on", "for", "to",
])

/**
 * Se crea en cada llamada a propósito: una expresión con `g` guarda su
 * `lastIndex`, y compartir la misma instancia entre el recuento y la
 * sustitución deja el resultado a merced del orden de las llamadas.
 */
const wordPattern = () => /\p{L}[\p{L}'’]*/gu

function toTitleCase(text: string): string {
  /**
   * Dónde empieza la última palabra.
   *
   * Antes se daba por última la que terminaba justo al final de la cadena, y
   * eso hacía que un punto, unas comillas o un simple espacio de más cambiaran
   * el resultado: «The World We Live In» pasaba a «The World We Live in.» solo
   * por cerrar la frase. La primera y la última palabra van siempre en
   * mayúscula, se escriba o no puntuación detrás.
   */
  const lastWordOffset = [...text.matchAll(wordPattern())].at(-1)?.index ?? -1

  let isFirstWord = true
  return text.replace(wordPattern(), (word, offset: number) => {
    const lower = word.toLowerCase()
    const isLast = offset === lastWordOffset
    const keepLower = !isFirstWord && !isLast && MINOR_WORDS.has(lower)
    isFirstWord = false
    if (keepLower) return lower
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
}

function toSentenceCase(text: string): string {
  const lower = text.toLowerCase()
  let capitalizeNext = true
  return lower.replace(/\p{L}|[.!?]/gu, (char) => {
    if (/[.!?]/.test(char)) {
      capitalizeNext = true
      return char
    }
    if (capitalizeNext) {
      capitalizeNext = false
      return char.toUpperCase()
    }
    return char
  })
}

function toggleCase(text: string): string {
  return Array.from(text)
    .map((char) =>
      char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()
    )
    .join("")
}

export function transformCase(text: string, mode: TextCaseMode): string {
  switch (mode) {
    case "sentence":
      return toSentenceCase(text)
    case "lower":
      return text.toLowerCase()
    case "upper":
      return text.toUpperCase()
    case "title":
      return toTitleCase(text)
    case "toggle":
      return toggleCase(text)
    default:
      return text
  }
}

export const TEXT_CASE_OPTIONS: Array<{ mode: TextCaseMode; label: string }> = [
  { mode: "sentence", label: "Tipo oración." },
  { mode: "lower", label: "minúsculas" },
  { mode: "upper", label: "MAYÚSCULAS" },
  { mode: "title", label: "Poner En Mayúsculas Cada Palabra" },
  { mode: "toggle", label: "iNVERTIR MAYÚSC/MINÚSC" },
]
