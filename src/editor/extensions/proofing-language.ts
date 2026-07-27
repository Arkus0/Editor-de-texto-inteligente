import { Mark, mergeAttributes } from "@tiptap/core"

const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

export const ProofingLanguageMark = Mark.create({
  name: "proofingLanguage",
  inclusive: true,

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (element) => {
          const language =
            element.getAttribute("data-proofing-language") ??
            element.getAttribute("lang")
          return language && LANGUAGE_TAG.test(language) ? language : null
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: "span[data-proofing-language]" },
      { tag: "span[lang]" },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const language =
      typeof HTMLAttributes.language === "string" &&
      LANGUAGE_TAG.test(HTMLAttributes.language)
        ? HTMLAttributes.language
        : undefined
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        language: undefined,
        lang: language,
        "data-proofing-language": language,
      }),
      0,
    ]
  },
})
