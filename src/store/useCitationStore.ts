import { create } from "zustand"
import { persist } from "zustand/middleware"

import {
  createCitationSource,
  EMPTY_BIBLIOGRAPHY,
  formatBibliographyEntry,
  formatInlineCitation,
  type CitationSource,
  type CitationStyle,
  type DocumentBibliography,
} from "../types/citation"

export type { CitationSource, CitationStyle, DocumentBibliography }
export { formatBibliographyEntry, formatInlineCitation }

interface CitationState {
  /**
   * Biblioteca heredada de la v0.3. Desde la v0.4 las referencias viven dentro
   * del estado del documento, pero se conserva este almacén para migrarlas.
   */
  documents: Record<string, DocumentBibliography>
  setStyle: (documentId: string, style: CitationStyle) => void
  addSource: (
    documentId: string,
    source: Omit<CitationSource, "id">
  ) => CitationSource
  removeSource: (documentId: string, sourceId: string) => void
}

const emptyBibliography = (): DocumentBibliography => ({
  style: EMPTY_BIBLIOGRAPHY.style,
  sources: [],
})

export const useCitationStore = create<CitationState>()(
  persist(
    (set, get) => ({
      documents: {},
      setStyle: (documentId, style) =>
        set({
          documents: {
            ...get().documents,
            [documentId]: {
              ...(get().documents[documentId] ?? emptyBibliography()),
              style,
            },
          },
        }),
      addSource: (documentId, source) => {
        const created = createCitationSource(source)
        const current = get().documents[documentId] ?? emptyBibliography()
        set({
          documents: {
            ...get().documents,
            [documentId]: {
              ...current,
              sources: [...current.sources, created],
            },
          },
        })
        return created
      },
      removeSource: (documentId, sourceId) => {
        const current = get().documents[documentId] ?? emptyBibliography()
        set({
          documents: {
            ...get().documents,
            [documentId]: {
              ...current,
              sources: current.sources.filter(
                (source) => source.id !== sourceId
              ),
            },
          },
        })
      },
    }),
    { name: "eti-citations" }
  )
)
