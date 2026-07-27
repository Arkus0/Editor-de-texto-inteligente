const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  shell,
} = require("electron")
if (require("electron-squirrel-startup")) app.quit()

const path = require("node:path")
const fs = require("node:fs/promises")
const fsSync = require("node:fs")
const { pathToFileURL } = require("node:url")
const { Worker } = require("node:worker_threads")
const { createHash, randomUUID } = require("node:crypto")
const {
  backupExternalFile,
  inspectExternalFile,
} = require("./document-save-utils.cjs")
const {
  extractDocxComplexFields,
  extractZoteroCitations,
  injectZoteroCitationMarkers,
  restoreZoteroCitationMarkers,
  extractDocxSimpleFields,
  extractDocxRevisions,
  extractDocxTextBoxes,
  extractOmmlEquations,
  extractParagraphFormats,
  injectDocxComplexFieldMarkers,
  injectDocxSimpleFieldMarkers,
  injectDocxRevisionMarkers,
  injectDocxTextBoxMarkers,
  injectOmmlEquationMarkers,
  injectParagraphFormats,
  inspectPageNumberField,
  parseLineNumberSettings,
  restoreDocxFieldMarkers,
  restoreDocxRevisionMarkers,
  restoreDocxTextBoxMarkers,
  restoreOmmlEquationMarkers,
} = require("./docx-import-utils.cjs")
const { extractOdtDocument } = require("./odt-utils.cjs")
const Database = require("better-sqlite3")
const { XMLParser } = require("fast-xml-parser")
const JSZip = require("jszip")
const mammoth = require("mammoth")
const { z } = require("zod")
const CSL = require("citeproc")

const DOCX_IMPORT_VERSION = 4
const ODT_IMPORT_VERSION = 1

protocol.registerSchemesAsPrivileged([
  {
    scheme: "editor",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
])

const isDevelopment = process.argv.includes("--dev")
const rendererRoot = path.resolve(__dirname, "..", "renderer-build")
const activeGenerations = new Map()
let database

const recoverySchema = z.object({
  documentId: z.string().min(1),
  path: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
  html: z.string(),
  markdown: z.string(),
  chatJson: z.string().optional(),
  documentJson: z.string().optional(),
  createVersion: z.boolean().optional(),
  versionReason: z.string().max(120).optional(),
})

const saveSchema = recoverySchema.extend({
  bytes: z.instanceof(Uint8Array),
  format: z.enum(["docx", "odt"]).optional(),
  conflictResolution: z.enum(["abort", "overwrite"]).optional(),
})

const aiSchema = z.object({
  apiKey: z.string().trim().min(10).max(500),
  mode: z.enum(["analyze", "draft", "review", "chat", "selection", "document"]),
  stable: z.boolean().optional(),
  model: z.string().min(1),
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  unrestrictedMode: z.boolean(),
  safetyPreset: z.enum(["academic", "standard", "strict"]).optional(),
  thinkingLevel: z.enum(["minimal", "low", "medium", "high"]).optional(),
  prompt: z.string(),
  documentText: z.string().optional(),
  contextText: z.string().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(500),
        mimeType: z.string().min(1).max(200),
        kind: z.enum(["text", "pdf", "image"]),
        role: z.enum([
          "auto",
          "assignment",
          "reference",
          "rubric",
          "example",
          "bibliography",
        ]),
        text: z.string().optional(),
        dataBase64: z.string().max(70_000_000).optional(),
      })
    )
    .max(20)
    .optional(),
  exerciseAnalysis: z.record(z.string(), z.unknown()).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "model"]), content: z.string() }))
    .optional(),
  quotedFragment: z.string().optional(),
  lengthPreset: z.enum(["auto", "short", "medium", "long", "very-long"]).optional(),
  customWordCount: z.number().int().min(100).max(12_000).optional(),
  research: z.boolean().optional(),
})

const exerciseAnalysisResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "type",
    "title",
    "language",
    "summary",
    "questions",
    "requirements",
    "requestedWordCount",
    "citationsRequired",
    "confidence",
    "warnings",
  ],
  properties: {
    type: {
      type: "string",
      enum: ["essay", "text-analysis", "structured-questions", "other"],
    },
    title: { type: "string" },
    language: { type: "string" },
    summary: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "instruction"],
        properties: {
          label: { type: "string" },
          instruction: { type: "string" },
        },
      },
    },
    requirements: { type: "array", items: { type: "string" } },
    requestedWordCount: {
      anyOf: [{ type: "integer" }, { type: "null" }],
    },
    citationsRequired: { type: "boolean" },
    confidence: { type: "number" },
    warnings: { type: "array", items: { type: "string" } },
  },
}

function geminiErrorDetails(error) {
  return {
    name: error?.name || "Error",
    message: String(error?.message || error || "Error desconocido"),
    status: error?.status ?? error?.cause?.status,
    code: error?.code ?? error?.cause?.code,
    causeName: error?.cause?.name,
    causeMessage: error?.cause?.message
      ? String(error.cause.message)
      : undefined,
  }
}

function geminiUserMessage(error) {
  const details = geminiErrorDetails(error)
  if (details.status === 401 || details.status === 403) {
    return "Google rechazó la API Key o sus permisos. Comprueba la clave en Ajustes."
  }
  if (details.status === 429) {
    return "Gemini ha limitado la solicitud por cuota o frecuencia. No se ha reintentado automáticamente."
  }
  if (details.status === 404) {
    return "El modelo seleccionado no está disponible para esta API Key."
  }
  if (/failed to fetch|fetch failed|unable to make request/i.test(details.message)) {
    return "No se pudo recuperar la respuesta de Gemini. La aplicación no ha reintentado la solicitud para evitar cargos duplicados."
  }
  return details.message || "No se pudo completar la generación."
}

const zoteroFetchSchema = z.object({
  mode: z.enum(["local", "web"]),
  libraryType: z.enum(["user", "group"]),
  libraryId: z.string().regex(/^\d+$/),
  query: z.string().trim().max(300).optional(),
  collectionKey: z
    .string()
    .regex(/^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/)
    .optional(),
  limit: z.number().int().min(1).max(1000).optional(),
})

const zoteroSyncSchema = zoteroFetchSchema.extend({
  since: z.number().int().min(0),
})

const zoteroMergeSchema = z.object({
  libraryType: z.enum(["user", "group"]),
  libraryId: z.string().regex(/^\d+$/),
  canonicalKey: z.string().regex(/^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/),
  duplicateKey: z.string().regex(/^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/),
  fieldChoices: z
    .record(z.string(), z.enum(["canonical", "duplicate"]))
    .optional(),
})

const zoteroAttachmentRequestSchema = zoteroFetchSchema.extend({
  parentKeys: z
    .array(z.string().regex(/^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/))
    .min(1)
    .max(200),
})

const zoteroOpenAttachmentSchema = zoteroFetchSchema.extend({
  attachment: z.object({
    key: z.string().regex(/^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/),
    version: z.number().int().min(0),
    parentItem: z.string(),
    title: z.string(),
    filename: z.string(),
    contentType: z.string(),
    url: z.string().optional(),
  }),
})

const cslFormatSchema = z.object({
  styleId: z.string().trim().min(1).max(200),
  styleXml: z.string().max(2_000_000).optional(),
  locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/).optional(),
  sources: z.array(z.record(z.string(), z.unknown())).max(5000),
  clusters: z.array(z.record(z.string(), z.unknown())).max(20_000),
})

const NON_BIBLIOGRAPHIC_ZOTERO_TYPES = new Set([
  "attachment",
  "note",
  "annotation",
])

function secretPath(filename) {
  return path.join(app.getPath("userData"), filename)
}

function geminiLogPath() {
  return path.join(app.getPath("userData"), "logs", "gemini.log")
}

function sanitizeGeminiLogValue(value) {
  return String(value ?? "")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[API_KEY_REDACTED]")
    .slice(0, 1200)
}

