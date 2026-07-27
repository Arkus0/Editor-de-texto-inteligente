import { Extension } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"

import { computeAutoCorrectEdit } from "@/lib/autocorrect"
import {
  DEFAULT_AUTOCORRECT_SETTINGS,
  type AutoCorrectSettings,
} from "@/types/document"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    autocorrect: {
      setAutoCorrectSettings: (
        settings: AutoCorrectSettings
      ) => ReturnType
    }
  }
}

export const AutoCorrectExtension = Extension.create<
  Record<string, never>,
  { settings: AutoCorrectSettings }
>({
  name: "autocorrect",

  addStorage() {
    return {
      settings: {
        ...DEFAULT_AUTOCORRECT_SETTINGS,
        replacements: DEFAULT_AUTOCORRECT_SETTINGS.replacements.map(
          (replacement) => ({ ...replacement })
        ),
      },
    }
  },

  addCommands() {
    return {
      setAutoCorrectSettings:
        (settings) =>
        () => {
          this.storage.settings = {
            ...settings,
            replacements: settings.replacements.map((replacement) => ({
              ...replacement,
            })),
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput: (view, from, to, insertedText) => {
            if (from !== to) return false
            const $from = view.state.doc.resolve(from)
            if (
              $from.parent.type.spec.code ||
              $from.marks().some((mark) => mark.type.name === "code")
            ) {
              return false
            }
            const textBefore = view.state.doc.textBetween(
              $from.start(),
              from,
              "\n",
              "\n"
            )
            const edit = computeAutoCorrectEdit({
              textBefore,
              insertedText,
              settings: this.storage.settings,
              locale:
                view.dom.getAttribute("lang") ||
                document.documentElement.lang ||
                "es-ES",
            })
            if (!edit) return false
            view.dispatch(
              view.state.tr.insertText(
                edit.text,
                Math.max($from.start(), from - edit.removeBefore),
                to
              )
            )
            return true
          },
        },
      }),
    ]
  },
})
