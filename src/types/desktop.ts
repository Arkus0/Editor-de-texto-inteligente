import type {
  CitationCluster,
  CitationSource,
} from "./citation"
import type {
  AiAttachmentInput,
  AiGenerationPhase,
  ExerciseAnalysis,
  SafetyPreset,
  ThinkingLevel,
} from "./academic"
import type { ThesaurusLookupResult } from "../lib/thesaurus"

export type DesktopMenuCommand =
  | "file:new"
  | "file:open"
  | "file:save"
  | "file:saveAs"
  | "file:print"
  | "file:close"
  | "view:history"
  | "view:assistant"
  | "view:documentTools"
  | "edit:find"
  | "insert:pageBreak"
  | "insert:sectionBreak"
  | "insert:footnote"
  | "insert:references"
  | "insert:toc"
  | "insert:equation"
  | "review:comment"
  | "review:trackChanges"
  | "ai:newDraft"
  | "ai:research"

export interface OpenedDesktopDocument {
  documentId: string
  path: string
  title: string
  html: string
  markdown: string
  chatJson: string
  documentJson: string
  warnings: string[]
}

export interface SaveDesktopDocumentInput {
  documentId: string
  path?: string | null
  title: string
  html: string
  markdown: string
  bytes: Uint8Array
  format?: "docx" | "odt"
  chatJson?: string
  documentJson?: string
  createVersion?: boolean
  versionReason?: string
  conflictResolution?: "abort" | "overwrite"
}

export type SaveDesktopDocumentResult =
  | {
      status: "saved"
      path: string
      title: string
      savedAt: number
      conflictBackupPath?: string
    }
  | {
      status: "conflict"
      path: string
      title: string
      savedAt: null
      externalModifiedAt: number | null
    }

export interface RecoveryStateInput {
  documentId: string
  path?: string | null
  title: string
  html: string
  markdown: string
  chatJson?: string
  documentJson?: string
  createVersion?: boolean
  versionReason?: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  title: string
  html: string
  markdown: string
  reason: string
  createdAt: number
  pinned: boolean
  documentJson: string
}

export type AiLengthPreset = "auto" | "short" | "medium" | "long" | "very-long"
export type AiRequestMode =
  | "analyze"
  | "draft"
  | "review"
  | "chat"
  | "selection"
  | "document"

export interface DesktopAiRequest {
  apiKey: string
  mode: AiRequestMode
  stable?: boolean
  model: string
  systemPrompt: string
  temperature: number
  topP: number
  unrestrictedMode: boolean
  safetyPreset?: SafetyPreset
  thinkingLevel?: ThinkingLevel
  prompt: string
  documentText?: string
  contextText?: string
  attachments?: AiAttachmentInput[]
  exerciseAnalysis?: ExerciseAnalysis
  history?: Array<{ role: "user" | "model"; content: string }>
  quotedFragment?: string
  lengthPreset?: AiLengthPreset
  customWordCount?: number
  research?: boolean
}

export interface GroundingSource {
  title: string
  url: string
}

export interface ZoteroLibrary {
  type: "user" | "group"
  id: string
  name: string
}

export interface ZoteroConnectionInfo {
  mode: "local" | "web"
  userId: string
  username?: string
  libraries: ZoteroLibrary[]
}

export interface ZoteroItem {
  key: string
  version: number
  libraryType: "user" | "group"
  libraryId: string
  itemType: string
  title: string
  creators: Array<{
    firstName?: string
    lastName?: string
    name?: string
    creatorType?: string
  }>
  date: string
  publisher: string
  publicationTitle: string
  url: string
  DOI: string
  ISBN: string
  abstract: string
  volume: string
  issue: string
  pages: string
  edition: string
  language: string
  dateModified: string
  collections: string[]
  tags: string[]
}

export interface ZoteroCollection {
  key: string
  version: number
  name: string
  parentCollection: string | false
  itemCount?: number
}

export interface ZoteroAttachment {
  key: string
  version: number
  parentItem: string
  title: string
  filename: string
  contentType: string
  url?: string
}

export interface ZoteroFetchInput {
  mode: "local" | "web"
  libraryType: "user" | "group"
  libraryId: string
  query?: string
  collectionKey?: string
  limit?: number
}