function writeGeminiLog(level, event, details = {}) {
  try {
    const filePath = geminiLogPath()
    fsSync.mkdirSync(path.dirname(filePath), { recursive: true })
    if (
      fsSync.existsSync(filePath) &&
      fsSync.statSync(filePath).size > 2 * 1024 * 1024
    ) {
      fsSync.rmSync(`${filePath}.1`, { force: true })
      fsSync.renameSync(filePath, `${filePath}.1`)
    }
    const safeDetails = Object.fromEntries(
      Object.entries(details)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [
          key,
          typeof value === "string" ? sanitizeGeminiLogValue(value) : value,
        ])
    )
    fsSync.appendFileSync(
      filePath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        ...safeDetails,
      })}\n`,
      "utf8"
    )
  } catch {
    // Un fallo del diagnóstico nunca debe detener el editor.
  }
}

async function readEncryptedSecret(filename, missingMessage) {
  const filePath = secretPath(filename)
  if (!fsSync.existsSync(filePath)) throw new Error(missingMessage)
  return safeStorage.decryptString(await fs.readFile(filePath))
}

async function fetchZoteroJson(url, apiKey, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Zotero-API-Version": "3",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(apiKey ? { "Zotero-API-Key": apiKey } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    if (response.status === 304) {
      return {
        data: null,
        total: 0,
        libraryVersion: Number(
          response.headers.get("Last-Modified-Version") ?? 0
        ),
        status: 304,
      }
    }
    if (response.status === 403) {
      throw new Error(
        url.startsWith("http://127.0.0.1")
          ? "Zotero está abierto, pero su API local no está habilitada. Activa Ajustes → Avanzado → «Permitir que otras aplicaciones de este equipo se comuniquen con Zotero»."
          : "La API Key de Zotero no es válida o no tiene permiso para leer esta biblioteca."
      )
    }
    if (response.status === 429) {
      throw new Error("Zotero ha limitado temporalmente las solicitudes. Inténtalo de nuevo en unos minutos.")
    }
    if (!response.ok) {
      if (response.status === 412) {
        throw new Error(
          "Zotero cambió mientras se realizaba la operación. Sincroniza y vuelve a intentarlo."
        )
      }
      if (response.status === 428) {
        throw new Error(
          "Zotero exige una versión de seguridad antes de modificar este registro."
        )
      }
      throw new Error(`Zotero respondió con el código ${response.status}.`)
    }
    const responseText =
      response.status === 204 ? "" : await response.text()
    return {
      data: responseText ? JSON.parse(responseText) : null,
      total: Number(response.headers.get("Total-Results") ?? 0),
      libraryVersion: Number(
        response.headers.get("Last-Modified-Version") ?? 0
      ),
      status: response.status,
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Zotero tardó demasiado en responder.")
    }
    if (
      url.startsWith("http://127.0.0.1") &&
      (error?.cause?.code === "ECONNREFUSED" ||
        String(error?.message ?? "").includes("fetch failed"))
    ) {
      throw new Error(
        "No se detectó Zotero Desktop. Ábrelo y vuelve a intentar la conexión local."
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function mapZoteroItem(item, libraryType, libraryId) {
  const data = item?.data ?? item ?? {}
  return {
    key: String(data.key ?? item?.key ?? ""),
    version: Number(data.version ?? item?.version ?? 0),
    libraryType,
    libraryId,
    itemType: String(data.itemType ?? ""),
    title: String(data.title ?? ""),
    creators: Array.isArray(data.creators)
      ? data.creators.slice(0, 100).map((creator) => ({
          firstName: creator.firstName ? String(creator.firstName) : undefined,
          lastName: creator.lastName ? String(creator.lastName) : undefined,
          name: creator.name ? String(creator.name) : undefined,
          creatorType: creator.creatorType
            ? String(creator.creatorType)
            : undefined,
        }))
      : [],
    date: String(data.date ?? ""),
    publisher: String(data.publisher ?? data.institution ?? ""),
    publicationTitle: String(
      data.publicationTitle ?? data.bookTitle ?? data.websiteTitle ?? ""
    ),
    url: String(data.url ?? ""),
    DOI: String(data.DOI ?? ""),
    ISBN: String(data.ISBN ?? ""),
    abstract: String(data.abstractNote ?? ""),
    volume: String(data.volume ?? ""),
    issue: String(data.issue ?? ""),
    pages: String(data.pages ?? ""),
    edition: String(data.edition ?? ""),
    language: String(data.language ?? ""),
    dateModified: String(data.dateModified ?? ""),
    collections: Array.isArray(data.collections)
      ? data.collections.map(String)
      : [],
    tags: Array.isArray(data.tags)
      ? data.tags
          .map((tag) => String(tag?.tag ?? tag ?? "").trim())
          .filter(Boolean)
      : [],
  }
}

function mapZoteroAttachment(item) {
  const data = item?.data ?? item ?? {}
  return {
    key: String(data.key ?? item?.key ?? ""),
    version: Number(data.version ?? item?.version ?? 0),
    parentItem: String(data.parentItem ?? ""),
    title: String(data.title ?? ""),
    filename: String(data.filename ?? ""),
    contentType: String(data.contentType ?? ""),
    url: String(item?.links?.enclosure?.href ?? data.url ?? "") || undefined,
  }
}

function zoteroLibraryPrefix(libraryType, libraryId) {
  return `/${libraryType === "group" ? "groups" : "users"}/${libraryId}`
}

async function zoteroApiKey(mode) {
  return mode === "web"
    ? readEncryptedSecret(
        "zotero-key.bin",
        "Conecta primero tu cuenta de Zotero."
      )
    : undefined
}

function zoteroBase(mode) {
  return mode === "web"
    ? "https://api.zotero.org"
    : "http://127.0.0.1:23119/api"
}

let cslStyleIndexCache = null
const cslLocaleCache = new Map()

function decodeXmlEntities(value) {
  return String(value)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/\s+/g, " ")
    .trim()
}

function cslStyleMetadata(xml, fallbackId, fallbackTitle) {
  const title =
    xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? fallbackTitle
  const id = xml.match(/<id[^>]*>([\s\S]*?)<\/id>/i)?.[1] ?? fallbackId
  const styleClass =
    xml.match(/<style\b[^>]*\bclass=["']([^"']+)["']/i)?.[1] === "note"
      ? "note"
      : "in-text"
  return {
    id: String(id).replace(/^https?:\/\/www\.zotero\.org\/styles\//, ""),
    title: decodeXmlEntities(title),
    class: styleClass,
  }
}

async function fetchPublicText(url, maximumBytes = 4_000_000) {
  const allowed =
    url.startsWith("https://www.zotero.org/styles") ||
    url.startsWith(
      "https://raw.githubusercontent.com/citation-style-language/locales/"
    )
  if (!allowed) throw new Error("Origen CSL no permitido.")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/xml,text/xml,text/plain,application/json" },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`No se pudo descargar el recurso CSL (${response.status}).`)
    }
    const declaredLength = Number(response.headers.get("Content-Length") ?? 0)
    if (declaredLength > maximumBytes) {
      throw new Error("El recurso CSL es demasiado grande.")
    }
    const text = await response.text()
    if (text.length > maximumBytes) {
      throw new Error("El recurso CSL es demasiado grande.")
    }
    return text
  } finally {
    clearTimeout(timeout)
  }
}

async function loadCslStyleIndex() {
  if (cslStyleIndexCache) return cslStyleIndexCache
  const cachePath = path.join(app.getPath("userData"), "csl-styles-index.json")
  try {
    const stat = await fs.stat(cachePath)
    if (Date.now() - stat.mtimeMs < 24 * 60 * 60 * 1000) {
      cslStyleIndexCache = JSON.parse(await fs.readFile(cachePath, "utf8"))
      return cslStyleIndexCache
    }
  } catch {
    // Se descargará una copia actualizada.
  }
  try {
    const text = await fetchPublicText(
      "https://www.zotero.org/styles-files/styles.json",
      5_000_000
    )
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error("Índice CSL no válido.")
    cslStyleIndexCache = parsed
    await fs.writeFile(cachePath, JSON.stringify(parsed))
    return parsed
  } catch (error) {
    try {
      cslStyleIndexCache = JSON.parse(await fs.readFile(cachePath, "utf8"))
      return cslStyleIndexCache
    } catch {
      throw error
    }
  }
}

async function resolveCslStyle(styleId, depth = 0) {
  if (depth > 3) throw new Error("El estilo CSL contiene dependencias circulares.")
  const safeStyleId = z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{0,199}$/)
    .parse(styleId.replace(/^https?:\/\/www\.zotero\.org\/styles\//, ""))
  const requestedXml = await fetchPublicText(
    `https://www.zotero.org/styles/${encodeURIComponent(safeStyleId)}`,
    2_000_000
  )
  if (!requestedXml.includes("http://purl.org/net/xbiblio/csl")) {
    throw new Error("Zotero no devolvió un estilo CSL válido.")
  }
  const parent = requestedXml.match(
    /<link\b[^>]*\brel=["']independent-parent["'][^>]*\bhref=["']([^"']+)["']/i
  )?.[1]
  if (!parent) {
    return {
      xml: requestedXml,
      ...cslStyleMetadata(requestedXml, safeStyleId, safeStyleId),
    }
  }
  const parentId = parent.split("/").filter(Boolean).at(-1)
  const resolved = await resolveCslStyle(parentId, depth + 1)
  const requestedMetadata = cslStyleMetadata(
    requestedXml,
    safeStyleId,
    safeStyleId
  )
  return {
    ...resolved,
    id: safeStyleId,
    title: requestedMetadata.title,
  }
}

async function loadCslLocale(locale) {
  const normalized = /^[a-z]{2,3}-[A-Z]{2}$/.test(locale)
    ? locale
    : "es-ES"
  if (cslLocaleCache.has(normalized)) return cslLocaleCache.get(normalized)
  const localeDirectory = path.join(app.getPath("userData"), "csl-locales")
  const cachePath = path.join(localeDirectory, `${normalized}.xml`)
  try {
    const cached = await fs.readFile(cachePath, "utf8")
    cslLocaleCache.set(normalized, cached)
    return cached
  } catch {
    // Primera descarga.
  }
  const xml = await fetchPublicText(
    `https://raw.githubusercontent.com/citation-style-language/locales/master/locales-${normalized}.xml`,
    500_000
  )
  await fs.mkdir(localeDirectory, { recursive: true })
  await fs.writeFile(cachePath, xml)
  cslLocaleCache.set(normalized, xml)
  return xml
}

function sourceToCslJson(source) {
  const creators = String(source.author ?? "")
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
  const year = Number.parseInt(
    String(source.year ?? "").match(/\d{4}/)?.[0] ?? "",
    10
  )
  const itemType = String(source.itemType ?? "")
  return {
    id: String(source.id),
    type:
      itemType === "journalArticle"
        ? "article-journal"
        : itemType === "bookSection"
          ? "chapter"
          : itemType === "conferencePaper"
            ? "paper-conference"
            : itemType === "thesis"
              ? "thesis"
              : itemType === "webpage"
                ? "webpage"
                : "book",
    title: String(source.title ?? ""),
    author: creators,
    issued: Number.isFinite(year) ? { "date-parts": [[year]] } : undefined,
    publisher: String(source.publisher ?? "") || undefined,
    "container-title": String(source.publisher ?? "") || undefined,
    volume: String(source.volume ?? "") || undefined,
    issue: String(source.issue ?? "") || undefined,
    page: String(source.pages ?? "") || undefined,
    edition: String(source.edition ?? "") || undefined,
    language: String(source.language ?? "") || undefined,
    DOI: String(source.doi ?? "") || undefined,
    ISBN: String(source.isbn ?? "") || undefined,
    URL: String(source.url ?? "") || undefined,
  }
}

function narrativeAuthor(source) {
  const author = String(source?.author ?? "").trim()
  if (!author) return String(source?.title ?? "Sin autor")
  const first = author.split(/\s*;\s*|\s+and\s+/i)[0]
  return first.includes(",")
    ? first.split(",")[0].trim()
    : first.split(/\s+/).at(-1)
}

async function formatWithCsl(rawInput) {
  const input = cslFormatSchema.parse(rawInput)
  const style =
    input.styleXml && input.styleXml.includes("http://purl.org/net/xbiblio/csl")
      ? {
          xml: input.styleXml,
          ...cslStyleMetadata(input.styleXml, input.styleId, input.styleId),
        }
      : await resolveCslStyle(input.styleId)
  const localeName = input.locale ?? "es-ES"
  const localeXml = await loadCslLocale(localeName)
  const items = Object.fromEntries(
    input.sources.map((source) => [
      String(source.id),
      sourceToCslJson(source),
    ])
  )
  const engine = new CSL.Engine(
    {
      retrieveLocale: () => localeXml,
      retrieveItem: (id) => items[id],
    },
    style.xml,
    localeName,
    true
  )
  engine.setOutputFormat("html")
  engine.updateItems(Object.keys(items))
  const sourcesById = new Map(
    input.sources.map((source) => [String(source.id), source])
  )
  const citations = {}
  for (const cluster of input.clusters) {
    const clusterItems = Array.isArray(cluster.items) ? cluster.items : []
    const citationItems = clusterItems
      .filter((item) => items[String(item.sourceId)])
      .map((item) => ({
        id: String(item.sourceId),
        locator: item.locator ? String(item.locator) : undefined,
        label: item.label ? String(item.label) : undefined,
        prefix: item.prefix ? String(item.prefix) : undefined,
        suffix: item.suffix ? String(item.suffix) : undefined,
        "suppress-author":
          Boolean(item.suppressAuthor) || cluster.mode === "narrative",
      }))
    let rendered = citationItems.length
      ? decodeXmlEntities(engine.makeCitationCluster(citationItems))
      : "(Referencia)"
    if (cluster.mode === "narrative" && citationItems.length === 1) {
      rendered = `${narrativeAuthor(
        sourcesById.get(String(citationItems[0].id))
      )} ${rendered}`
    }
    citations[String(cluster.id)] = rendered
  }
  const bibliographyResult = engine.makeBibliography()
  const bibliography = Array.isArray(bibliographyResult?.[1])
    ? bibliographyResult[1].map(decodeXmlEntities)
    : []
  return {
    citations,
    bibliography,
    styleClass: style.class,
  }
}

async function listZoteroObjects({
  base,
  path: objectPath,
  apiKey,
  query,
  limit = 1000,
  since,
  sort = "dateModified",
  direction = "desc",
}) {
  const objects = []
  let start = 0
  let libraryVersion = 0
  while (objects.length < limit) {
    const pageSize = Math.min(100, limit - objects.length)
    const url = new URL(`${base}${objectPath}`)
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", String(pageSize))
    url.searchParams.set("start", String(start))
    if (sort) url.searchParams.set("sort", sort)
    if (direction) url.searchParams.set("direction", direction)
    if (query) url.searchParams.set("q", query)
    if (typeof since === "number") {
      url.searchParams.set("since", String(since))
    }
    const response = await fetchZoteroJson(url.toString(), apiKey)
    libraryVersion = Math.max(libraryVersion, response.libraryVersion)
    const page = Array.isArray(response.data) ? response.data : []
    objects.push(...page)
    start += page.length
    if (
      page.length === 0 ||
      page.length < pageSize ||
      (response.total > 0 && start >= response.total)
    ) {
      break
    }
  }
  return { objects: objects.slice(0, limit), libraryVersion }
}

function mergeEditableZoteroData(
  canonical,
  duplicate,
  fieldChoices = {},
  libraryType = "user",
  libraryId = ""
) {
  const protectedFields = new Set([
    "key",
    "version",
    "itemType",
    "dateAdded",
    "dateModified",
    "parentItem",
    "tags",
    "collections",
    "relations",
  ])
  const merged = { ...canonical }
  for (const [field, duplicateValue] of Object.entries(duplicate)) {
    if (protectedFields.has(field)) continue
    if (fieldChoices[field] === "duplicate") {
      merged[field] = duplicateValue
      continue
    }
    if (fieldChoices[field] === "canonical") continue
    const canonicalValue = canonical[field]
    const canonicalEmpty =
      canonicalValue == null ||
      canonicalValue === "" ||
      (Array.isArray(canonicalValue) && canonicalValue.length === 0)
    if (canonicalEmpty && duplicateValue) merged[field] = duplicateValue
  }
  merged.tags = [
    ...new Map(
      [...(canonical.tags ?? []), ...(duplicate.tags ?? [])].map((tag) => [
        String(tag?.tag ?? tag),
        tag,
      ])
    ).values(),
  ]
  merged.collections = [
    ...new Set([
      ...(canonical.collections ?? []),
      ...(duplicate.collections ?? []),
    ]),
  ]
  const replacementUri = `http://zotero.org/${
    libraryType === "group" ? "groups" : "users"
  }/${libraryId}/items/${duplicate.key}`
  const existingReplacements = canonical.relations?.["dc:replaces"]
  merged.relations = {
    ...(canonical.relations ?? {}),
    "dc:replaces": [
      ...(Array.isArray(existingReplacements)
        ? existingReplacements
        : existingReplacements
          ? [existingReplacements]
          : []),
      replacementUri,
    ],
  }
  merged.key = canonical.key
  merged.version = canonical.version
  merged.itemType = canonical.itemType
  return merged
}

function customDictionaryPath() {
  return path.join(app.getPath("userData"), "custom-dictionary.json")
}

let thesaurusWorker = null
const thesaurusRequests = new Map()

function thesaurusFilename(language) {
  const normalized = language.toLocaleLowerCase()
  if (normalized.startsWith("es")) return "th_es_v2.dat"
  if (normalized.startsWith("en")) return "th_en_US_v2.dat"
  return null
}

async function findBundledThesaurus(filename) {
  const candidates = [
    path.join(app.getAppPath(), "renderer-build", "dictionaries", filename),
    path.join(app.getAppPath(), "out", "dictionaries", filename),
    path.join(app.getAppPath(), "public", "dictionaries", filename),
    path.join(__dirname, "..", "out", "dictionaries", filename),
    path.join(__dirname, "..", "public", "dictionaries", filename),
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Prueba la siguiente ubicación válida en desarrollo o empaquetado.
    }
  }
  return null
}

