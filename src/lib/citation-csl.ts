import type {
  CitationCluster,
  CitationSource,
  ZoteroSourceLink,
} from "@/types/citation"

/**
 * Conversión de una fuente del documento a CSL-JSON, el formato que entienden
 * `citeproc` y Zotero.
 *
 * Replica el mapeo que el proceso principal usa para dar formato a las citas
 * (`sourceToCslJson` en `electron/main.cjs`). Se mantiene aquí en TypeScript
 * porque la exportación a DOCX corre en el renderizador y no puede llamar a
 * CommonJS del proceso principal; si se cambia el mapeo, hay que cambiar los
 * dos, y por eso este módulo tiene pruebas que fijan el resultado.
 */

/** Tipos de Zotero traducidos a tipos CSL. */
const CSL_TYPE_BY_ITEM_TYPE: Record<string, string> = {
  journalArticle: "article-journal",
  bookSection: "chapter",
  conferencePaper: "paper-conference",
  thesis: "thesis",
  webpage: "webpage",
  report: "report",
  manuscript: "manuscript",
  newspaperArticle: "article-newspaper",
  magazineArticle: "article-magazine",
}

export interface CslName {
  family: string
  given: string
}

export interface CslItem {
  id: string
  type: string
  title: string
  author?: CslName[]
  issued?: { "date-parts": number[][] }
  publisher?: string
  "container-title"?: string
  volume?: string
  issue?: string
  page?: string
  edition?: string
  language?: string
  DOI?: string
  ISBN?: string
  URL?: string
  abstract?: string
}

/**
 * Separa «Apellido, Nombre» y «Nombre Apellido», que son las dos formas en que
 * llegan los autores según los escriba el usuario o los importe Zotero.
 */
export function parseCreators(author: string): CslName[] {
  return String(author ?? "")
    .split(/\s*;\s*|\s+and\s+/i)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (value.includes(",")) {
        const [family, ...given] = value.split(",")
        return { family: family.trim(), given: given.join(",").trim() }
      }
      const parts = value.split(/\s+/)
      return { family: parts.pop() ?? value, given: parts.join(" ") }
    })
}

function orUndefined(value: unknown): string | undefined {
  const text = String(value ?? "").trim()
  return text || undefined
}

export function sourceToCslJson(source: CitationSource): CslItem {
  const year = Number.parseInt(
    String(source.year ?? "").match(/\d{4}/)?.[0] ?? "",
    10
  )
  const itemType = String(source.itemType ?? "")
  const creators = parseCreators(source.author)
  return {
    id: String(source.id),
    type: CSL_TYPE_BY_ITEM_TYPE[itemType] ?? "book",
    title: String(source.title ?? ""),
    author: creators.length ? creators : undefined,
    issued: Number.isFinite(year) ? { "date-parts": [[year]] } : undefined,
    publisher: orUndefined(source.publisher),
    "container-title": orUndefined(source.publisher),
    volume: orUndefined(source.volume),
    issue: orUndefined(source.issue),
    page: orUndefined(source.pages),
    edition: orUndefined(source.edition),
    language: orUndefined(source.language),
    DOI: orUndefined(source.doi),
    ISBN: orUndefined(source.isbn),
    URL: orUndefined(source.url),
  }
}

/**
 * Identificador global de un elemento de Zotero.
 *
 * Es la pieza por la que Zotero reconoce una cita como suya al abrir el
 * documento: coteja este URI contra su base local y, si lo encuentra, puede
 * actualizarla, editarla y regenerar la bibliografía. Sin él, una cita
 * exportada es texto muerto aunque se vea igual.
 */
export function zoteroItemUri(link: ZoteroSourceLink): string {
  const segment = link.libraryType === "group" ? "groups" : "users"
  return `http://zotero.org/${segment}/${link.libraryId}/items/${link.itemKey}`
}

/** Todos los URIs conocidos de una fuente, sin repetir y en orden estable. */
export function zoteroUrisForSource(source: CitationSource): string[] {
  const links = source.zoteroLinks ?? []
  return [...new Set(links.map(zoteroItemUri))]
}

