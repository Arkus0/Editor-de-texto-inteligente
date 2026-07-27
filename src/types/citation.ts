export type CitationStyle = string
export type CitationMode = "parenthetical" | "narrative" | "note"
export type CitationLocatorLabel =
  | "page"
  | "chapter"
  | "section"
  | "paragraph"
  | "figure"
  | "table"
  | "volume"
  | "issue"
  | "line"

export interface CitationAttachment {
  key: string
  title: string
  filename: string
  contentType: string
  parentItem: string
  url?: string
  version?: number
}

export interface ZoteroSourceLink {
  mode: "local" | "web"
  libraryType: "user" | "group"
  libraryId: string
  itemKey: string
  version: number
  dateModified?: string
}

export interface CitationSource {
  id: string
  author: string
  title: string
  year: string
  publisher: string
  url: string
  doi?: string
  isbn?: string
  zoteroKeys?: string[]
  zoteroLinks?: ZoteroSourceLink[]
  zoteroDeleted?: boolean
  itemType?: string
  abstract?: string
  volume?: string
  issue?: string
  pages?: string
  edition?: string
  language?: string
  collections?: string[]
  tags?: string[]
  attachments?: CitationAttachment[]
}

export interface CitationClusterItem {
  sourceId: string
  locator?: string
  label?: CitationLocatorLabel
  prefix?: string
  suffix?: string
  suppressAuthor?: boolean
}

export interface CitationCluster {
  id: string
  mode: CitationMode
  items: CitationClusterItem[]
}

export interface CslStyleDefinition {
  id: string
  title: string
  class: "in-text" | "note"
  xml?: string
}

export interface CslStylePreset {
  id: string
  label: string
  group: "Humanidades y sociales" | "Ciencias y salud" | "Derecho y normas"
}

export const ACADEMIC_CSL_STYLE_PRESETS: readonly CslStylePreset[] = [
  { id: "apa", label: "APA 7", group: "Humanidades y sociales" },
  {
    id: "modern-language-association",
    label: "MLA 9",
    group: "Humanidades y sociales",
  },
  {
    id: "chicago-author-date-17th-edition",
    label: "Chicago 17 · autor-fecha",
    group: "Humanidades y sociales",
  },
  {
    id: "chicago-notes-bibliography",
    label: "Chicago 18 · notas",
    group: "Humanidades y sociales",
  },
  {
    id: "turabian-notes-bibliography",
    label: "Turabian 9 · notas",
    group: "Humanidades y sociales",
  },
  {
    id: "harvard-cite-them-right",
    label: "Harvard · Cite Them Right 12",
    group: "Humanidades y sociales",
  },
  {
    id: "nlm-citation-sequence",
    label: "Vancouver / NLM",
    group: "Ciencias y salud",
  },
  { id: "ieee", label: "IEEE", group: "Ciencias y salud" },
  {
    id: "american-medical-association",
    label: "AMA 11",
    group: "Ciencias y salud",
  },
  {
    id: "american-chemical-society",
    label: "ACS 2022",
    group: "Ciencias y salud",
  },
  { id: "oscola", label: "OSCOLA 4", group: "Derecho y normas" },
  {
    id: "iso690-author-date-es",
    label: "ISO 690 · autor-fecha · español",
    group: "Derecho y normas",
  },
] as const

export const CSL_LOCALE_OPTIONS = [
  { value: "es-ES", label: "Español" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "it-IT", label: "Italiano" },
  { value: "pt-PT", label: "Português" },
] as const

export interface ZoteroLibrarySyncState {
  mode: "local" | "web"
  libraryType: "user" | "group"
  libraryId: string
  libraryVersion: number
  lastSyncedAt: string
}

export interface DocumentBibliography {
  style: CitationStyle
  styleTitle?: string
  styleClass?: "in-text" | "note"
  cslXml?: string
  locale?: string
  sources: CitationSource[]
  zoteroSync?: Record<string, ZoteroLibrarySyncState>
}

export interface DuplicateCandidate {
  source: CitationSource
  score: number
  confidence: "exact" | "high" | "possible"
  reasons: string[]
}

export interface DuplicateGroup {
  canonical: CitationSource
  duplicates: DuplicateCandidate[]
}

export interface DeduplicationResult {
  sources: CitationSource[]
  replacements: Record<string, string>
  mergedCount: number
}

export const EMPTY_BIBLIOGRAPHY: DocumentBibliography = {
  style: "apa",
  styleTitle: "APA Style 7th edition",
  styleClass: "in-text",
  locale: "es-ES",
  sources: [],
  zoteroSync: {},
}

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
])

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function normalizeTitle(value: string) {
  return normalizeText(value)
}