function getThesaurusWorker() {
  if (thesaurusWorker) return thesaurusWorker
  thesaurusWorker = new Worker(
    path.join(__dirname, "thesaurus-worker.cjs")
  )
  thesaurusWorker.on("message", ({ id, result, error }) => {
    const pending = thesaurusRequests.get(id)
    if (!pending) return
    thesaurusRequests.delete(id)
    clearTimeout(pending.timeout)
    if (error) pending.reject(new Error(error))
    else pending.resolve(result)
  })
  thesaurusWorker.on("error", (error) => {
    for (const pending of thesaurusRequests.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    thesaurusRequests.clear()
    thesaurusWorker = null
  })
  return thesaurusWorker
}

async function lookupBundledThesaurus(word, language) {
  const filename = thesaurusFilename(language)
  if (!filename) {
    return {
      word,
      language,
      source: "libreoffice-mythes",
      available: false,
      meanings: [],
    }
  }
  const filePath = await findBundledThesaurus(filename)
  if (!filePath) {
    return {
      word,
      language,
      source: "libreoffice-mythes",
      available: false,
      meanings: [],
    }
  }
  const id = randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      thesaurusRequests.delete(id)
      reject(new Error("La consulta del tesauro local agotó el tiempo."))
    }, 15000)
    thesaurusRequests.set(id, { resolve, reject, timeout })
    getThesaurusWorker().postMessage({
      id,
      filePath,
      word,
      language,
    })
  })
}

async function readCustomDictionary() {
  try {
    const words = JSON.parse(await fs.readFile(customDictionaryPath(), "utf8"))
    return Array.isArray(words)
      ? [...new Set(words.map(String).map((word) => word.trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, "es"))
      : []
  } catch {
    return []
  }
}

async function writeCustomDictionary(words) {
  const normalized = [...new Set(words)].sort((a, b) =>
    a.localeCompare(b, "es")
  )
  await fs.writeFile(customDictionaryPath(), JSON.stringify(normalized, null, 2))
  return normalized
}

async function applyCustomDictionary() {
  const words = await readCustomDictionary()
  for (const window of BrowserWindow.getAllWindows()) {
    for (const word of words) {
      window.webContents.session.addWordToSpellCheckerDictionary(word)
    }
  }
  return words
}

function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "editor-inteligente.db")
  database = new Database(dbPath)
  database.pragma("journal_mode = WAL")
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      document_id TEXT PRIMARY KEY,
      file_path TEXT,
      title TEXT NOT NULL,
      html TEXT NOT NULL,
      markdown TEXT NOT NULL,
      chat_json TEXT NOT NULL DEFAULT '[]',
      document_json TEXT NOT NULL DEFAULT '{}',
      file_hash TEXT,
      import_version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_path
      ON documents(file_path) WHERE file_path IS NOT NULL;
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      html TEXT NOT NULL,
      markdown TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      document_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_versions_document
      ON versions(document_id, created_at DESC);
  `)
  ensureColumn("documents", "document_json", "TEXT NOT NULL DEFAULT '{}'")
  ensureColumn("documents", "file_hash", "TEXT")
  ensureColumn("documents", "import_version", "INTEGER NOT NULL DEFAULT 0")
  ensureColumn("versions", "document_json", "TEXT NOT NULL DEFAULT '{}'")
}

function ensureColumn(table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all()
  if (columns.some((entry) => entry.name === column)) return
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function documentIdForPath(filePath) {
  return createHash("sha256").update(path.resolve(filePath).toLowerCase()).digest("hex")
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function htmlToPlainMarkdown(html) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, "### $1\n\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gis, "- $1\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
})

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function xmlText(value) {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.map(xmlText).join("")
  if (typeof value !== "object") return ""
  return Object.entries(value)
    .filter(([key]) => !key.startsWith("@"))
    .map(([, child]) => xmlText(child))
    .join("")
}

function normalizeXmlText(value) {
  return xmlText(value).replace(/\s+/g, " ").trim()
}

function twipsToPixels(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) ? Math.round(parsed / 15) : fallback
}

function paragraphStyleSlug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function relationshipMap(relationshipsXml) {
  if (!relationshipsXml) return new Map()
  const parsed = xmlParser.parse(relationshipsXml)
  const relationships =
    parsed.Relationships?.Relationship ??
    parsed["Relationships"]?.["Relationship"] ??
    []
  return new Map(
    asArray(relationships).map((relationship) => [
      relationship["@Id"],
      relationship["@Target"],
    ])
  )
}

function resolveWordPart(target) {
  if (!target) return null
  const normalized = String(target).replaceAll("\\", "/").replace(/^\/+/, "")
  return normalized.startsWith("word/")
    ? normalized
    : path.posix.normalize(path.posix.join("word", normalized))
}

async function readZipText(zip, partPath) {
  if (!partPath) return ""
  const entry = zip.file(partPath)
  return entry ? entry.async("string") : ""
}

async function readHeaderFooter(zip, relationships, reference) {
  if (!reference) {
    return { text: "", hasPageNumber: false, pageNumberAlignment: "center" }
  }
  const relationshipId = reference["@r:id"]
  const target = resolveWordPart(relationships.get(relationshipId))
  const xml = await readZipText(zip, target)
  if (!xml) {
    return { text: "", hasPageNumber: false, pageNumberAlignment: "center" }
  }
  const parsed = xmlParser.parse(xml)
  const pageNumber = inspectPageNumberField(xml)
  return {
    text: normalizeXmlText(parsed),
    hasPageNumber: pageNumber.hasPageNumber,
    pageNumberAlignment: pageNumber.alignment,
  }
}

function sectionParagraphIndices(documentXml) {
  const indices = []
  const paragraphs =
    documentXml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? []
  paragraphs.forEach((paragraph, index) => {
    if (/<w:sectPr(?:\s|>)/.test(paragraph)) indices.push(index + 1)
  })
  return indices
}

function injectSectionBreaks(html, paragraphIndices, sections) {
  if (paragraphIndices.length === 0 || sections.length < 2) return html
  let blockIndex = 0
  let breakIndex = 0
  return html.replace(/<\/(?:p|h[1-6])>/gi, (closingTag) => {
    blockIndex += 1
    if (
      breakIndex >= paragraphIndices.length ||
      blockIndex !== paragraphIndices[breakIndex]
    ) {
      return closingTag
    }
    const section = sections[breakIndex + 1]
    breakIndex += 1
    if (!section) return closingTag
    return `${closingTag}<div data-section-break="true" data-section-id="${escapeHtml(
      section.id
    )}" data-break-type="${escapeHtml(
      section.breakType
    )}" data-label="${escapeHtml(`Salto a ${section.name}`)}"></div>`
  })
}