export interface ZoteroCitationItem {
  id: string
  uris: string[]
  itemData: CslItem
  locator?: string
  label?: string
  prefix?: string
  suffix?: string
  "suppress-author"?: boolean
}

export interface ZoteroCitationPayload {
  citationID: string
  properties: {
    formattedCitation: string
    plainCitation: string
    noteIndex: number
  }
  citationItems: ZoteroCitationItem[]
  schema: string
}

const CSL_CITATION_SCHEMA =
  "https://github.com/citation-style-language/schema/raw/master/csl-citation.json"

/**
 * Contenido del campo `ZOTERO_ITEM CSL_CITATION` de un grupo de citas.
 *
 * `noteIndex` vale 0 para las citas en el texto y el número de nota cuando el
 * estilo las lleva a pie de página; Zotero lo usa para saber si debe recolocar
 * la cita al refrescar.
 */
export function buildZoteroCitationPayload(
  cluster: Pick<CitationCluster, "id" | "mode" | "items">,
  sourcesById: Map<string, CitationSource>,
  formatted: string,
  noteIndex = 0
): ZoteroCitationPayload {
  const citationItems: ZoteroCitationItem[] = []
  for (const item of cluster.items ?? []) {
    const source = sourcesById.get(item.sourceId)
    if (!source) continue
    citationItems.push({
      id: String(source.id),
      uris: zoteroUrisForSource(source),
      itemData: sourceToCslJson(source),
      locator: orUndefined(item.locator),
      label: orUndefined(item.label),
      prefix: orUndefined(item.prefix),
      suffix: orUndefined(item.suffix),
      "suppress-author":
        Boolean(item.suppressAuthor) || cluster.mode === "narrative"
          ? true
          : undefined,
    })
  }
  return {
    citationID: cluster.id,
    properties: {
      formattedCitation: formatted,
      plainCitation: formatted,
      noteIndex,
    },
    citationItems,
    schema: CSL_CITATION_SCHEMA,
  }
}

/**
 * Instrucción completa del campo de Word, tal y como la escribe Zotero.
 *
 * El JSON va sin saltos de línea a propósito: Word parte las instrucciones
 * largas en varios `w:instrText`, y un salto dentro del objeto rompe el análisis
 * al releerlo.
 */
export function buildCitationFieldInstruction(
  payload: ZoteroCitationPayload
): string {
  return `ADDIN ZOTERO_ITEM CSL_CITATION ${JSON.stringify(payload)}`
}

export interface ZoteroBibliographyPayload {
  uncited: string[]
  omitted: string[]
  custom: string[]
}

export function buildBibliographyFieldInstruction(
  payload: ZoteroBibliographyPayload = {
    uncited: [],
    omitted: [],
    custom: [],
  }
): string {
  return `ADDIN ZOTERO_BIBL ${JSON.stringify(payload)} CSL_BIBLIOGRAPHY`
}

/**
 * Preferencias del documento: el estilo y el idioma con que se generaron las
 * citas. Sin este campo Zotero pregunta por el estilo la primera vez que
 * refresca, y elige uno por defecto que no tiene por qué ser el del documento.
 */
export function buildPreferenceFieldInstruction(
  styleId: string,
  locale: string
): string {
  const styleUrl = /^https?:/.test(styleId)
    ? styleId
    : `http://www.zotero.org/styles/${styleId}`
  const preferences =
    `<data data-version="3" zotero-schema-version="112">` +
    `<session id="ETIEXPORT"/>` +
    `<style id="${styleUrl}" locale="${locale}" hasBibliography="1" ` +
    `bibliographyStyleHasBeenSet="0"/>` +
    `<prefs><pref name="fieldType" value="Field"/>` +
    `<pref name="automaticJournalAbbreviations" value="false"/>` +
    `<pref name="noteType" value="0"/></prefs></data>`
  return `ADDIN ZOTERO_PREF_1 ${preferences}`
}