function normalizeAuthor(value: string) {
  return normalizeText(value)
    .replace(/\b(and|y|et al)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function authorSurname(value: string) {
  const firstAuthor = value.split(/[;|]|\band\b/i)[0]?.trim() ?? ""
  const commaSurname = firstAuthor.split(",")[0]?.trim()
  if (firstAuthor.includes(",") && commaSurname) return normalizeText(commaSurname)
  return normalizeText(firstAuthor).split(" ").filter(Boolean).at(-1) ?? ""
}

export function normalizeDoi(value: string) {
  const decoded = (() => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  })()
  const match = decoded.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)
  return match?.[0]
    ?.toLowerCase()
    .replace(/[),.;\]}]+$/g, "")
    .trim() ?? ""
}

export function normalizeIsbn(value: string) {
  const match = value.toUpperCase().match(/(?:97[89][\d\-\s]{10,16}|[\dX][\dX\-\s]{8,15})/)
  if (!match) return ""
  const compact = match[0].replace(/[^\dX]/g, "")
  return compact.length === 10 || compact.length === 13 ? compact : ""
}

export function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed || normalizeDoi(trimmed)) return ""
  try {
    const url = new URL(
      /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    )
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.delete(key)
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    const path = url.pathname.replace(/\/+$/, "")
    const query = url.searchParams.toString()
    return `${host}${path}${query ? `?${query}` : ""}`.toLowerCase()
  } catch {
    return normalizeText(trimmed)
  }
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean))
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection++
  }
  return intersection / new Set([...leftTokens, ...rightTokens]).size
}

function sourceDoi(source: CitationSource) {
  return normalizeDoi(source.doi ?? "") || normalizeDoi(source.url)
}

function sourceIsbn(source: CitationSource) {
  return normalizeIsbn(source.isbn ?? "") || normalizeIsbn(source.url)
}

export function compareCitationSources(
  incoming: CitationSource,
  existing: CitationSource
): DuplicateCandidate {
  const reasons: string[] = []
  const incomingDoi = sourceDoi(incoming)
  const existingDoi = sourceDoi(existing)
  if (incomingDoi && existingDoi && incomingDoi === existingDoi) {
    return {
      source: existing,
      score: 100,
      confidence: "exact",
      reasons: ["Mismo DOI"],
    }
  }

  const incomingIsbn = sourceIsbn(incoming)
  const existingIsbn = sourceIsbn(existing)
  if (incomingIsbn && existingIsbn && incomingIsbn === existingIsbn) {
    return {
      source: existing,
      score: 100,
      confidence: "exact",
      reasons: ["Mismo ISBN"],
    }
  }

  const incomingUrl = normalizeUrl(incoming.url)
  const existingUrl = normalizeUrl(existing.url)
  if (incomingUrl && existingUrl && incomingUrl === existingUrl) {
    reasons.push("Misma URL canónica")
  }

  const leftTitle = normalizeTitle(incoming.title)
  const rightTitle = normalizeTitle(existing.title)
  const titleExact = Boolean(leftTitle && leftTitle === rightTitle)
  const titleScore = tokenSimilarity(leftTitle, rightTitle)
  const leftSurname = authorSurname(incoming.author)
  const rightSurname = authorSurname(existing.author)
  const authorExact = Boolean(leftSurname && leftSurname === rightSurname)
  const fullAuthorExact =
    Boolean(incoming.author.trim() && existing.author.trim()) &&
    normalizeAuthor(incoming.author) === normalizeAuthor(existing.author)
  const authorScore = tokenSimilarity(incoming.author, existing.author)
  const yearExact = Boolean(
    incoming.year.trim() &&
      existing.year.trim() &&
      incoming.year.trim().slice(0, 4) === existing.year.trim().slice(0, 4)
  )

  let score = 0
  if (titleExact) {
    score += 72
    reasons.push("Mismo título normalizado")
  } else if (titleScore >= 0.92) {
    score += 62
    reasons.push("Título casi idéntico")
  } else if (titleScore >= 0.8) {
    score += 48
    reasons.push("Título muy parecido")
  }
  if (fullAuthorExact) {
    score += 16
    reasons.push("Mismos autores")
  } else if (authorScore >= 0.8) {
    score += 13
    reasons.push("Autores equivalentes")
  } else if (authorExact) {
    score += 11
    reasons.push("Mismo primer autor")
  }
  if (yearExact) {
    score += 10
    reasons.push("Mismo año")
  }
  if (incomingUrl && existingUrl && incomingUrl === existingUrl) score += 20
  if (
    incoming.publisher.trim() &&
    existing.publisher.trim() &&
    normalizeText(incoming.publisher) === normalizeText(existing.publisher)
  ) {
    score += 3
    reasons.push("Misma publicación")
  }

  score = Math.min(100, score)
  return {
    source: existing,
    score,
    confidence: score >= 95 ? "exact" : score >= 84 ? "high" : "possible",
    reasons,
  }
}