async function extractDocxWorkspaceState(bytes) {
  const zip = await JSZip.loadAsync(bytes)
  const documentXml = await readZipText(zip, "word/document.xml")
  const relationshipsXml = await readZipText(
    zip,
    "word/_rels/document.xml.rels"
  )
  const relationships = relationshipMap(relationshipsXml)
  const document = xmlParser.parse(documentXml)
  const body = document["w:document"]?.["w:body"] ?? {}
  const paragraphSections = asArray(body["w:p"])
    .map((paragraph) => paragraph?.["w:pPr"]?.["w:sectPr"])
    .filter(Boolean)
  const sectionProperties = [...paragraphSections, body["w:sectPr"]].filter(
    Boolean
  )
  const settingsXml = await readZipText(zip, "word/settings.xml")
  const differentOddEven = /<w:evenAndOddHeaders(?:\s|\/|>)/.test(settingsXml)

  const sections = []
  for (const [index, section] of sectionProperties.entries()) {
    const pageSize = section["w:pgSz"] ?? {}
    const pageMargins = section["w:pgMar"] ?? {}
    const width = Number.parseInt(pageSize["@w:w"] ?? "11906", 10)
    const height = Number.parseInt(pageSize["@w:h"] ?? "16838", 10)
    const orientation =
      pageSize["@w:orient"] === "landscape" || width > height
        ? "landscape"
        : "portrait"
    const layout = {
      pageSize:
        Math.abs(Math.min(width, height) - 12_240) < 200 ? "letter" : "a4",
      orientation,
      margin: twipsToPixels(pageMargins["@w:left"], 72),
      margins: {
        top: twipsToPixels(pageMargins["@w:top"], 72),
        right: twipsToPixels(pageMargins["@w:right"], 72),
        bottom: twipsToPixels(pageMargins["@w:bottom"], 72),
        left: twipsToPixels(pageMargins["@w:left"], 72),
        header: twipsToPixels(pageMargins["@w:header"], 36),
        footer: twipsToPixels(pageMargins["@w:footer"], 36),
      },
      columns: Math.min(
        3,
        Math.max(1, Number.parseInt(section["w:cols"]?.["@w:num"] ?? "1", 10))
      ),
      columnGap: twipsToPixels(section["w:cols"]?.["@w:space"], 36),
      zoom: 1,
      showRuler: true,
      showFormattingMarks: false,
      lineNumbers: parseLineNumberSettings(section),
    }
    const headerReferences = Object.fromEntries(
      asArray(section["w:headerReference"]).map((reference) => [
        reference["@w:type"] ?? "default",
        reference,
      ])
    )
    const footerReferences = Object.fromEntries(
      asArray(section["w:footerReference"]).map((reference) => [
        reference["@w:type"] ?? "default",
        reference,
      ])
    )
    const header = {
      default: await readHeaderFooter(
        zip,
        relationships,
        headerReferences.default
      ),
      first: await readHeaderFooter(zip, relationships, headerReferences.first),
      even: await readHeaderFooter(zip, relationships, headerReferences.even),
    }
    const footer = {
      default: await readHeaderFooter(
        zip,
        relationships,
        footerReferences.default
      ),
      first: await readHeaderFooter(zip, relationships, footerReferences.first),
      even: await readHeaderFooter(zip, relationships, footerReferences.even),
    }
    const breakValue = section["w:type"]?.["@w:val"]
    const breakType = ["continuous", "evenPage", "oddPage"].includes(breakValue)
      ? breakValue
      : "nextPage"
    const headerPageNumber = Object.values(header).find(
      (value) => value.hasPageNumber
    )
    const footerPageNumber = Object.values(footer).find(
      (value) => value.hasPageNumber
    )
    const pageNumberPosition = headerPageNumber
      ? `header-${headerPageNumber.pageNumberAlignment}`
      : footerPageNumber
        ? `footer-${footerPageNumber.pageNumberAlignment}`
        : "none"
    const importedPageNumberFormat = section["w:pgNumType"]?.["@w:fmt"]
    const pageNumberFormat = [
      "decimal",
      "lowerRoman",
      "upperRoman",
      "lowerLetter",
      "upperLetter",
    ].includes(importedPageNumberFormat)
      ? importedPageNumberFormat
      : "decimal"
    sections.push({
      id: `section-${index + 1}`,
      name: `Sección ${index + 1}`,
      breakType,
      layout,
      header: {
        default: header.default.text,
        first: header.first.text,
        even: header.even.text,
      },
      footer: {
        default: footer.default.text,
        first: footer.first.text,
        even: footer.even.text,
      },
      differentFirstPage: Boolean(section["w:titlePg"]),
      differentOddEven,
      pageNumberPosition,
      pageNumberFormat,
      pageNumberStart: section["w:pgNumType"]?.["@w:start"]
        ? Number.parseInt(section["w:pgNumType"]["@w:start"], 10)
        : undefined,
    })
  }

  const commentsXml = await readZipText(zip, "word/comments.xml")
  const commentsDocument = commentsXml ? xmlParser.parse(commentsXml) : {}
  const comments = asArray(
    commentsDocument["w:comments"]?.["w:comment"]
  ).map((comment) => {
    const author = comment["@w:author"] || "Autor"
    return {
      id: `comment-${comment["@w:id"]}`,
      author,
      initials:
        comment["@w:initials"] ||
        author
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 3)
          .toUpperCase(),
      text: normalizeXmlText(comment),
      createdAt: comment["@w:date"] || new Date().toISOString(),
      resolved: false,
      replies: [],
    }
  })

  const footnotesXml = await readZipText(zip, "word/footnotes.xml")
  const footnotesDocument = footnotesXml ? xmlParser.parse(footnotesXml) : {}
  const footnotes = asArray(
    footnotesDocument["w:footnotes"]?.["w:footnote"]
  )
    .filter((footnote) => Number.parseInt(footnote["@w:id"], 10) > 0)
    .map((footnote) => {
      const number = Number.parseInt(footnote["@w:id"], 10)
      return {
        id: `footnote-${number}`,
        number,
        text: normalizeXmlText(footnote),
      }
    })

  const endnotesXml = await readZipText(zip, "word/endnotes.xml")
  const endnotesDocument = endnotesXml ? xmlParser.parse(endnotesXml) : {}
  const endnotes = asArray(
    endnotesDocument["w:endnotes"]?.["w:endnote"]
  )
    .filter((endnote) => Number.parseInt(endnote["@w:id"], 10) > 0)
    .map((endnote) => {
      const number = Number.parseInt(endnote["@w:id"], 10)
      return {
        id: `endnote-${number}`,
        number,
        text: normalizeXmlText(endnote),
      }
    })

  const stylesXml = await readZipText(zip, "word/styles.xml")
  const stylesDocument = stylesXml ? xmlParser.parse(stylesXml) : {}
  const styles = asArray(stylesDocument["w:styles"]?.["w:style"])
    .filter((style) => style["@w:type"] === "paragraph")
    .map((style) => ({
      id: style["@w:styleId"],
      name: style["w:name"]?.["@w:val"] || style["@w:styleId"],
      basedOn: style["w:basedOn"]?.["@w:val"],
    }))
    .filter((style) => style.id && style.name)
  const importedProofingLanguage =
    stylesDocument["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.[
      "w:rPr"
    ]?.["w:lang"]?.["@w:val"]
  const proofingLanguage =
    typeof importedProofingLanguage === "string" &&
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(importedProofingLanguage)
      ? importedProofingLanguage
      : "es-ES"

  const fallbackLayout = {
    pageSize: "a4",
    orientation: "portrait",
    margin: 72,
    margins: {
      top: 72,
      right: 72,
      bottom: 72,
      left: 72,
      header: 36,
      footer: 36,
    },
    columns: 1,
    columnGap: 36,
    zoom: 1,
    showRuler: true,
    showFormattingMarks: false,
  }
  const normalizedSections =
    sections.length > 0
      ? sections
      : [
          {
            id: "section-default",
            name: "Sección 1",
            breakType: "nextPage",
            layout: fallbackLayout,
            header: { default: "", first: "", even: "" },
            footer: { default: "", first: "", even: "" },
            differentFirstPage: false,
            differentOddEven: false,
            pageNumberPosition: "footer-center",
            pageNumberFormat: "decimal",
          },
        ]
  const revisions = extractDocxRevisions(documentXml)
  const insertions = revisions.filter(
    (revision) => revision.type === "insertion"
  ).length
  const deletions = revisions.filter(
    (revision) => revision.type === "deletion"
  ).length
  const equations = extractOmmlEquations(documentXml)
  // Las citas de Zotero se extraen y se marcan antes que nada: son campos
  // complejos, y si la sustitución genérica de campos pasara primero las
  // dejaría reducidas a su texto, que es justo lo que se quiere evitar.
  const zotero = extractZoteroCitations(documentXml)
  const zoteroSafeXml = injectZoteroCitationMarkers(
    documentXml,
    zotero.citations
  )
  const complexFields = extractDocxComplexFields(zoteroSafeXml)
  const simpleFields = extractDocxSimpleFields(zoteroSafeXml)
  const textBoxes = extractDocxTextBoxes(zoteroSafeXml)
  let mammothBytes = bytes
  if (
    equations.length > 0 ||
    simpleFields.length > 0 ||
    complexFields.length > 0 ||
    textBoxes.length > 0 ||
    revisions.length > 0 ||
    zotero.citations.length > 0
  ) {
    const fieldSafeXml = injectDocxSimpleFieldMarkers(
      zoteroSafeXml,
      simpleFields
    )
    const complexFieldSafeXml = injectDocxComplexFieldMarkers(
      fieldSafeXml,
      complexFields
    )
    const equationSafeXml = injectOmmlEquationMarkers(
      complexFieldSafeXml,
      equations
    )
    const textBoxSafeXml = injectDocxTextBoxMarkers(equationSafeXml, textBoxes)
    // Las revisiones van al final: sustituir <w:ins>/<w:del> por una marca de
    // texto plano destruiría cualquier campo o ecuación que viviera dentro.
    const mammothDocumentXml = injectDocxRevisionMarkers(
      textBoxSafeXml,
      revisions
    )
    zip.file("word/document.xml", mammothDocumentXml)
    mammothBytes = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    })
  }

  return {
    state: {
      schemaVersion: 6,
      proofingLanguage,
      layout: normalizedSections[0].layout,
      sections: normalizedSections,
      comments,
      footnotes,
      endnotes,
      styles,
      bibliography: {
        style: "apa",
        styleTitle: "APA Style 7th edition",
        styleClass: "in-text",
        locale: "es-ES",
        // Recuperadas de los campos de Zotero del propio archivo: quien abre el
        // documento de un coautor se encuentra las fuentes ya cargadas, con su
        // vínculo a la biblioteca, en vez de una bibliografía vacía.
        sources: zotero.sources,
        zoteroSync: {},
      },
      outlineNumbering: {
        enabled: false,
        maxLevel: 3,
        separator: ".",
      },
      writingAssistant: {
        disabledRules: [],
        ignoredIssues: [],
        longSentenceThreshold: 60,
      },
      trackChanges: {
        enabled: false,
        author: "Autor",
        showMarkup: true,
      },
      importedRevisionSummary: { insertions, deletions },
    },
    styles,
    complexFields,
    equations,
    mammothBytes,
    paragraphFormats: extractParagraphFormats(documentXml),
    revisions,
    sectionBreaks: sectionParagraphIndices(documentXml),
    simpleFields,
    textBoxes,
    zoteroCitations: zotero.citations,
  }
}

