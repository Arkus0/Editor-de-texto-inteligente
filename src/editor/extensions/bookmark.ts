import { Mark, mergeAttributes } from "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attributes: {
        bookmarkId: string
        name: string
      }) => ReturnType
      unsetBookmark: () => ReturnType
    }
  }
}

export const BookmarkMark = Mark.create({
  name: "bookmark",
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      bookmarkId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-bookmark-id"),
      },
      name: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-bookmark-name") ?? "",
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-bookmark-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-bookmark-id": HTMLAttributes.bookmarkId,
        "data-bookmark-name": HTMLAttributes.name,
        class: "document-bookmark",
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setBookmark:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, attributes),
      unsetBookmark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
