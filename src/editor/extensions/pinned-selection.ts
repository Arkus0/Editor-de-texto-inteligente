import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

export interface PinnedSelectionRange {
  from: number
  to: number
}

export const pinnedSelectionPluginKey =
  new PluginKey<PinnedSelectionRange | null>("pinnedSelection")

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pinnedSelection: {
      setPinnedSelection: (range: PinnedSelectionRange | null) => ReturnType
    }
  }
}

/**
 * Marca en el documento el fragmento sobre el que trabaja el asistente.
 *
 * La selección nativa del navegador se apaga en cuanto el foco pasa al panel de
 * IA, así que al escribir la instrucción ya no se ve sobre qué texto se está
 * actuando. Esta decoración sobrevive al cambio de foco.
 *
 * Las posiciones se remapean en cada transacción, igual que en
 * `search-highlight`, para que la marca siga pegada a su texto mientras se edita.
 */
export const PinnedSelection = Extension.create({
  name: "pinnedSelection",

  addCommands() {
    return {
      setPinnedSelection:
        (range) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(pinnedSelectionPluginKey, range))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<PinnedSelectionRange | null>({
        key: pinnedSelectionPluginKey,
        state: {
          init: () => null,
          apply: (transaction, current) => {
            const next = transaction.getMeta(pinnedSelectionPluginKey) as
              | PinnedSelectionRange
              | null
              | undefined
            if (next !== undefined) return next
            if (!transaction.docChanged || !current) return current
            const from = transaction.mapping.map(current.from)
            const to = transaction.mapping.map(current.to)
            // Si la edición se ha comido el fragmento, la marca desaparece en
            // vez de quedarse señalando un sitio que ya no es el suyo.
            return to > from ? { from, to } : null
          },
        },
        props: {
          decorations(state) {
            const range = pinnedSelectionPluginKey.getState(state)
            if (!range || range.to <= range.from) return null
            if (range.to > state.doc.content.size) return null
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, {
                class: "ai-pinned-selection",
              }),
            ])
          },
        },
      }),
    ]
  },
})