async function parseDocument(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  const bytes = await fs.readFile(filePath)
  const fileHash = createHash("sha256").update(bytes).digest("hex")
  const title = path.basename(filePath, extension)
  const documentId = documentIdForPath(filePath)
  const existing = database
    .prepare(
      `SELECT html, markdown, chat_json AS chatJson,
              document_json AS documentJson, file_hash AS fileHash,
              import_version AS importVersion
       FROM documents WHERE document_id = ?`
    )
    .get(documentId)
  const importVersion =
    extension === ".docx"
      ? DOCX_IMPORT_VERSION
      : extension === ".odt"
        ? ODT_IMPORT_VERSION
        : 0
  if (
    (extension === ".docx" || extension === ".odt") &&
    existing?.fileHash === fileHash &&
    existing?.importVersion === importVersion &&
    existing.html
  ) {
    return {
      documentId,
      path: filePath,
      title,
      html: existing.html,
      markdown: existing.markdown,
      chatJson: existing.chatJson || "[]",
      documentJson: existing.documentJson || "{}",
      warnings: [],
    }
  }

  let html
  let documentJson = existing?.documentJson || "{}"
  const warnings = []

  if (extension === ".docx") {
    const extracted = await extractDocxWorkspaceState(bytes)
    const knownStyleMappings = [
      "p[style-name='Title'] => p.word-title:fresh",
      "p[style-name='Subtitle'] => p.word-subtitle:fresh",
      "p[style-name='Normal'] => p.word-normal:fresh",
      "p[style-name='Heading 1'] => h1.word-heading-1:fresh",
      "p[style-name='Heading 2'] => h2.word-heading-2:fresh",
      "p[style-name='Heading 3'] => h3.word-heading-3:fresh",
      "p[style-name='Caption'] => p.word-caption:fresh",
      "p[style-name='Equation'] => p.word-equation:fresh",
      "p[style-name='TOC Heading'] => h2.word-toc-title:fresh",
      "p[style-name='TOC 1'] => p.word-toc-entry.word-toc-level-1:fresh",
      "p[style-name='TOC 2'] => p.word-toc-entry.word-toc-level-2:fresh",
      "p[style-name='TOC 3'] => p.word-toc-entry.word-toc-level-3:fresh",
      "comment-reference => sup.comment-reference",
    ]
    const structuralStyleClasses = new Map([
      ["Title", "word-title"],
      ["Subtitle", "word-subtitle"],
      ["Normal", "word-normal"],
      ["Heading1", "word-heading-1"],
      ["Heading2", "word-heading-2"],
      ["Heading3", "word-heading-3"],
      ["Caption", "word-caption"],
      ["Equation", "word-equation"],
      ["TOCHeading", "word-toc-title"],
      ["TOC1", "word-toc-entry.word-toc-level-1"],
      ["TOC2", "word-toc-entry.word-toc-level-2"],
      ["TOC3", "word-toc-entry.word-toc-level-3"],
    ])
    const localizedStructuralStyleMappings = extracted.styles
      .filter(
        (style) =>
          structuralStyleClasses.has(style.id) &&
          !String(style.name).includes("'")
      )
      .map(
        (style) =>
          `p[style-name='${style.name}'] => ${
            style.id.startsWith("Heading")
              ? `h${style.id.slice(-1)}`
              : "p"
          }.${structuralStyleClasses.get(style.id)}:fresh`
      )
    const mappedNames = new Set([
      "Title",
      "Subtitle",
      "Normal",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Caption",
      "Equation",
      "TOC Heading",
      "TOC 1",
      "TOC 2",
      "TOC 3",
    ])
    const importedStyleMappings = extracted.styles
      .filter(
        (style) =>
          !structuralStyleClasses.has(style.id) &&
          !mappedNames.has(style.name) &&
          !String(style.name).includes("'") &&
          paragraphStyleSlug(style.name)
      )
      .map(
        (style) =>
          `p[style-name='${style.name}'] => p.word-style-${paragraphStyleSlug(
            style.name
          )}:fresh`
      )
    const result = await mammoth.convertToHtml(
      { buffer: extracted.mammothBytes },
      {
        includeDefaultStyleMap: true,
        styleMap: [
          ...knownStyleMappings,
          ...localizedStructuralStyleMappings,
          ...importedStyleMappings,
        ],
      }
    )
    html = injectSectionBreaks(
      injectParagraphFormats(
        restoreDocxRevisionMarkers(
          restoreDocxTextBoxMarkers(
            restoreOmmlEquationMarkers(
              restoreZoteroCitationMarkers(
                restoreDocxFieldMarkers(
                  restoreDocxFieldMarkers(
                    result.value || "<p></p>",
                    extracted.simpleFields
                  ),
                  extracted.complexFields
                ),
                extracted.zoteroCitations
              ),
              extracted.equations
            ),
            extracted.textBoxes
          ),
          extracted.revisions
        ),
        extracted.paragraphFormats
      ),
      extracted.sectionBreaks,
      extracted.state.sections
    )
    documentJson = JSON.stringify(extracted.state)
    warnings.push(...result.messages.map((message) => message.message))
    const revisionSummary = extracted.state.importedRevisionSummary
    if (revisionSummary.insertions || revisionSummary.deletions) {
      warnings.push(
        `Se han importado ${revisionSummary.insertions} inserciones y ${revisionSummary.deletions} eliminaciones con su autor y su fecha. Puedes aceptarlas o rechazarlas desde Revisar, y al exportar volverán al DOCX como control de cambios.`
      )
    }
  } else if (extension === ".odt") {
    const extracted = await extractOdtDocument(bytes)
    html = extracted.html
    documentJson = extracted.documentJson
    warnings.push(...extracted.warnings)
  } else {
    const text = bytes.toString("utf8")
    html =
      extension === ".html" || extension === ".htm"
        ? text
        : `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`
  }

  const markdown = htmlToPlainMarkdown(html)
  const chatJson = existing?.chatJson || "[]"
  saveRecoveryState({
    documentId,
    path: filePath,
    title,
    html,
    markdown,
    chatJson,
    documentJson,
  })
  database
    .prepare(
      "UPDATE documents SET file_hash = ?, import_version = ? WHERE document_id = ?"
    )
    .run(
      fileHash,
      importVersion,
      documentId
    )

  if (extension === ".docx" || extension === ".odt") {
    const originalsDirectory = path.join(app.getPath("userData"), "original-documents")
    await fs.mkdir(originalsDirectory, { recursive: true })
    const originalPath = path.join(originalsDirectory, `${documentId}${extension}`)
    if (!fsSync.existsSync(originalPath)) await fs.copyFile(filePath, originalPath)
  }

  return {
    documentId,
    path: filePath,
    title,
    html,
    markdown,
    chatJson,
    documentJson,
    warnings,
  }
}