export function findDuplicateCandidates(
  sources: CitationSource[],
  incoming: CitationSource,
  minimumScore = 72
) {
  return sources
    .filter((source) => source.id !== incoming.id)
    .map((source) => compareCitationSources(incoming, source))
    .filter((candidate) => candidate.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
}

export function findBestDuplicate(
  sources: CitationSource[],
  incoming: CitationSource,
  minimumScore = 72
) {
  return findDuplicateCandidates(sources, incoming, minimumScore)[0]
}

function richerValue(left: string | undefined, right: string | undefined) {
  const current = left?.trim() ?? ""
  const candidate = right?.trim() ?? ""
  if (!current) return candidate
  if (!candidate) return current
  return candidate.length > current.length ? candidate : current
}

export function mergeCitationSources(
  canonical: CitationSource,
  duplicate: CitationSource,
  choices: Partial<Record<keyof CitationSource, "canonical" | "duplicate">> = {}
): CitationSource {
  const doi = sourceDoi(canonical) || sourceDoi(duplicate)
  const isbn = sourceIsbn(canonical) || sourceIsbn(duplicate)
  const choose = <Key extends keyof CitationSource>(
    key: Key,
    fallback: CitationSource[Key]
  ) =>
    choices[key] === "duplicate"
      ? duplicate[key]
      : choices[key] === "canonical"
        ? canonical[key]
        : fallback
  return {
    id: canonical.id,
    author: String(
      choose("author", canonical.author.trim() || duplicate.author.trim()) ?? ""
    ),
    title: String(
      choose("title", canonical.title.trim() || duplicate.title.trim()) ?? ""
    ),
    year: String(
      choose("year", canonical.year.trim() || duplicate.year.trim()) ?? ""
    ),
    publisher: String(
      choose(
        "publisher",
        richerValue(canonical.publisher, duplicate.publisher)
      ) ?? ""
    ),
    url: String(
      choose("url", richerValue(canonical.url, duplicate.url)) ?? ""
    ),
    doi: (choose("doi", doi || undefined) as string | undefined) || undefined,
    isbn:
      (choose("isbn", isbn || undefined) as string | undefined) || undefined,
    zoteroKeys: [
      ...new Set([
        ...(canonical.zoteroKeys ?? []),
        ...(duplicate.zoteroKeys ?? []),
      ]),
    ],
    zoteroLinks: [
      ...new Map(
        [...(canonical.zoteroLinks ?? []), ...(duplicate.zoteroLinks ?? [])].map(
          (link) => [
            `${link.mode}:${link.libraryType}:${link.libraryId}:${link.itemKey}`,
            link,
          ]
        )
      ).values(),
    ],
    zoteroDeleted: canonical.zoteroDeleted && duplicate.zoteroDeleted,
    itemType: String(
      choose(
        "itemType",
        richerValue(canonical.itemType, duplicate.itemType)
      ) ?? ""
    ) || undefined,
    abstract: String(
      choose("abstract", richerValue(canonical.abstract, duplicate.abstract)) ??
        ""
    ) || undefined,
    volume: String(
      choose("volume", richerValue(canonical.volume, duplicate.volume)) ?? ""
    ) || undefined,
    issue: String(
      choose("issue", richerValue(canonical.issue, duplicate.issue)) ?? ""
    ) || undefined,
    pages: String(
      choose("pages", richerValue(canonical.pages, duplicate.pages)) ?? ""
    ) || undefined,
    edition: String(
      choose("edition", richerValue(canonical.edition, duplicate.edition)) ?? ""
    ) || undefined,
    language: String(
      choose("language", richerValue(canonical.language, duplicate.language)) ??
        ""
    ) || undefined,
    collections: [
      ...new Set([
        ...(canonical.collections ?? []),
        ...(duplicate.collections ?? []),
      ]),
    ],
    tags: [
      ...new Set([...(canonical.tags ?? []), ...(duplicate.tags ?? [])]),
    ],
    attachments: [
      ...new Map(
        [
          ...(canonical.attachments ?? []),
          ...(duplicate.attachments ?? []),
        ].map((attachment) => [attachment.key, attachment])
      ).values(),
    ],
  }
}

export function deduplicateCitationSources(
  sources: CitationSource[],
  automaticThreshold = 92
): DeduplicationResult {
  const unique: CitationSource[] = []
  const replacements: Record<string, string> = {}
  let mergedCount = 0

  for (const source of sources) {
    const stableIdentityIndex = unique.findIndex(
      (candidate) => candidate.id === source.id
    )
    if (stableIdentityIndex >= 0) {
      unique[stableIdentityIndex] = mergeCitationSources(
        unique[stableIdentityIndex],
        source
      )
      mergedCount++
      continue
    }
    const duplicate = findBestDuplicate(unique, source, automaticThreshold)
    if (!duplicate) {
      unique.push(source)
      continue
    }
    const index = unique.findIndex(
      (candidate) => candidate.id === duplicate.source.id
    )
    unique[index] = mergeCitationSources(unique[index], source)
    replacements[source.id] = unique[index].id
    mergedCount++
  }

  return { sources: unique, replacements, mergedCount }
}

export function findDuplicateGroups(
  sources: CitationSource[],
  minimumScore = 72
): DuplicateGroup[] {
  const claimed = new Set<string>()
  const groups: DuplicateGroup[] = []
  for (const source of sources) {
    if (claimed.has(source.id)) continue
    const duplicates = findDuplicateCandidates(
      sources.filter((candidate) => !claimed.has(candidate.id)),
      source,
      minimumScore
    )
    if (duplicates.length === 0) continue
    groups.push({ canonical: source, duplicates })
    for (const duplicate of duplicates) claimed.add(duplicate.source.id)
  }
  return groups
}

function shortHash(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6)
}

