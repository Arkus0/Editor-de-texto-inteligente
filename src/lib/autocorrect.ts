import type { AutoCorrectSettings } from "@/types/document"

export interface AutoCorrectEdit {
  removeBefore: number
  text: string
}

interface AutoCorrectInput {
  textBefore: string
  insertedText: string
  settings: AutoCorrectSettings
  locale?: string
}

function hasWordBoundary(textBefore: string, fromLength: number) {
  const boundaryIndex = textBefore.length - fromLength - 1
  return boundaryIndex < 0 || !/[\p{L}\p{N}_]/u.test(textBefore[boundaryIndex])
}

function preserveCase(source: string, replacement: string, locale: string) {
  // Una sustitución vacía es legítima: sirve para borrar una muletilla al
  // escribirla. Sin esta salida, `replacement[0]` era `undefined` y la
  // concatenación siguiente escribía la palabra «undefined» en el documento.
  if (!replacement) return replacement
  if (
    source.length > 1 &&
    source === source.toLocaleUpperCase(locale) &&
    source !== source.toLocaleLowerCase(locale)
  ) {
    return replacement.toLocaleUpperCase(locale)
  }
  const first = source[0]
  // `"(" === "(".toUpperCase()` es cierto para todo lo que no sea una letra, así
  // que sin comparar también con la minúscula una regla como «(c) → ©» entraba
  // por esta rama sin que hubiera ninguna mayúscula que conservar.
  if (
    first &&
    first === first.toLocaleUpperCase(locale) &&
    first !== first.toLocaleLowerCase(locale)
  ) {
    return replacement[0].toLocaleUpperCase(locale) + replacement.slice(1)
  }
  return replacement
}

export function computeAutoCorrectEdit({
  textBefore,
  insertedText,
  settings,
  locale = "es-ES",
}: AutoCorrectInput): AutoCorrectEdit | null {
  if (!settings.enabled || !insertedText) return null

  if (/^[\s.,;:!?)]$/.test(insertedText)) {
    for (const replacement of [...settings.replacements].sort(
      (left, right) => right.from.length - left.from.length
    )) {
      const source = textBefore.slice(-replacement.from.length)
      const matches = replacement.caseSensitive
        ? source === replacement.from
        : source.toLocaleLowerCase(locale) ===
          replacement.from.toLocaleLowerCase(locale)
      if (
        matches &&
        hasWordBoundary(textBefore, replacement.from.length)
      ) {
        return {
          removeBefore: replacement.from.length,
          text: `${
            replacement.caseSensitive
              ? replacement.to
              : preserveCase(source, replacement.to, locale)
          }${insertedText}`,
        }
      }
    }
  }

  if (
    settings.smartDashes &&
    insertedText === "-" &&
    textBefore.endsWith("-")
  ) {
    return { removeBefore: 1, text: "—" }
  }

  if (settings.smartQuotes && insertedText === '"') {
    const opening = !textBefore || /[\s([{«]$/.test(textBefore)
    return { removeBefore: 0, text: opening ? "“" : "”" }
  }

  if (settings.smartQuotes && insertedText === "'") {
    const previous = textBefore.at(-1) ?? ""
    const opening = !previous || /[\s([{]$/.test(previous)
    return { removeBefore: 0, text: opening ? "‘" : "’" }
  }

  if (
    settings.capitalizeSentences &&
    /^\p{Ll}$/u.test(insertedText) &&
    (/^\s*$/.test(textBefore) || /[.!?]\s+$/.test(textBefore))
  ) {
    return {
      removeBefore: 0,
      text: insertedText.toLocaleUpperCase(locale),
    }
  }

  return null
}