function saveRecoveryState(input) {
  const parsed = recoverySchema.parse(input)
  database
    .prepare(
      `INSERT INTO documents
        (document_id, file_path, title, html, markdown, chat_json, document_json, updated_at)
       VALUES (@documentId, @path, @title, @html, @markdown, @chatJson, @documentJson, @updatedAt)
       ON CONFLICT(document_id) DO UPDATE SET
        file_path = excluded.file_path,
        title = excluded.title,
        html = excluded.html,
        markdown = excluded.markdown,
        chat_json = excluded.chat_json,
        document_json = excluded.document_json,
        updated_at = excluded.updated_at`
    )
    .run({
      ...parsed,
      path: parsed.path ?? null,
      chatJson: parsed.chatJson ?? "[]",
      documentJson: parsed.documentJson ?? "{}",
      updatedAt: Date.now(),
    })

  if (parsed.createVersion) {
    database
      .prepare(
        `INSERT INTO versions
          (id, document_id, title, html, markdown, reason, created_at, pinned, document_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .run(
        randomUUID(),
        parsed.documentId,
        parsed.title,
        parsed.html,
        parsed.markdown,
        parsed.versionReason || "Punto de restauración",
        Date.now(),
        parsed.documentJson ?? "{}"
      )
    database
      .prepare(
        `DELETE FROM versions
         WHERE document_id = ? AND pinned = 0 AND id NOT IN (
           SELECT id FROM versions
           WHERE document_id = ?
           ORDER BY created_at DESC
           LIMIT 50
         )`
      )
      .run(parsed.documentId, parsed.documentId)
  }
}

async function writeAtomic(filePath, bytes) {
  const directory = path.dirname(filePath)
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  )
  await fs.writeFile(temporaryPath, Buffer.from(bytes))
  try {
    await fs.rename(temporaryPath, filePath)
  } catch {
    await fs.rm(filePath, { force: true })
    await fs.rename(temporaryPath, filePath)
  }
}

function sendMenuCommand(command, payload) {
  const window = BrowserWindow.getFocusedWindow()
  window?.webContents.send("menu:command", command, payload)
}

function buildApplicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Archivo",
      submenu: [
        { label: "Nuevo", accelerator: "CmdOrCtrl+N", click: () => sendMenuCommand("file:new") },
        { label: "Abrir…", accelerator: "CmdOrCtrl+O", click: () => sendMenuCommand("file:open") },
        { type: "separator" },
        { label: "Guardar", accelerator: "CmdOrCtrl+S", click: () => sendMenuCommand("file:save") },
        {
          label: "Guardar como…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuCommand("file:saveAs"),
        },
        { type: "separator" },
        { label: "Imprimir…", accelerator: "CmdOrCtrl+P", click: () => sendMenuCommand("file:print") },
        { type: "separator" },
        { label: "Cerrar documento", accelerator: "CmdOrCtrl+W", click: () => sendMenuCommand("file:close") },
        { role: "quit", label: "Salir" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Deshacer" },
        { role: "redo", label: "Rehacer" },
        { type: "separator" },
        { role: "cut", label: "Cortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Pegar" },
        { role: "selectAll", label: "Seleccionar todo" },
        { type: "separator" },
        {
          label: "Buscar y reemplazar…",
          accelerator: "CmdOrCtrl+H",
          click: () => sendMenuCommand("edit:find"),
        },
      ],
    },
    {
      label: "Insertar",
      submenu: [
        {
          label: "Salto de página",
          accelerator: "CmdOrCtrl+Enter",
          click: () => sendMenuCommand("insert:pageBreak"),
        },
        {
          label: "Salto de sección…",
          click: () => sendMenuCommand("insert:sectionBreak"),
        },
        { type: "separator" },
        {
          label: "Nota al pie o final…",
          accelerator: "CmdOrCtrl+Alt+F",
          click: () => sendMenuCommand("insert:footnote"),
        },
        {
          label: "Cita, bibliografía o Zotero…",
          click: () => sendMenuCommand("insert:references"),
        },
        {
          label: "Índice dinámico",
          click: () => sendMenuCommand("insert:toc"),
        },
        {
          label: "Ecuación, rótulo o referencia cruzada…",
          click: () => sendMenuCommand("insert:equation"),
        },
        {
          label: "Comentario…",
          accelerator: "CmdOrCtrl+Alt+M",
          click: () => sendMenuCommand("review:comment"),
        },
      ],
    },
    {
      label: "Revisar",
      submenu: [
        {
          label: "Activar/desactivar control de cambios",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => sendMenuCommand("review:trackChanges"),
        },
        {
          label: "Comentarios y cambios",
          click: () => sendMenuCommand("review:comment"),
        },
        {
          label: "Historial de versiones",
          click: () => sendMenuCommand("view:history"),
        },
        {
          label: "Buscar, comparar y corregir…",
          click: () => sendMenuCommand("view:documentTools"),
        },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { label: "Historial de versiones", click: () => sendMenuCommand("view:history") },
        {
          label: "Asistente Gemini",
          accelerator: "CmdOrCtrl+J",
          click: () => sendMenuCommand("view:assistant"),
        },
        {
          label: "Navegador y herramientas del documento",
          click: () => sendMenuCommand("view:documentTools"),
        },
        { type: "separator" },
        { role: "reload", label: "Recargar" },
        { role: "togglefullscreen", label: "Pantalla completa" },
        { role: "toggleDevTools", label: "Herramientas de desarrollo", visible: isDevelopment },
      ],
    },
    {
      label: "IA",
      submenu: [
        { label: "Crear otro borrador", click: () => sendMenuCommand("ai:newDraft") },
        { label: "Investigar con fuentes", click: () => sendMenuCommand("ai:research") },
      ],
    },
    {
      label: "Ayuda",
      submenu: [
        {
          label: "Google AI Studio",
          click: () => shell.openExternal("https://aistudio.google.com/apikey"),
        },
        {
          label: "Abrir registros de diagnóstico",
          click: async () => {
            const directory = path.dirname(geminiLogPath())
            fsSync.mkdirSync(directory, { recursive: true })
            await shell.openPath(directory)
          },
        },
        { type: "separator" },
        {
          label: "Acerca de",
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: "Editor Inteligente IA",
              message: "Editor Inteligente IA",
              detail: `Versión ${app.getVersion()}\nEditor DOCX académico local con Gemini y Zotero.`,
            }),
        },
      ],
    },
  ])
}

function createWindow(documentId) {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: "#e7e5e4",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    writeGeminiLog("error", "preload-error", {
      preloadPath,
      ...geminiErrorDetails(error),
    })
  })
  window.webContents.session.setSpellCheckerLanguages(["es-ES", "en-US"])
  window.webContents.on("context-menu", (_event, params) => {
    const template = []
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        template.push({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion),
        })
      }
      if (template.length === 0) {
        template.push({ label: "Sin sugerencias", enabled: false })
      }
      template.push({
        label: "Añadir al diccionario",
        click: () =>
          window.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord
          ),
      })
      template.push({ type: "separator" })
    }
    if (params.isEditable) {
      template.push(
        { role: "cut", label: "Cortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Pegar" },
        { role: "selectAll", label: "Seleccionar todo" }
      )
    }
    if (template.length > 0) Menu.buildFromTemplate(template).popup({ window })
  })
  window.webContents.on("will-navigate", (event, targetUrl) => {
    const allowedOrigin = isDevelopment ? "http://127.0.0.1:3000" : "editor://bundle"
    if (!targetUrl.startsWith(allowedOrigin)) event.preventDefault()
  })

  const query = documentId ? `?document=${encodeURIComponent(documentId)}` : ""
  if (isDevelopment) {
    window.loadURL(`http://127.0.0.1:3000/${query}`)
  } else {
    window.loadURL(`editor://bundle/index.html${query}`)
  }
  window.once("ready-to-show", () => window.show())
  return window
}

function registerIpc() {
  ipcMain.on("runtime:preload-ready", () => {
    writeGeminiLog("info", "preload-ready")
  })

  ipcMain.handle("documents:open", async (_event, requestedPath) => {
    let filePath = requestedPath
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          {
            name: "Documentos",
            extensions: ["docx", "odt", "txt", "md", "html"],
          },
          { name: "Word", extensions: ["docx"] },
          { name: "OpenDocument", extensions: ["odt"] },
        ],
      })
      if (result.canceled) return null
      filePath = result.filePaths[0]
    }
    return parseDocument(filePath)
  })

  ipcMain.handle("documents:save", async (_event, input) => {
    const parsed = saveSchema.parse(input)
    let filePath = parsed.path
    const savingTrackedPath = Boolean(filePath)
    const format =
      parsed.format ||
      (filePath?.toLowerCase().endsWith(".odt") ? "odt" : "docx")
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        defaultPath: `${
          parsed.title.replace(/[<>:"/\\|?*]/g, "-") || "Documento"
        }.${format}`,
        filters:
          format === "odt"
            ? [{ name: "Documento OpenDocument", extensions: ["odt"] }]
            : [{ name: "Documento Word", extensions: ["docx"] }],
      })
      if (result.canceled || !result.filePath) return null
      filePath = result.filePath.toLowerCase().endsWith(`.${format}`)
        ? result.filePath
        : `${result.filePath}.${format}`
    }
    let conflictBackupPath
    if (savingTrackedPath) {
      const trackedDocument = database
        .prepare(
          `SELECT file_path AS filePath, file_hash AS fileHash
           FROM documents WHERE document_id = ?`
        )
        .get(parsed.documentId)
      const sameTrackedPath =
        trackedDocument?.filePath &&
        path.resolve(trackedDocument.filePath) === path.resolve(filePath)
      if (sameTrackedPath && trackedDocument.fileHash) {
        const external = await inspectExternalFile(
          filePath,
          trackedDocument.fileHash
        )
        if (external.conflict && parsed.conflictResolution !== "overwrite") {
          return {
            status: "conflict",
            path: filePath,
            title: path.basename(filePath, path.extname(filePath)),
            savedAt: null,
            externalModifiedAt: external.modifiedAt,
          }
        }
        if (external.conflict) {
          conflictBackupPath = await backupExternalFile({
            filePath,
            backupRoot: path.join(
              app.getPath("userData"),
              "conflict-backups"
            ),
            documentId: parsed.documentId,
          })
        }
      }
    }
    await writeAtomic(filePath, parsed.bytes)
    saveRecoveryState({
      ...parsed,
      path: filePath,
      chatJson: parsed.chatJson,
      createVersion: parsed.createVersion,
      versionReason: parsed.versionReason || "Guardado",
    })
    database
      .prepare("UPDATE documents SET file_hash = ? WHERE document_id = ?")
      .run(
        createHash("sha256").update(Buffer.from(parsed.bytes)).digest("hex"),
        parsed.documentId
      )
    return {
      status: "saved",
      path: filePath,
      title: path.basename(filePath, path.extname(filePath)),
      savedAt: Date.now(),
      conflictBackupPath,
    }
  })

  ipcMain.handle("documents:saveRecovery", (_event, input) => {
    saveRecoveryState(input)
  })

  ipcMain.handle("documents:loadRecovery", (_event, documentId) => {
    const row = database
      .prepare(
        `SELECT document_id AS documentId, file_path AS path, title, html, markdown,
                chat_json AS chatJson, document_json AS documentJson
         FROM documents WHERE document_id = ?`
      )
      .get(z.string().min(1).parse(documentId))
    return row || null
  })

  ipcMain.handle("documents:listVersions", (_event, documentId) =>
    database
      .prepare(
        `SELECT id, document_id AS documentId, title, html, markdown, reason,
                created_at AS createdAt, pinned, document_json AS documentJson
         FROM versions WHERE document_id = ? ORDER BY created_at DESC`
      )
      .all(z.string().min(1).parse(documentId))
      .map((row) => ({ ...row, pinned: Boolean(row.pinned) }))
  )

  ipcMain.handle("documents:deleteVersion", (_event, versionId) => {
    database.prepare("DELETE FROM versions WHERE id = ?").run(z.string().uuid().parse(versionId))
  })
  ipcMain.handle("documents:pinVersion", (_event, versionId, pinned) => {
    database
      .prepare("UPDATE versions SET pinned = ? WHERE id = ?")
      .run(z.boolean().parse(pinned) ? 1 : 0, z.string().uuid().parse(versionId))
  })

  ipcMain.handle("ai:testKey", async (_event, rawApiKey) => {
    const apiKey = z.string().trim().min(10).max(500).parse(rawApiKey)
    const model = "gemini-3.5-flash-lite"
    try {
      const { GoogleGenAI } = await import("@google/genai")
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { retryOptions: { attempts: 1 } },
      })
      await ai.models.get({ model })
      writeGeminiLog("info", "key-test-completed", { model })
      return { ok: true, model }
    } catch (error) {
      writeGeminiLog("error", "key-test-failed", geminiErrorDetails(error))
      throw error
    }
  })
  ipcMain.handle("secrets:hasZoteroKey", async () => {
    const keyPath = secretPath("zotero-key.bin")
    return fsSync.existsSync(keyPath) && (await fs.stat(keyPath)).size > 0
  })
  ipcMain.handle("secrets:setZoteroKey", async (_event, rawApiKey) => {
    const apiKey = z.string().trim().min(12).max(500).parse(rawApiKey)
    const encrypted = safeStorage.encryptString(apiKey)
    await fs.writeFile(secretPath("zotero-key.bin"), encrypted)
    return true
  })
  ipcMain.handle("secrets:clearZoteroKey", async () => {
    await fs.rm(secretPath("zotero-key.bin"), { force: true })
  })

  ipcMain.handle("zotero:connectLocal", async () => {
    await fetchZoteroJson(
      "http://127.0.0.1:23119/api/users/0/items/top?limit=1"
    )
    const libraries = [
      { type: "user", id: "0", name: "Mi biblioteca local" },
    ]
    try {
      const groupsResponse = await fetchZoteroJson(
        "http://127.0.0.1:23119/api/users/0/groups"
      )
      for (const group of Array.isArray(groupsResponse.data)
        ? groupsResponse.data
        : []) {
        const id = String(group.id ?? group.data?.id ?? "")
        if (!/^\d+$/.test(id)) continue
        libraries.push({
          type: "group",
          id,
          name: String(group.name ?? group.data?.name ?? `Grupo ${id}`),
        })
      }
    } catch {
      // La biblioteca personal local sigue siendo totalmente utilizable.
    }
    return {
      mode: "local",
      userId: "0",
      username: "Zotero Desktop",
      libraries,
    }
  })

  ipcMain.handle("zotero:connectWeb", async () => {
    const apiKey = await readEncryptedSecret(
      "zotero-key.bin",
      "Guarda primero una API Key de Zotero."
    )
    const keyInfoResponse = await fetchZoteroJson(
      `https://api.zotero.org/keys/${encodeURIComponent(apiKey)}`,
      apiKey
    )
    const keyInfo = keyInfoResponse.data?.data ?? keyInfoResponse.data ?? {}
    const userId = String(keyInfo.userID ?? keyInfo.userId ?? "")
    if (!/^\d+$/.test(userId)) {
      throw new Error("Zotero no devolvió un identificador de usuario válido.")
    }
    const libraries = [
      {
        type: "user",
        id: userId,
        name: keyInfo.username
          ? `Biblioteca de ${keyInfo.username}`
          : "Mi biblioteca de Zotero",
      },
    ]
    const groupsResponse = await fetchZoteroJson(
      `https://api.zotero.org/users/${userId}/groups?limit=100`,
      apiKey
    )
    for (const group of Array.isArray(groupsResponse.data)
      ? groupsResponse.data
      : []) {
      const id = String(group.id ?? group.data?.id ?? "")
      if (!/^\d+$/.test(id)) continue
      libraries.push({
        type: "group",
        id,
        name: String(group.name ?? group.data?.name ?? `Grupo ${id}`),
      })
    }
    return {
      mode: "web",
      userId,
      username: keyInfo.username ? String(keyInfo.username) : undefined,
      libraries,
    }
  })

  ipcMain.handle("zotero:fetchItems", async (_event, rawInput) => {
    const input = zoteroFetchSchema.parse(rawInput)
    const requestedLimit = input.limit ?? 250
    const apiKey = await zoteroApiKey(input.mode)
    const base = zoteroBase(input.mode)
    const libraryPrefix = zoteroLibraryPrefix(
      input.libraryType,
      input.libraryId
    )
    const itemPath = input.collectionKey
      ? `${libraryPrefix}/collections/${input.collectionKey}/items/top`
      : `${libraryPrefix}/items/top`
    const { objects } = await listZoteroObjects({
      base,
      path: itemPath,
      apiKey,
      query: input.query,
      limit: requestedLimit,
    })
    return objects
      .map((item) =>
        mapZoteroItem(item, input.libraryType, input.libraryId)
      )
      .filter(
        (item) =>
          item.key &&
          item.title &&
          !NON_BIBLIOGRAPHIC_ZOTERO_TYPES.has(item.itemType)
      )
  })

  ipcMain.handle("zotero:fetchCollections", async (_event, rawInput) => {
    const input = zoteroFetchSchema.parse(rawInput)
    const { objects } = await listZoteroObjects({
      base: zoteroBase(input.mode),
      path: `${zoteroLibraryPrefix(
        input.libraryType,
        input.libraryId
      )}/collections`,
      apiKey: await zoteroApiKey(input.mode),
      query: input.query,
      limit: input.limit ?? 1000,
      sort: "title",
      direction: "asc",
    })
    return objects
      .map((entry) => {
        const data = entry?.data ?? entry ?? {}
        return {
          key: String(data.key ?? entry?.key ?? ""),
          version: Number(data.version ?? entry?.version ?? 0),
          name: String(data.name ?? ""),
          parentCollection: data.parentCollection
            ? String(data.parentCollection)
            : false,
          itemCount: Number(entry?.meta?.numItems ?? 0) || undefined,
        }
      })
      .filter((collection) => collection.key && collection.name)
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
  })

  ipcMain.handle("zotero:fetchAttachments", async (_event, rawInput) => {
    const input = zoteroAttachmentRequestSchema.parse(rawInput)
    const apiKey = await zoteroApiKey(input.mode)
    const base = zoteroBase(input.mode)
    const prefix = zoteroLibraryPrefix(input.libraryType, input.libraryId)
    const attachments = []
    for (let index = 0; index < input.parentKeys.length; index += 4) {
      const pages = await Promise.all(
        input.parentKeys.slice(index, index + 4).map((key) =>
          listZoteroObjects({
            base,
            path: `${prefix}/items/${key}/children`,
            apiKey,
            limit: 100,
            sort: "",
            direction: "",
          })
        )
      )
      for (const page of pages) {
        attachments.push(
          ...page.objects
            .filter((item) => (item?.data ?? item)?.itemType === "attachment")
            .map(mapZoteroAttachment)
        )
      }
    }
    return attachments
  })

  ipcMain.handle("zotero:sync", async (_event, rawInput) => {
    const input = zoteroSyncSchema.parse(rawInput)
    const apiKey = await zoteroApiKey(input.mode)
    const base = zoteroBase(input.mode)
    const prefix = zoteroLibraryPrefix(input.libraryType, input.libraryId)
    const changed = await listZoteroObjects({
      base,
      path: `${prefix}/items`,
      apiKey,
      limit: input.limit ?? 1000,
      since: input.since,
    })
    const deletedUrl = new URL(`${base}${prefix}/deleted`)
    deletedUrl.searchParams.set("since", String(input.since))
    const deletedResponse = await fetchZoteroJson(
      deletedUrl.toString(),
      apiKey
    )
    const deleted = deletedResponse.data ?? {}
    const items = []
    const attachments = []
    for (const entry of changed.objects) {
      const itemType = String((entry?.data ?? entry)?.itemType ?? "")
      if (itemType === "attachment") {
        attachments.push(mapZoteroAttachment(entry))
      } else if (!NON_BIBLIOGRAPHIC_ZOTERO_TYPES.has(itemType)) {
        const mapped = mapZoteroItem(
          entry,
          input.libraryType,
          input.libraryId
        )
        if (mapped.key && mapped.title) items.push(mapped)
      }
    }
    return {
      items,
      attachments,
      deletedItemKeys: Array.isArray(deleted.items)
        ? deleted.items.map(String)
        : [],
      deletedCollectionKeys: Array.isArray(deleted.collections)
        ? deleted.collections.map(String)
        : [],
      libraryVersion: Math.max(
        changed.libraryVersion,
        deletedResponse.libraryVersion
      ),
    }
  })

  ipcMain.handle("zotero:mergeItems", async (_event, rawInput) => {
    const input = zoteroMergeSchema.parse(rawInput)
    const apiKey = await zoteroApiKey("web")
    const base = zoteroBase("web")
    const prefix = zoteroLibraryPrefix(input.libraryType, input.libraryId)
    const canonicalResponse = await fetchZoteroJson(
      `${base}${prefix}/items/${input.canonicalKey}`,
      apiKey
    )
    const duplicateResponse = await fetchZoteroJson(
      `${base}${prefix}/items/${input.duplicateKey}`,
      apiKey
    )
    const canonicalData =
      canonicalResponse.data?.data ?? canonicalResponse.data ?? {}
    const duplicateData =
      duplicateResponse.data?.data ?? duplicateResponse.data ?? {}
    const merged = mergeEditableZoteroData(
      canonicalData,
      duplicateData,
      input.fieldChoices,
      input.libraryType,
      input.libraryId
    )
    const children = await listZoteroObjects({
      base,
      path: `${prefix}/items/${input.duplicateKey}/children`,
      apiKey,
      limit: 100,
      sort: "",
      direction: "",
    })
    if (children.objects.length) {
      await fetchZoteroJson(`${base}${prefix}/items`, apiKey, {
        method: "POST",
        body: children.objects.map((child) => {
          const data = child?.data ?? child ?? {}
          return {
            key: data.key,
            version: data.version,
            parentItem: input.canonicalKey,
          }
        }),
      })
    }
    const updatedResponse = await fetchZoteroJson(
      `${base}${prefix}/items/${input.canonicalKey}`,
      apiKey,
      {
        method: "PUT",
        body: merged,
        headers: {
          "If-Unmodified-Since-Version": String(canonicalData.version),
        },
      }
    )
    await fetchZoteroJson(
      `${base}${prefix}/items/${input.duplicateKey}`,
      apiKey,
      {
        method: "DELETE",
        headers: {
          "If-Unmodified-Since-Version": String(duplicateData.version),
        },
      }
    )
    const refreshed = await fetchZoteroJson(
      `${base}${prefix}/items/${input.canonicalKey}`,
      apiKey
    )
    return {
      canonical: mapZoteroItem(
        refreshed.data,
        input.libraryType,
        input.libraryId
      ),
      deletedKey: input.duplicateKey,
      libraryVersion: Math.max(
        updatedResponse.libraryVersion,
        refreshed.libraryVersion
      ),
    }
  })

  ipcMain.handle("zotero:openAttachment", async (_event, rawInput) => {
    const input = zoteroOpenAttachmentSchema.parse(rawInput)
    const { attachment } = input
    if (
      attachment.url &&
      /^https?:\/\//i.test(attachment.url) &&
      !attachment.filename
    ) {
      await shell.openExternal(attachment.url)
      return attachment.url
    }
    const apiKey = await zoteroApiKey(input.mode)
    const base = zoteroBase(input.mode)
    const prefix = zoteroLibraryPrefix(input.libraryType, input.libraryId)
    const response = await fetch(
      `${base}${prefix}/items/${attachment.key}/file`,
      {
        headers: {
          "Zotero-API-Version": "3",
          ...(apiKey ? { "Zotero-API-Key": apiKey } : {}),
        },
      }
    )
    if (!response.ok) {
      throw new Error(`No se pudo descargar el adjunto (${response.status}).`)
    }
    const declaredLength = Number(response.headers.get("Content-Length") ?? 0)
    if (declaredLength > 200_000_000) {
      throw new Error("El adjunto supera el límite de 200 MB.")
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 200_000_000) {
      throw new Error("El adjunto supera el límite de 200 MB.")
    }
    const directory = path.join(app.getPath("userData"), "zotero-attachments")
    await fs.mkdir(directory, { recursive: true })
    const fallbackExtension =
      attachment.contentType === "application/pdf" ? ".pdf" : ""
    const filename = (
      attachment.filename ||
      attachment.title ||
      `${attachment.key}${fallbackExtension}`
    ).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    const target = path.join(directory, `${attachment.key}-${filename}`)
    await fs.writeFile(target, bytes)
    const openError = await shell.openPath(target)
    if (openError) throw new Error(openError)
    return target
  })

  ipcMain.handle("csl:searchStyles", async (_event, rawQuery) => {
    const query = z.string().trim().max(200).parse(rawQuery)
    const normalize = (value) =>
      String(value)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
    const needle = normalize(query)
    const index = await loadCslStyleIndex()
    return index
      .filter(
        (entry) =>
          !entry.dependent &&
          (!needle ||
            normalize(`${entry.title} ${entry.name}`).includes(needle))
      )
      .slice(0, 80)
      .map((entry) => ({
        id: String(entry.name),
        title: String(entry.title),
        class: entry.categories?.format === "note" ? "note" : "in-text",
        format: entry.categories?.format
          ? String(entry.categories.format)
          : undefined,
        fields: Array.isArray(entry.categories?.fields)
          ? entry.categories.fields.map(String)
          : undefined,
        updated: entry.updated ? String(entry.updated) : undefined,
      }))
  })

  ipcMain.handle("csl:fetchStyle", async (_event, rawStyleId) =>
    resolveCslStyle(z.string().trim().min(1).max(200).parse(rawStyleId))
  )
  ipcMain.handle("csl:format", async (_event, rawInput) =>
    formatWithCsl(rawInput)
  )

  ipcMain.handle("dictionary:listWords", async () => readCustomDictionary())
  ipcMain.handle("dictionary:lookupSynonyms", async (_event, rawInput) => {
    const input = z
      .object({
        word: z.string().trim().min(1).max(80),
        language: z
          .string()
          .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
      })
      .parse(rawInput)
    return lookupBundledThesaurus(input.word, input.language)
  })
  ipcMain.handle("dictionary:addWord", async (_event, rawWord) => {
    const word = z
      .string()
      .trim()
      .regex(/^[\p{L}][\p{L}'’\-]{0,79}$/u)
      .parse(rawWord)
    const updated = await writeCustomDictionary([
      ...(await readCustomDictionary()),
      word,
    ])
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.session.addWordToSpellCheckerDictionary(word)
    }
    return updated
  })
  ipcMain.handle("dictionary:removeWord", async (_event, rawWord) => {
    const word = z.string().trim().min(1).max(80).parse(rawWord)
    const updated = await writeCustomDictionary(
      (await readCustomDictionary()).filter(
        (entry) =>
          entry.localeCompare(word, "es", { sensitivity: "base" }) !== 0
      )
    )
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.session.removeWordFromSpellCheckerDictionary(word)
    }
    return updated
  })

  ipcMain.on("ai:start", async (event, requestId, rawRequest) => {
    const channel = `ai:event:${requestId}`
    const startedAt = Date.now()
    let requestMetadata = { mode: "unknown", model: "unknown" }
    try {
      const request = aiSchema.parse(rawRequest)
      requestMetadata = { mode: request.mode, model: request.model }
      console.info("[gemini] request started", {
        requestId,
        ...requestMetadata,
      })
      writeGeminiLog("info", "request-started", {
        requestId,
        ...requestMetadata,
      })
      const apiKey = request.apiKey
      const controller = new AbortController()
      activeGenerations.set(requestId, controller)

      const {
        GoogleGenAI,
        HarmBlockThreshold,
        HarmCategory,
        ThinkingLevel,
      } = await import("@google/genai")
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { retryOptions: { attempts: 1 } },
      })
      const compatibleThinkingLevel =
        request.model === "gemini-3.1-pro-preview" &&
        request.thinkingLevel === "minimal"
          ? "low"
          : request.thinkingLevel
      const lengthInstruction = {
        auto: "Adapta la extensión a lo que exige la petición.",
        short: "Responde de forma breve, aproximadamente entre 200 y 400 palabras.",
        medium: "Desarrolla la respuesta aproximadamente entre 600 y 1.000 palabras.",
        long: "Elabora una respuesta larga y profunda, aproximadamente entre 1.500 y 3.000 palabras.",
        "very-long":
          "Elabora una respuesta muy extensa y rigurosa, aproximadamente entre 3.000 y 6.000 palabras.",
      }[request.lengthPreset || "auto"]

      const safetyPreset =
        request.safetyPreset ||
        (request.unrestrictedMode ? "academic" : "standard")
      const safetyThreshold =
        safetyPreset === "academic"
          ? HarmBlockThreshold.BLOCK_NONE
          : HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      const safetySettings =
        safetyPreset === "standard"
          ? undefined
          : [
              HarmCategory.HARM_CATEGORY_HARASSMENT,
              HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            ].map((category) => ({ category, threshold: safetyThreshold }))
      const documentContext = request.documentText?.trim()
        ? `\n\nDOCUMENTO ACTUAL:\n"""\n${request.documentText.trim()}\n"""`
        : ""
      const attachmentContext = request.contextText?.trim()
        ? `\n\nMATERIAL ADJUNTO:\n"""\n${request.contextText.trim()}\n"""`
        : ""
      const selectedContext = request.quotedFragment?.trim()
        ? `\n\nFRAGMENTO SELECCIONADO:\n"""\n${request.quotedFragment.trim()}\n"""`
        : ""
      const systemInstruction = `${request.systemPrompt}

${lengthInstruction}
${request.mode === "chat" ? "Responde a la pregunta con toda la profundidad necesaria; no seas breve por defecto." : ""}
${request.mode === "selection" ? "Si se solicita reescritura, devuelve únicamente el texto de reemplazo listo para aplicar." : ""}
${request.research ? "Usa la búsqueda para fundamentar la respuesta y apoya las afirmaciones verificables en las fuentes encontradas." : ""}
${documentContext}${attachmentContext}${selectedContext}`

      const finalUserParts = [{ text: request.prompt || "Analiza los archivos adjuntos." }]
      for (const attachment of request.attachments || []) {
        const roleText = `ARCHIVO: ${attachment.name}\nFUNCIÓN: ${attachment.role}`
        finalUserParts.push({ text: roleText })
        const extractedPdfText =
          attachment.kind === "pdf" &&
          attachment.text?.replace(/\s/g, "").length >= 200
        if (extractedPdfText) {
          finalUserParts.push({
            text: `TEXTO EXTRAÍDO DEL PDF:\n${attachment.text.trim()}`,
          })
        } else if (attachment.kind === "image" && attachment.dataBase64) {
          finalUserParts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.dataBase64,
            },
          })
        } else if (attachment.kind === "pdf" && attachment.dataBase64) {
          finalUserParts.push({
            inlineData: {
              mimeType: "application/pdf",
              data: attachment.dataBase64,
            },
          })
        } else if (attachment.text?.trim()) {
          finalUserParts.push({ text: attachment.text.trim() })
        }
      }
      if (request.stable) {
        event.sender.send(channel, {
          type: "phase",
          phase: "drafting",
        })
        const stableContents =
          request.mode === "chat"
            ? [
                ...(request.history || []).map((turn) => ({
                  role: turn.role,
                  parts: [{ text: turn.content }],
                })),
                { role: "user", parts: finalUserParts },
              ]
            : request.prompt
        const stableStream = await ai.models.generateContentStream({
          model: request.model,
          contents: stableContents,
          config: {
            systemInstruction: request.systemPrompt,
            abortSignal: controller.signal,
            ...(request.model === "gemini-3.1-pro-preview"
              ? {
                  temperature: request.temperature,
                  topP: request.topP,
                }
              : {}),
            thinkingConfig: request.thinkingLevel
              ? {
                  thinkingLevel:
                    {
                      minimal: ThinkingLevel.MINIMAL,
                      low: ThinkingLevel.LOW,
                      medium: ThinkingLevel.MEDIUM,
                      high: ThinkingLevel.HIGH,
                    }[compatibleThinkingLevel],
                }
              : undefined,
            safetySettings,
          },
        })
        let stableText = ""
        let stableFinishReason
        for await (const chunk of stableStream) {
          if (controller.signal.aborted) break
          stableText += chunk.text || ""
          stableFinishReason =
            chunk.candidates?.[0]?.finishReason || stableFinishReason
          event.sender.send(channel, {
            type: "chunk",
            accumulatedText: stableText,
          })
        }
        event.sender.send(channel, {
          type: "done",
          text: stableText,
          sources: [],
          finishReason: stableFinishReason,
        })
        writeGeminiLog("info", "request-completed", {
          requestId,
          ...requestMetadata,
          stable: true,
          durationMs: Date.now() - startedAt,
          outputCharacters: stableText.length,
          finishReason: stableFinishReason,
        })
        return
      }
      if (
        request.contextText?.trim() &&
        (request.mode === "draft" || request.mode === "review")
      ) {
        finalUserParts.push({
          text:
            request.mode === "review"
              ? `BORRADOR QUE DEBES REVISAR Y REESCRIBIR:\n\n${request.contextText.trim()}`
          : request.contextText.trim(),
        })
      }
      if (
        (request.mode === "draft" || request.mode === "review") &&
        request.exerciseAnalysis?.type === "structured-questions"
      ) {
        const labels = (request.exerciseAnalysis.questions || [])
          .map((question) => String(question.label || "").trim())
          .filter(Boolean)
        if (labels.length > 0) {
          finalUserParts.push({
            text: `FORMATO DE SALIDA OBLIGATORIO. Debes producir ${labels.length} bloques separados y cada bloque debe comenzar literalmente por su etiqueta, en este orden:
${labels.map((label) => `${label} [respuesta del apartado]`).join("\n")}
No unas los apartados ni suprimas, reformules o escondas estas etiquetas.`,
          })
        }
      }

      if (
        request.mode === "analyze" ||
        request.mode === "draft" ||
        request.mode === "review"
      ) {
        event.sender.send(channel, {
          type: "phase",
          phase:
            request.mode === "analyze"
              ? "reading"
              : request.mode === "review"
                ? "reviewing"
                : "drafting",
        })
        if (request.mode === "analyze") {
          const result = await ai.models.generateContent({
            model: request.model,
            contents: [{ role: "user", parts: finalUserParts }],
            config: {
              systemInstruction,
              abortSignal: controller.signal,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
              safetySettings,
              responseMimeType: "application/json",
              responseJsonSchema: exerciseAnalysisResponseSchema,
              httpOptions: { retryOptions: { attempts: 1 } },
            },
          })
          const text = result.text || "{}"
          event.sender.send(channel, {
            type: "done",
            text,
            sources: [],
          })
          writeGeminiLog("info", "request-completed", {
            requestId,
            ...requestMetadata,
            durationMs: Date.now() - startedAt,
            outputCharacters: text.length,
          })
          return
        }

        const academicStream = await ai.models.generateContentStream({
          model: request.model,
          contents: [{ role: "user", parts: finalUserParts }],
          config: {
            systemInstruction,
            abortSignal: controller.signal,
            ...(request.model === "gemini-3.1-pro-preview"
              ? {
                  temperature: request.temperature,
                  topP: request.topP,
                }
              : {}),
            thinkingConfig: {
              thinkingLevel:
                {
                  minimal: ThinkingLevel.MINIMAL,
                  low: ThinkingLevel.LOW,
                  medium: ThinkingLevel.MEDIUM,
                  high: ThinkingLevel.HIGH,
                }[compatibleThinkingLevel || "high"],
            },
            safetySettings,
            tools: request.research ? [{ googleSearch: {} }] : undefined,
            httpOptions: { retryOptions: { attempts: 1 } },
          },
        })
        let accumulatedText = ""
        const sources = new Map()
        let finishReason
        for await (const chunk of academicStream) {
          if (controller.signal.aborted) break
          accumulatedText += chunk.text || ""
          const candidate = chunk.candidates?.[0]
          finishReason = candidate?.finishReason || finishReason
          for (const groundingChunk of
            candidate?.groundingMetadata?.groundingChunks || []) {
            const web = groundingChunk.web
            if (web?.uri) {
              sources.set(web.uri, {
                title: web.title || web.uri,
                url: web.uri,
              })
            }
          }
          event.sender.send(channel, { type: "chunk", accumulatedText })
        }
        event.sender.send(channel, {
          type: "done",
          text: accumulatedText,
          sources: [...sources.values()],
          finishReason,
        })
        writeGeminiLog("info", "request-completed", {
          requestId,
          ...requestMetadata,
          durationMs: Date.now() - startedAt,
          outputCharacters: accumulatedText.length,
          finishReason,
        })
        return
      }

      const contents = [
        ...(request.history || []).map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.content }],
        })),
        { role: "user", parts: finalUserParts },
      ]
      const stream = await ai.models.generateContentStream({
        model: request.model,
        contents,
        config: {
          systemInstruction,
          abortSignal: controller.signal,
          ...(request.model === "gemini-3.1-pro-preview"
            ? { temperature: request.temperature, topP: request.topP }
            : {}),
          thinkingConfig: request.thinkingLevel
            ? {
                thinkingLevel:
                  {
                    minimal: ThinkingLevel.MINIMAL,
                    low: ThinkingLevel.LOW,
                    medium: ThinkingLevel.MEDIUM,
                    high: ThinkingLevel.HIGH,
                  }[compatibleThinkingLevel],
              }
            : undefined,
          safetySettings,
          tools: request.research ? [{ googleSearch: {} }] : undefined,
          httpOptions: { retryOptions: { attempts: 1 } },
        },
      })

      let accumulatedText = ""
      const sources = new Map()
      let finishReason
      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        accumulatedText += chunk.text || ""
        const candidate = chunk.candidates?.[0]
        finishReason = candidate?.finishReason || finishReason
        for (const groundingChunk of candidate?.groundingMetadata?.groundingChunks || []) {
          const web = groundingChunk.web
          if (web?.uri) sources.set(web.uri, { title: web.title || web.uri, url: web.uri })
        }
        event.sender.send(channel, { type: "chunk", accumulatedText })
      }
      event.sender.send(channel, {
        type: "done",
        text: accumulatedText,
        sources: [...sources.values()],
        finishReason,
      })
      writeGeminiLog("info", "request-completed", {
        requestId,
        ...requestMetadata,
        durationMs: Date.now() - startedAt,
        outputCharacters: accumulatedText.length,
        finishReason,
      })
    } catch (error) {
      const details = geminiErrorDetails(error)
      console.error("[gemini] request failed", {
        requestId,
        ...requestMetadata,
        durationMs: Date.now() - startedAt,
        ...details,
      })
      writeGeminiLog("error", "request-failed", {
        requestId,
        ...requestMetadata,
        durationMs: Date.now() - startedAt,
        ...details,
      })
      event.sender.send(channel, {
        type: "error",
        message: geminiUserMessage(error),
      })
    } finally {
      console.info("[gemini] request finished", {
        requestId,
        ...requestMetadata,
        durationMs: Date.now() - startedAt,
      })
      activeGenerations.delete(requestId)
    }
  })

  ipcMain.on("ai:cancel", (_event, requestId) => {
    if (requestId) activeGenerations.get(requestId)?.abort()
    else for (const controller of activeGenerations.values()) controller.abort()
  })

  ipcMain.handle("windows:detachDocument", (_event, documentId) => {
    createWindow(z.string().min(1).parse(documentId))
  })
  ipcMain.handle("windows:openExternal", async (_event, rawUrl) => {
    const url = new URL(z.string().url().parse(rawUrl))
    if (url.protocol !== "https:") throw new Error("Solo se permiten enlaces HTTPS.")
    await shell.openExternal(url.toString())
  })
}