export function citationIdentityKey(source: CitationSource) {
  const doi = sourceDoi(source)
  if (doi) return `doi:${doi}`
  const isbn = sourceIsbn(source)
  if (isbn) return `isbn:${isbn}`
  const url = normalizeUrl(source.url)
  if (url) return `url:${url}`
  return [
    normalizeTitle(source.title),
    authorSurname(source.author),
    source.year.trim().slice(0, 4),
  ].join("|")
}

export function citationDisplayCode(source: CitationSource) {
  const surname = authorSurname(source.author).slice(0, 3).toUpperCase() || "REF"
  const year = source.year.match(/\d{4}/)?.[0] ?? "SF"
  return `${surname}${year}-${shortHash(citationIdentityKey(source))}`
}

export function createCitationSource(
  source: Omit<CitationSource, "id">,
  id = globalThis.crypto?.randomUUID?.() ??
    `source-${Date.now()}-${Math.random().toString(36).slice(2)}`
): CitationSource {
  const doi = normalizeDoi(source.doi ?? "") || normalizeDoi(source.url)
  const isbn = normalizeIsbn(source.isbn ?? "") || normalizeIsbn(source.url)
  return {
    ...source,
    id,
    author: source.author.trim(),
    title: source.title.trim(),
    year: source.year.trim(),
    publisher: source.publisher.trim(),
    url: source.url.trim(),
    doi: doi || undefined,
    isbn: isbn || undefined,
    zoteroKeys: source.zoteroKeys
      ? [...new Set(source.zoteroKeys.filter(Boolean))]
      : undefined,
    zoteroLinks: source.zoteroLinks
      ? [...new Map(
          source.zoteroLinks.map((link) => [
            `${link.mode}:${link.libraryType}:${link.libraryId}:${link.itemKey}`,
            link,
          ])
        ).values()]
      : undefined,
    collections: source.collections
      ? [...new Set(source.collections.filter(Boolean))]
      : undefined,
    tags: source.tags ? [...new Set(source.tags.filter(Boolean))] : undefined,
    attachments: source.attachments
      ? [...new Map(
          source.attachments.map((attachment) => [
            attachment.key,
            attachment,
          ])
        ).values()]
      : undefined,
  }
}

function locatorSuffix(item: CitationClusterItem) {
  if (!item.locator?.trim()) return ""
  const labels: Partial<Record<CitationLocatorLabel, string>> = {
    page: "p.",
    chapter: "cap.",
    section: "§",
    paragraph: "párr.",
    figure: "fig.",
    table: "tabla",
    volume: "vol.",
    issue: "núm.",
    line: "l.",
  }
  return `, ${labels[item.label ?? "page"] ?? item.label} ${item.locator.trim()}`
}

