import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import type { DocumentSearchMatch } from "@/lib/document-search"

interface SearchHighlightState {
  matches: DocumentSearchMatch[]
  activeIndex: number
}

const EMPTY_STATE: SearchHighlightState = { matches: [], activeIndex: -1 }

export const searchHighlightPluginKey = new PluginKey<SearchHighlightState>(
  "searchHighlight"
)

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchMatches: (
        matches: DocumentSearchMatch[],
        activeIndex: number
      ) => ReturnType
      clearSearchMatches: () => ReturnType
    }
  }
}

/**
 * Pinta todas las coincidencias de la búsqueda y destaca la activa.
 *
 * Word obliga a ir al panel de navegación para ver dónde están los resultados;
 * aquí se ven sobre el propio texto sin abrir nada.
 *
 * Las posiciones se remapean en cada transacción para que el resaltado siga
 * pegado a su palabra mientras se escribe, en vez de quedarse a la deriva hasta
 * la siguiente búsqueda.
 */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addCommands() {
    return {
      setSearchMatches:
        (matches, activeIndex) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(
              tr.setMeta(searchHighlightPluginKey, { matches, activeIndex })
            )
          }
          return true
        },
      clearSearchMatches:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(searchHighlightPluginKey, EMPTY_STATE))
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchHighlightState>({
        key: searchHighlightPluginKey,
        state: {
          init: () => EMPTY_STATE,
          apply: (transaction, current) => {
            const next = transaction.getMeta(searchHighlightPluginKey) as
              | SearchHighlightState
              | undefined
            if (next) return next
            if (!transaction.docChanged || current.matches.length === 0) {
              return current
            }
            return {
              activeIndex: current.activeIndex,
              matches: current.matches.map((match) => ({
                from: transaction.mapping.map(match.from),
                to: transaction.mapping.map(match.to),
              })),
            }
          },
        },
        props: {
          decorations(state) {
            const current = searchHighlightPluginKey.getState(state)
            if (!current || current.matches.length === 0) return null
            const decorations = current.matches
              .filter((match) => match.to > match.from)
              .map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class:
                    index === current.activeIndex
                      ? "document-search-match document-search-match-active"
                      : "document-search-match",
                })
              )
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