app.setAppUserModelId("com.squirrel.EditorInteligenteIA.EditorInteligenteIA")

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", (_event, commandLine) => {
    const filePath = commandLine.find((argument) =>
      /\.(?:docx|odt)$/i.test(argument)
    )
    const window = BrowserWindow.getAllWindows()[0] || createWindow()
    if (window.isMinimized()) window.restore()
    window.focus()
    if (filePath) window.webContents.send("menu:command", "file:open", filePath)
  })

  app.whenReady().then(() => {
    writeGeminiLog("info", "app-ready", {
      version: app.getVersion(),
      packaged: app.isPackaged,
    })
    initDatabase()
    registerIpc()
    protocol.handle("editor", (request) => {
      const url = new URL(request.url)
      const relativePath = decodeURIComponent(url.pathname).replace(/^[/\\]+/, "") || "index.html"
      const resolvedPath = path.resolve(rendererRoot, relativePath)
      if (!resolvedPath.startsWith(rendererRoot)) {
        return new Response("Ruta no permitida", { status: 403 })
      }
      return net.fetch(pathToFileURL(resolvedPath).toString())
    })
    Menu.setApplicationMenu(buildApplicationMenu())

    const initialFile = process.argv.find((argument) =>
      /\.(?:docx|odt)$/i.test(argument)
    )
    const window = createWindow()
    void applyCustomDictionary()
    if (initialFile) {
      window.webContents.once("did-finish-load", () =>
        window.webContents.send("menu:command", "file:open", initialFile)
      )
    }
  })
}

app.on("window-all-closed", () => app.quit())