export function formatInlineCitation(
  source: CitationSource,
  style: CitationStyle,
  item?: CitationClusterItem,
  mode: CitationMode = "parenthetical"
) {
  const author = source.author.trim() || source.title.trim() || "Sin autor"
  const surname = author.includes(",")
    ? author.split(",")[0]
    : author.split(/\s+/).at(-1)
  const locator = item ? locatorSuffix(item) : ""
  if (mode === "narrative") {
    return `${surname} (${source.year || "s. f."}${locator})`
  }
  if (style === "mla") {
    return `(${surname}${source.year ? ` ${source.year}` : ""}${locator})`
  }
  if (style === "chicago")
    return `(${surname} ${source.year || "s. f."}${locator})`
  return `(${surname}, ${source.year || "s. f."}${locator})`
}

export function formatCitationClusterFallback(
  cluster: CitationCluster,
  sources: CitationSource[],
  style: CitationStyle
) {
  const byId = new Map(sources.map((source) => [source.id, source]))
  const rendered = cluster.items
    .map((item) => {
      const source = byId.get(item.sourceId)
      if (!source) return ""
      const label = formatInlineCitation(
        source,
        style,
        item,
        cluster.mode === "narrative" && cluster.items.length === 1
          ? "narrative"
          : "parenthetical"
      )
      return `${item.prefix?.trim() ? `${item.prefix.trim()} ` : ""}${label}${
        item.suffix?.trim() ? ` ${item.suffix.trim()}` : ""
      }`
    })
    .filter(Boolean)
  if (rendered.length <= 1) return rendered[0] ?? "(Referencia)"
  return `(${rendered
    .map((label) => label.replace(/^\(|\)$/g, ""))
    .join("; ")})`
}

export function formatBibliographyEntry(
  source: CitationSource,
  style: CitationStyle
) {
  const author = source.author.trim() || "Sin autor"
  const year = source.year.trim() || "s. f."
  const title = source.title.trim().replace(/[.]+$/g, "")
  const publisher = source.publisher.trim().replace(/[.]+$/g, "")
  const url = source.doi
    ? `https://doi.org/${normalizeDoi(source.doi)}`
    : source.url.trim()
  if (style === "mla") {
    const publication = [publisher, source.year.trim()]
      .filter(Boolean)
      .join(", ")
    return `${author}. “${title}”.${publication ? ` ${publication}.` : ""}${url ? ` ${url}.` : ""}`
  }
  if (style === "chicago") {
    return `${author}. ${year}. “${title}”.${publisher ? ` ${publisher}.` : ""}${url ? ` ${url}.` : ""}`
  }
  return `${author}. (${year}). ${title}.${publisher ? ` ${publisher}.` : ""}${url ? ` ${url}` : ""}`
}

export function sortCitationSources(sources: CitationSource[]) {
  return [...sources].sort((left, right) => {
    const author = left.author.localeCompare(right.author, "es", {
      sensitivity: "base",
    })
    if (author !== 0) return author
    const year = left.year.localeCompare(right.year, "es")
    if (year !== 0) return year
    return left.title.localeCompare(right.title, "es", {
      sensitivity: "base",
    })
  })
}

function creatorToCsl(author: string) {
  return author
    .split(/\s*;\s*|\s+and\s+/i)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (value.includes(",")) {
        const [family, ...given] = value.split(",")
        return { family: family.trim(), given: given.join(",").trim() }
      }
      const parts = value.split(/\s+/)
      return {
        family: parts.pop() ?? value,
        given: parts.join(" "),
      }
    })
}

export function citationSourceToCsl(source: CitationSource) {
  const year = Number.parseInt(source.year.match(/\d{4}/)?.[0] ?? "", 10)
  return {
    id: source.id,
    type:
      source.itemType === "journalArticle"
        ? "article-journal"
        : source.itemType === "bookSection"
          ? "chapter"
          : source.itemType === "conferencePaper"
            ? "paper-conference"
            : source.itemType === "thesis"
              ? "thesis"
              : source.itemType === "webpage"
                ? "webpage"
                : "book",
    title: source.title,
    author: creatorToCsl(source.author),
    issued: Number.isFinite(year) ? { "date-parts": [[year]] } : undefined,
    publisher: source.publisher || undefined,
    "container-title": source.publisher || undefined,
    volume: source.volume || undefined,
    issue: source.issue || undefined,
    page: source.pages || undefined,
    edition: source.edition || undefined,
    language: source.language || undefined,
    DOI: source.doi || undefined,
    ISBN: source.isbn || undefined,
    URL: source.url || undefined,
  }
}
