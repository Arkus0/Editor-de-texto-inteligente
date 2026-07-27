const NON_SYNONYM_RELATION =
  /\s+\((?:antonym|generic term|related term|cause|attribute|part|member|substance|derivative)\)$/i

function normalizeTerm(value, locale = "es") {
  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase(locale)
}

function normalizeWithoutDiacritics(value, locale) {
  return normalizeTerm(value, locale)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

function parseMeaningLine(line, query, locale) {
  const [rawLabel, ...rawSynonyms] = line.replace(/\r$/, "").split("|")
  const seen = new Set()
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

function parseMyThesText(text, query, language = "es-ES") {
  const locale = language.split("-")[0] || "es"
  const normalizedQuery = normalizeTerm(query, locale)
  const relaxedQuery = normalizeWithoutDiacritics(query, locale)
  const lines = text.split("\n")
  let relaxedMatch = null

  for (let index = 1; index < lines.length; ) {
    const header = (lines[index] || "").replace(/\r$/, "")
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
        .filter(Boolean)
        .slice(0, 12)
      if (exact) return { word, meanings }
      if (!relaxedMatch) relaxedMatch = { word, meanings }
    }
    index += count + 1
  }

  return relaxedMatch || { word: query.trim(), meanings: [] }
}

function decodeMyThes(buffer) {
  const headerEnd = buffer.indexOf(10)
  const header = buffer
    .subarray(0, headerEnd >= 0 ? headerEnd : 32)
    .toString("ascii")
    .trim()
    .toLocaleUpperCase()
  const encoding =
    header.includes("ISO8859-1") || header.includes("ISO-8859-1")
      ? "latin1"
      : "utf8"
  return buffer.toString(encoding)
}

module.exports = {
  decodeMyThes,
  parseMyThesText,
}
