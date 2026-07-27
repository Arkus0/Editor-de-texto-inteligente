export interface ThesaurusMeaning {
  label: string
  synonyms: string[]
}

export interface ThesaurusLookupResult {
  word: string
  language: string
  source: "libreoffice-mythes"
  available: boolean
  meanings: ThesaurusMeaning[]
}

const NON_SYNONYM_RELATION =
  /\s+\((?:antonym|generic term|related term|cause|attribute|part|member|substance|derivative)\)$/i

function normalizeTerm(value: string, locale = "es") {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase(locale)
}

function normalizeWithoutDiacritics(value: string, locale: string) {
  return normalizeTerm(value, locale)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function parseMeaningLine(
  line: string,
  query: string,
  locale: string
): ThesaurusMeaning | null {
  const [rawLabel, ...rawSynonyms] = line.replace(/\r$/, "").split("|")
  const seen = new Set<string>()
  const normalizedQuery = normalizeTerm(query, locale)
  const synonyms = rawSynonyms
    .map((term) => term.trim())
    .filter(
      (term) =>
        term &&
        !NON_SYNONYM_RELATION.test(term) &&
        normalizeTerm(term, locale) !== normalizedQuery
    )
    .filter((term) => {
      const key = normalizeTerm(term, locale)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 40)

  if (synonyms.length === 0) return null
  return {
    label:
      rawLabel.trim() === "-"
        ? "Sinónimos"
        : rawLabel.trim().replace(/^\((.+)\)$/, "$1"),
    synonyms,
  }
}

export function parseMyThesText(
  text: string,
  query: string,
  language = "es-ES"
): ThesaurusLookupResult {
  const locale = language.split("-")[0] || "es"
  const normalizedQuery = normalizeTerm(query, locale)
  if (!normalizedQuery) {
    return {
      word: "",
      language,
      source: "libreoffice-mythes",
      available: true,
      meanings: [],
    }
  }

  const relaxedQuery = normalizeWithoutDiacritics(query, locale)
  const lines = text.split("\n")
  let relaxedMatch: { word: string; meanings: ThesaurusMeaning[] } | null =
    null

  for (let index = 1; index < lines.length; ) {
    const header = lines[index]?.replace(/\r$/, "") ?? ""
    const separator = header.lastIndexOf("|")
    const count = Number.parseInt(header.slice(separator + 1), 10)
    if (separator < 1 || !Number.isInteger(count) || count < 0) {
      index += 1
      continue
    }

    const word = header.slice(0, separator).trim()
    const normalizedWord = normalizeTerm(word, locale)
    const exact = normalizedWord === normalizedQuery
    const relaxed =
      !exact &&
      normalizeWithoutDiacritics(word, locale) === relaxedQuery

    if (exact || relaxed) {
      const meanings = lines
        .slice(index + 1, index + count + 1)
        .map((line) => parseMeaningLine(line, query, locale))
        .filter((meaning): meaning is ThesaurusMeaning => Boolean(meaning))
        .slice(0, 12)

      if (exact) {
        return {
          word,
          language,
          source: "libreoffice-mythes",
          available: true,
          meanings,
        }
      }
      if (!relaxedMatch) relaxedMatch = { word, meanings }
    }
    index += count + 1
  }

  return {
    word: relaxedMatch?.word ?? query.trim(),
    language,
    source: "libreoffice-mythes",
    available: true,
    meanings: relaxedMatch?.meanings ?? [],
  }
}

export function decodeMyThes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const headerEnd = bytes.indexOf(10)
  const header = new TextDecoder("ascii")
    .decode(bytes.slice(0, headerEnd >= 0 ? headerEnd : 32))
    .trim()
    .toLocaleUpperCase()
  const encoding =
    header.includes("ISO8859-1") || header.includes("ISO-8859-1")
      ? "iso-8859-1"
      : "utf-8"
  return new TextDecoder(encoding).decode(bytes)
}

export function thesaurusFilename(language: string) {
  const normalized = language.toLocaleLowerCase()
  if (normalized.startsWith("es")) return "th_es_v2.dat"
  if (normalized.startsWith("en")) return "th_en_US_v2.dat"
  return null
}