export interface ZoteroSyncInput extends ZoteroFetchInput {
  since: number
}

export interface ZoteroSyncResult {
  items: ZoteroItem[]
  attachments: ZoteroAttachment[]
  deletedItemKeys: string[]
  deletedCollectionKeys: string[]
  libraryVersion: number
}

export interface ZoteroMergeInput {
  libraryType: "user" | "group"
  libraryId: string
  canonicalKey: string
  duplicateKey: string
  fieldChoices?: Record<string, "canonical" | "duplicate">
}

export interface CslStyleSummary {
  id: string
  title: string
  class: "in-text" | "note"
  format?: string
  fields?: string[]
  updated?: string
}

export interface CslFormatResult {
  citations: Record<string, string>
  bibliography: string[]
  styleClass: "in-text" | "note"
}

export type DesktopAiEvent =
  | { type: "phase"; phase: AiGenerationPhase }
  | { type: "chunk"; accumulatedText: string }
  | { type: "done"; text: string; sources: GroundingSource[]; finishReason?: string }

export interface EditorDesktopApi {
  isDesktop: true
  documents: {
    open: (path?: string) => Promise<OpenedDesktopDocument | null>
    save: (input: SaveDesktopDocumentInput) => Promise<SaveDesktopDocumentResult | null>
    saveRecovery: (input: RecoveryStateInput) => Promise<void>
    loadRecovery: (documentId: string) => Promise<RecoveryStateInput | null>
    listVersions: (documentId: string) => Promise<DocumentVersion[]>
    deleteVersion: (versionId: string) => Promise<void>
    pinVersion: (versionId: string, pinned: boolean) => Promise<void>
  }
  secrets: {
    hasZoteroKey: () => Promise<boolean>
    setZoteroKey: (apiKey: string) => Promise<boolean>
    clearZoteroKey: () => Promise<void>
  }
  zotero: {
    connectLocal: () => Promise<ZoteroConnectionInfo>
    connectWeb: () => Promise<ZoteroConnectionInfo>
    fetchItems: (input: ZoteroFetchInput) => Promise<ZoteroItem[]>
    fetchCollections: (input: ZoteroFetchInput) => Promise<ZoteroCollection[]>
    fetchAttachments: (
      input: ZoteroFetchInput & { parentKeys: string[] }
    ) => Promise<ZoteroAttachment[]>
    sync: (input: ZoteroSyncInput) => Promise<ZoteroSyncResult>
    mergeItems: (input: ZoteroMergeInput) => Promise<{
      canonical: ZoteroItem
      deletedKey: string
      libraryVersion: number
    }>
    openAttachment: (
      input: ZoteroFetchInput & { attachment: ZoteroAttachment }
    ) => Promise<string>
  }
  csl: {
    searchStyles: (query: string) => Promise<CslStyleSummary[]>
    fetchStyle: (styleId: string) => Promise<{
      id: string
      title: string
      class: "in-text" | "note"
      xml: string
    }>
    format: (input: {
      styleId: string
      styleXml?: string
      locale?: string
      sources: CitationSource[]
      clusters: CitationCluster[]
    }) => Promise<CslFormatResult>
  }
  dictionary: {
    addWord: (word: string) => Promise<string[]>
    removeWord: (word: string) => Promise<string[]>
    listWords: () => Promise<string[]>
    lookupSynonyms: (input: {
      word: string
      language: string
    }) => Promise<ThesaurusLookupResult>
  }
  ai: {
    testKey: (apiKey: string) => Promise<{ ok: true; model: string }>
    generate: (
      request: DesktopAiRequest,
      onEvent: (event: DesktopAiEvent) => void
    ) => Promise<{ text: string; sources: GroundingSource[]; finishReason?: string }>
    cancel: (requestId?: string) => void
  }
  windows: {
    detachDocument: (documentId: string) => Promise<void>
    openExternal: (url: string) => Promise<void>
  }
  onMenuCommand: (
    callback: (command: DesktopMenuCommand, payload?: string) => void
  ) => () => void
}

declare global {
  interface Window {
    editorDesktop?: EditorDesktopApi
  }
}
