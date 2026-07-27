import {
  Extension,
  Mark,
  Node,
  mergeAttributes,
  type CommandProps,
} from "@tiptap/core"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import {
  type ParagraphFormat,
  normalizeParagraphFormat,
  paragraphFormatCss,
} from "@/lib/paragraph-format"
import { attachResizeHandles } from "@/editor/extensions/resize-handles"

export interface PaginationBreak {
  pos: number
  height: number
  page: number
}

export interface RevisionDescriptor {
  id: string
  type: "insertion" | "deletion"
  author: string
  date: string
  from: number
  to: number
  text: string
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphFormat: {
      setParagraphFormat: (
        format: Partial<ParagraphFormat>
      ) => ReturnType
      resetParagraphFormat: () => ReturnType
    }
    pagination: {
      setPaginationBreaks: (breaks: PaginationBreak[]) => ReturnType
    }
    trackChanges: {
      setTrackChangesEnabled: (enabled: boolean, author?: string) => ReturnType
      acceptRevision: (id: string) => ReturnType
      rejectRevision: (id: string) => ReturnType
      acceptAllRevisions: () => ReturnType
      rejectAllRevisions: () => ReturnType
    }
  }
}

const TAB_REMEASURE_EVENT = "eti:remeasure-tab"
const POINTS_TO_PIXELS = 96 / 72

export const TabStopNode = Node.create({
  name: "tabStop",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      stop: {
        default: 36,
        parseHTML: (element) =>
          Math.max(6, Number.parseFloat(element.getAttribute("data-tab-stop") ?? "36")),
        renderHTML: (attributes) => ({
          "data-tab-stop": String(attributes.stop),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-tab-stop]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "document-tab-stop",
        contenteditable: "false",
        role: "img",
        "aria-label": `Tabulación hasta ${HTMLAttributes["data-tab-stop"] ?? 36} puntos`,
      }),
    ]
  },

  renderText() {
    return "\t"
  },

  addNodeView() {
    return ({ node }) => {
      let currentNode = node
      let frame = 0
      const dom = document.createElement("span")
      dom.className = "document-tab-stop"
      dom.contentEditable = "false"
      dom.setAttribute("role", "img")

      const measure = () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          const block = dom.closest<HTMLElement>("p, h1, h2, h3, h4, h5, h6")
          if (!block || !dom.isConnected) return
          const page = dom.closest<HTMLElement>(".doc-page")
          const pageRect = page?.getBoundingClientRect()
          const scale =
            page && pageRect && page.offsetWidth > 0
              ? pageRect.width / page.offsetWidth
              : 1
          const stop = Math.max(6, Number(currentNode.attrs.stop) || 36)
          const leftIndent = Number.parseFloat(block.style.marginLeft || "0") || 0
          dom.style.width = "0px"
          const currentLeft = dom.getBoundingClientRect().left
          const blockLeft = block.getBoundingClientRect().left
          const currentOffset = (currentLeft - blockLeft) / Math.max(scale, 0.01)
          const desiredOffset = Math.max(
            8,
            (stop - leftIndent) * POINTS_TO_PIXELS
          )
          dom.style.width = `${Math.max(8, desiredOffset - currentOffset)}px`
        })
      }

      const render = () => {
        const stop = Math.max(6, Number(currentNode.attrs.stop) || 36)
        dom.dataset.tabStop = String(stop)
        dom.setAttribute("aria-label", `Tabulación hasta ${stop} puntos`)
        measure()
      }
      const onRemeasure = () => measure()
      dom.addEventListener(TAB_REMEASURE_EVENT, onRemeasure)
      render()

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false
          currentNode = updatedNode
          render()
          return true
        },
        destroy: () => {
          cancelAnimationFrame(frame)
          dom.removeEventListener(TAB_REMEASURE_EVENT, onRemeasure)
        },
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const editor = this.editor
        if (
          editor.isActive("table") ||
          editor.isActive("bulletList") ||
          editor.isActive("orderedList")
        ) {
          return false
        }

        const { from, $from } = editor.state.selection
        let blockElement: HTMLElement | null = null
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth)
          if (node.type.name !== "paragraph" && node.type.name !== "heading") continue
          const dom = editor.view.nodeDOM($from.before(depth))
          blockElement = dom instanceof HTMLElement ? dom : null
          break
        }
        if (!blockElement) return false

        const nodeType = editor.isActive("heading") ? "heading" : "paragraph"
        const format = normalizeParagraphFormat(
          editor.getAttributes(nodeType).paragraphFormat
        )
        const page = blockElement.closest<HTMLElement>(".doc-page")
        const pageRect = page?.getBoundingClientRect()
        const scale =
          page && pageRect && page.offsetWidth > 0
            ? pageRect.width / page.offsetWidth
            : 1
        const caretLeft = editor.view.coordsAtPos(from).left
        const currentPoint =
          format.leftIndent +
          ((caretLeft - blockElement.getBoundingClientRect().left) /
            Math.max(scale, 0.01) /
            POINTS_TO_PIXELS)
        const customStop = format.tabStops.find(
          (stop) => stop > currentPoint + 2 && stop > format.leftIndent
        )
        const stop =
          customStop ??
          Math.max(36, Math.ceil((currentPoint + 1) / 36) * 36)

        return editor
          .chain()
          .focus()
          .insertContent({ type: this.name, attrs: { stop } })
          .run()
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: (editorView) => {
          let timeout = 0
          const schedule = () => {
            window.clearTimeout(timeout)
            timeout = window.setTimeout(() => {
              const tabs =
                editorView.dom.querySelectorAll<HTMLElement>(".document-tab-stop")
              tabs.forEach((tab) =>
                tab.dispatchEvent(new Event(TAB_REMEASURE_EVENT))
              )
            }, 90)
          }
          schedule()
          return {
            update: schedule,
            destroy: () => window.clearTimeout(timeout),
          }
        },
      }),
    ]
  },
})

export const NamedStyle = Extension.create({
  name: "namedStyle",

  addCommands() {
    const updateParagraphs =
      (partial: Partial<ParagraphFormat> | null) =>
      ({ state, dispatch }: CommandProps) => {
        const positions = new Set<number>()
        const { from, to, $from } = state.selection

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            positions.add(pos)
          }
          return true
        })

        if (positions.size === 0) {
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth)
            if (
              node.type.name === "paragraph" ||
              node.type.name === "heading"
            ) {
              positions.add($from.before(depth))
              break
            }
          }
        }

        if (positions.size === 0) return false
        if (!dispatch) return true

        let transaction = state.tr
        for (const pos of [...positions].sort((left, right) => right - left)) {
          const node = transaction.doc.nodeAt(pos)
          if (!node) continue
          transaction = transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            paragraphFormat:
              partial === null
                ? null
                : normalizeParagraphFormat({
                    ...normalizeParagraphFormat(node.attrs.paragraphFormat),
                    ...partial,
                  }),
          })
        }
        dispatch(transaction)
        return true
      }

    return {
      setParagraphFormat:
        (format) =>
        (props) =>
          updateParagraphs(format)(props),
      resetParagraphFormat:
        () =>
        (props) =>
          updateParagraphs(null)(props),
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          styleId: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-word-style") ||
              (element.classList.contains("word-title")
                ? "Title"
                : element.classList.contains("word-subtitle")
                  ? "Subtitle"
                  : element.classList.contains("word-heading-1")
                    ? "Heading1"
                    : element.classList.contains("word-heading-2")
                      ? "Heading2"
                      : element.classList.contains("word-heading-3")
                        ? "Heading3"
                        : element.classList.contains("word-normal")
                          ? "Normal"
                          : null),
            renderHTML: (attributes) =>
              attributes.styleId
                ? {
                    "data-word-style": attributes.styleId,
                    class: `document-style document-style-${String(
                      attributes.styleId
                    ).toLowerCase()}`,
                  }
                : {},
          },
          styleName: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-word-style-name"),
            renderHTML: (attributes) =>
              attributes.styleName
                ? { "data-word-style-name": attributes.styleName }
                : {},
          },
          paragraphFormat: {
            default: null,
            parseHTML: (element) => {
              const serialized = element.getAttribute(
                "data-paragraph-format"
              )
              if (serialized) {
                try {
                  return normalizeParagraphFormat(JSON.parse(serialized))
                } catch {
                  // Continúa con los estilos CSS importados.
                }
              }
              const hasParagraphStyle =
                element.style.marginLeft ||
                element.style.marginRight ||
                element.style.textIndent ||
                element.style.marginTop ||
                element.style.marginBottom
              if (!hasParagraphStyle) return null
              const cssNumber = (value: string, fallback: number) => {
                const parsed = Number.parseFloat(value)
                if (!Number.isFinite(parsed)) return fallback
                if (value.endsWith("pt")) return parsed
                if (value.endsWith("in")) return parsed * 72
                if (value.endsWith("cm")) return parsed * (72 / 2.54)
                return parsed * 0.75
              }
              return normalizeParagraphFormat({
                leftIndent: cssNumber(element.style.marginLeft, 0),
                rightIndent: cssNumber(element.style.marginRight, 0),
                firstLineIndent: cssNumber(element.style.textIndent, 0),
                spacingBefore: cssNumber(element.style.marginTop, 0),
                spacingAfter: cssNumber(element.style.marginBottom, 8),
              })
            },
            renderHTML: (attributes) => {
              if (!attributes.paragraphFormat) return {}
              const format = normalizeParagraphFormat(
                attributes.paragraphFormat
              )
              return {
                "data-paragraph-format": JSON.stringify(format),
                "data-keep-with-next": String(format.keepWithNext),
                "data-keep-lines-together": String(
                  format.keepLinesTogether
                ),
                "data-widow-orphan-control": String(
                  format.widowOrphanControl
                ),
                "data-page-break-before": String(format.pageBreakBefore),
                "data-suppress-line-numbers": String(
                  format.suppressLineNumbers
                ),
                style: paragraphFormatCss(format),
              }
            },
          },
        },
      },
    ]
  },
})

function parseJsonArray(element: HTMLElement, attribute: string) {
  try {
    const value = JSON.parse(element.getAttribute(attribute) ?? "[]")
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export const DocumentStructure = Extension.create({
  name: "documentStructure",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          anchorId: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-anchor-id") || element.id || null,
            renderHTML: (attributes) =>
              attributes.anchorId
                ? {
                    id: attributes.anchorId,
                    "data-anchor-id": attributes.anchorId,
                  }
                : {},
          },
          outlineNumber: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-outline-number"),
            renderHTML: (attributes) =>
              attributes.outlineNumber
                ? { "data-outline-number": attributes.outlineNumber }
                : {},
          },
        },
      },
      {
        types: ["table"],
        attributes: {
          repeatHeader: {
            default: true,
            parseHTML: (element) =>
              element.getAttribute("data-repeat-header") !== "false",
            renderHTML: (attributes) => ({
              "data-repeat-header": String(attributes.repeatHeader !== false),
            }),
          },
          allowRowBreak: {
            default: true,
            parseHTML: (element) =>
              element.getAttribute("data-allow-row-break") !== "false",
            renderHTML: (attributes) => ({
              "data-allow-row-break": String(attributes.allowRowBreak !== false),
            }),
          },
          tableStyle: {
            default: "grid",
            parseHTML: (element) =>
              element.getAttribute("data-table-style") ?? "grid",
            renderHTML: (attributes) => ({
              "data-table-style": attributes.tableStyle ?? "grid",
            }),
          },
        },
      },
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          formula: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-table-formula"),
            renderHTML: (attributes) =>
              attributes.formula
                ? { "data-table-formula": attributes.formula }
                : {},
          },
        },
      },
    ]
  },
})

export const TableOfContentsNode = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      title: {
        default: "Índice",
        parseHTML: (element) =>
          element.getAttribute("data-toc-title") ?? "Índice",
      },
      maxLevel: {
        default: 3,
        parseHTML: (element) =>
          Number(element.getAttribute("data-toc-max-level") ?? 3),
      },
      entries: {
        default: [],
        parseHTML: (element) =>
          parseJsonArray(element, "data-toc-entries"),
      },
    }
  },

  parseHTML() {
    return [{ tag: "nav[data-table-of-contents]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const entries = Array.isArray(node.attrs.entries) ? node.attrs.entries : []
    return [
      "nav",
      mergeAttributes(HTMLAttributes, {
        "data-table-of-contents": "true",
        "data-toc-title": node.attrs.title,
        "data-toc-max-level": node.attrs.maxLevel,
        "data-toc-entries": JSON.stringify(entries),
        class: "dynamic-table-of-contents",
        contenteditable: "false",
      }),
      ["h2", {}, String(node.attrs.title)],
      [
        "ol",
        {},
        ...entries.map(
          (entry: {
            id?: string
            level?: number
            number?: string
            text?: string
          }) => [
            "li",
            {
              "data-level": String(entry.level ?? 1),
              "data-target-id": entry.id ?? "",
            },
            `${entry.number ? `${entry.number} ` : ""}${entry.text ?? ""}`,
          ]
        ),
      ],
    ]
  },
})

export const CaptionNode = Node.create({
  name: "caption",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      captionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-caption-id"),
      },
      kind: {
        default: "figure",
        parseHTML: (element) =>
          element.getAttribute("data-caption-kind") ?? "figure",
      },
      number: {
        default: 1,
        parseHTML: (element) =>
          Number(element.getAttribute("data-caption-number") ?? 1),
      },
      title: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-caption-title") ?? "",
      },
      label: {
        default: "Figura",
        parseHTML: (element) =>
          element.getAttribute("data-caption-label") ?? "Figura",
      },
    }
  },

  parseHTML() {
    return [{ tag: "p[data-caption-id]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const text = `${node.attrs.label} ${node.attrs.number}${
      node.attrs.title ? `. ${node.attrs.title}` : ""
    }`
    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-caption-id": node.attrs.captionId,
        "data-caption-kind": node.attrs.kind,
        "data-caption-number": node.attrs.number,
        "data-caption-title": node.attrs.title,
        "data-caption-label": node.attrs.label,
        class: "document-caption",
        contenteditable: "false",
      }),
      text,
    ]
  },
})

export const CrossReferenceNode = Node.create({
  name: "crossReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-reference-target"),
      },
      text: {
        default: "Referencia",
        parseHTML: (element) =>
          element.getAttribute("data-reference-text") ??
          element.textContent ??
          "Referencia",
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-reference-target]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-reference-target": node.attrs.targetId,
        "data-reference-text": node.attrs.text,
        class: "cross-reference-field",
        contenteditable: "false",
      }),
      String(node.attrs.text),
    ]
  },
})

function safeTextBoxColor(value: unknown, fallback: string) {
  return typeof value === "string" &&
    /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

export const TextBoxNode = Node.create({
  name: "textBox",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      width: {
        default: 360,
        parseHTML: (element) =>
          Math.min(
            720,
            Math.max(
              160,
              Number(element.getAttribute("data-text-box-width")) || 360
            )
          ),
      },
      minHeight: {
        default: 96,
        parseHTML: (element) =>
          Math.min(
            600,
            Math.max(
              48,
              Number(element.getAttribute("data-text-box-height")) || 96
            )
          ),
      },
      align: {
        default: "center",
        parseHTML: (element) => {
          const value = element.getAttribute("data-text-box-align")
          return value === "left" || value === "right" ? value : "center"
        },
      },
      boxPosition: {
        default: "inline",
        parseHTML: (element) => {
          const value = element.getAttribute("data-text-box-position")
          return value === "float-left" || value === "float-right"
            ? value
            : "inline"
        },
      },
      background: {
        default: "#f8fafc",
        parseHTML: (element) =>
          safeTextBoxColor(
            element.getAttribute("data-text-box-background"),
            "#f8fafc"
          ),
      },
      borderColor: {
        default: "#94a3b8",
        parseHTML: (element) =>
          safeTextBoxColor(
            element.getAttribute("data-text-box-border-color"),
            "#94a3b8"
          ),
      },
      borderStyle: {
        default: "solid",
        parseHTML: (element) => {
          const value = element.getAttribute("data-text-box-border-style")
          return value === "none" ||
            value === "dashed" ||
            value === "double"
            ? value
            : "solid"
        },
      },
      padding: {
        default: 16,
        parseHTML: (element) =>
          Math.min(
            48,
            Math.max(
              4,
              Number(element.getAttribute("data-text-box-padding")) || 16
            )
          ),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-text-box]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = Math.min(720, Math.max(160, Number(node.attrs.width) || 360))
    const minHeight = Math.min(
      600,
      Math.max(48, Number(node.attrs.minHeight) || 96)
    )
    const align =
      node.attrs.align === "left" || node.attrs.align === "right"
        ? node.attrs.align
        : "center"
    const boxPosition =
      node.attrs.boxPosition === "float-left" ||
      node.attrs.boxPosition === "float-right"
        ? node.attrs.boxPosition
        : "inline"
    const background = safeTextBoxColor(
      node.attrs.background,
      "#f8fafc"
    )
    const borderColor = safeTextBoxColor(
      node.attrs.borderColor,
      "#94a3b8"
    )
    const borderStyle =
      node.attrs.borderStyle === "none" ||
      node.attrs.borderStyle === "dashed" ||
      node.attrs.borderStyle === "double"
        ? node.attrs.borderStyle
        : "solid"
    const padding = Math.min(
      48,
      Math.max(4, Number(node.attrs.padding) || 16)
    )
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-text-box": "true",
        "data-text-box-width": width,
        "data-text-box-height": minHeight,
        "data-text-box-align": align,
        "data-text-box-position": boxPosition,
        "data-text-box-background": background,
        "data-text-box-border-color": borderColor,
        "data-text-box-border-style": borderStyle,
        "data-text-box-padding": padding,
        class: `document-text-box document-text-box-${boxPosition}`,
        style: [
          `width:min(${width}px, 100%)`,
          `min-height:${minHeight}px`,
          `padding:${padding}px`,
          `background:${background}`,
          borderStyle === "none"
            ? "border:none"
            : `border:1px ${borderStyle} ${borderColor}`,
          boxPosition === "float-left"
            ? "float:left;margin:0.25rem 1rem 0.75rem 0"
            : boxPosition === "float-right"
              ? "float:right;margin:0.25rem 0 0.75rem 1rem"
              : align === "left"
                ? "margin:0.75rem auto 0.75rem 0"
                : align === "right"
                  ? "margin:0.75rem 0 0.75rem auto"
                  : "margin:0.75rem auto",
        ].join(";"),
      }),
      0,
    ]
  },
})

export const SHAPE_TYPES = [
  { id: "rectangle", label: "Rectángulo" },
  { id: "roundedRectangle", label: "Rectángulo redondeado" },
  { id: "ellipse", label: "Elipse" },
  { id: "line", label: "Línea" },
  { id: "arrow", label: "Flecha" },
] as const

export type ShapeType = (typeof SHAPE_TYPES)[number]["id"]

const SHAPE_TYPE_IDS = SHAPE_TYPES.map((shape) => shape.id)

function safeShapeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

function shapeInnerHTML(
  shapeType: ShapeType,
  width: number,
  height: number,
  fill: string,
  borderColor: string,
  borderWidth: number
): string {
  if (shapeType === "line" || shapeType === "arrow") {
    const y = height / 2
    const arrowHead =
      shapeType === "arrow"
        ? `<polygon points="${width - 1},${y} ${width - 12},${y - 7} ${width - 12},${y + 7}" fill="${borderColor}"/>`
        : ""
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="${y}" x2="${width - 1}" y2="${y}" stroke="${borderColor}" stroke-width="${borderWidth}"/>${arrowHead}</svg>`
  }
  return ""
}

function shapeContainerStyle(
  shapeType: ShapeType,
  width: number,
  height: number,
  fill: string,
  borderColor: string,
  borderWidth: number,
  borderStyle: string
): string {
  if (shapeType === "line" || shapeType === "arrow") {
    return `width:${width}px;height:${height}px;display:inline-block`
  }
  const borderRadius =
    shapeType === "ellipse" ? "50%" : shapeType === "roundedRectangle" ? "16px" : "0"
  const border =
    borderStyle === "none" || borderWidth <= 0
      ? "none"
      : `${borderWidth}px ${borderStyle} ${borderColor}`
  return `width:${width}px;height:${height}px;background:${fill};border:${border};border-radius:${borderRadius};display:inline-block`
}

export const DocumentShapeNode = Node.create({
  name: "documentShape",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      shapeType: {
        default: "rectangle" as ShapeType,
        parseHTML: (element) => {
          const value = element.getAttribute("data-shape-type")
          return SHAPE_TYPE_IDS.includes(value as ShapeType)
            ? (value as ShapeType)
            : "rectangle"
        },
      },
      width: {
        default: 160,
        parseHTML: (element) =>
          Math.min(720, Math.max(24, Number(element.getAttribute("data-shape-width")) || 160)),
      },
      height: {
        default: 100,
        parseHTML: (element) =>
          Math.min(600, Math.max(24, Number(element.getAttribute("data-shape-height")) || 100)),
      },
      fill: {
        default: "#dbeafe",
        parseHTML: (element) =>
          safeShapeColor(element.getAttribute("data-shape-fill"), "#dbeafe"),
      },
      borderColor: {
        default: "#2563eb",
        parseHTML: (element) =>
          safeShapeColor(element.getAttribute("data-shape-border-color"), "#2563eb"),
      },
      borderWidth: {
        default: 2,
        parseHTML: (element) =>
          Math.min(12, Math.max(0, Number(element.getAttribute("data-shape-border-width")) || 2)),
      },
      borderStyle: {
        default: "solid",
        parseHTML: (element) => {
          const value = element.getAttribute("data-shape-border-style")
          return value === "none" || value === "dashed" ? value : "solid"
        },
      },
      align: {
        default: "center",
        parseHTML: (element) => {
          const value = element.getAttribute("data-shape-align")
          return value === "left" || value === "right" ? value : "center"
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-shape-type]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const shapeType: ShapeType = SHAPE_TYPE_IDS.includes(node.attrs.shapeType)
      ? node.attrs.shapeType
      : "rectangle"
    const width = Math.min(720, Math.max(24, Number(node.attrs.width) || 160))
    const height = Math.min(600, Math.max(24, Number(node.attrs.height) || 100))
    const fill = safeShapeColor(node.attrs.fill, "#dbeafe")
    const borderColor = safeShapeColor(node.attrs.borderColor, "#2563eb")
    const borderWidth = Math.min(12, Math.max(0, Number(node.attrs.borderWidth) || 2))
    const borderStyle =
      node.attrs.borderStyle === "none" || node.attrs.borderStyle === "dashed"
        ? node.attrs.borderStyle
        : "solid"
    const align =
      node.attrs.align === "left" || node.attrs.align === "right"
        ? node.attrs.align
        : "center"
    const wrapperStyle = `display:flex;justify-content:${
      align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center"
    };margin:0.5rem 0`
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-shape-type": shapeType,
        "data-shape-width": width,
        "data-shape-height": height,
        "data-shape-fill": fill,
        "data-shape-border-color": borderColor,
        "data-shape-border-width": borderWidth,
        "data-shape-border-style": borderStyle,
        "data-shape-align": align,
        class: "document-shape",
        contenteditable: "false",
        style: wrapperStyle,
      }),
      [
        "div",
        {
          style: shapeContainerStyle(
            shapeType,
            width,
            height,
            fill,
            borderColor,
            borderWidth,
            borderStyle
          ),
        },
      ],
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let currentNode = node
      const dom = document.createElement("div")
      dom.className = "document-shape"
      dom.contentEditable = "false"

      const shapeBox = document.createElement("div")
      shapeBox.className = "document-shape-box"
      shapeBox.style.position = "relative"
      dom.appendChild(shapeBox)

      const shapeVisual = document.createElement("div")
      shapeVisual.className = "document-shape-visual"
      shapeVisual.style.position = "absolute"
      shapeVisual.style.inset = "0"
      shapeBox.appendChild(shapeVisual)

      const commitSize = (width: number, height: number) => {
        const pos = getPos()
        if (typeof pos !== "number") return
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(pos, undefined, {
            ...currentNode.attrs,
            width,
            height,
          })
        )
      }

      const detachHandles = attachResizeHandles(shapeBox, {
        minWidth: 24,
        maxWidth: 720,
        minHeight: 24,
        maxHeight: 600,
        getSize: () => ({
          width: Number(currentNode.attrs.width) || 160,
          height: Number(currentNode.attrs.height) || 100,
        }),
        onResize: ({ width, height }) => {
          shapeBox.style.width = `${width}px`
          shapeBox.style.height = `${height}px`
        },
        onResizeEnd: ({ width, height }) => commitSize(width, height),
      })

      const render = () => {
        const shapeType: ShapeType = SHAPE_TYPE_IDS.includes(currentNode.attrs.shapeType)
          ? currentNode.attrs.shapeType
          : "rectangle"
        const width = Math.min(720, Math.max(24, Number(currentNode.attrs.width) || 160))
        const height = Math.min(600, Math.max(24, Number(currentNode.attrs.height) || 100))
        const fill = safeShapeColor(currentNode.attrs.fill, "#dbeafe")
        const borderColor = safeShapeColor(currentNode.attrs.borderColor, "#2563eb")
        const borderWidth = Math.min(12, Math.max(0, Number(currentNode.attrs.borderWidth) || 2))
        const borderStyle =
          currentNode.attrs.borderStyle === "none" || currentNode.attrs.borderStyle === "dashed"
            ? currentNode.attrs.borderStyle
            : "solid"
        const align =
          currentNode.attrs.align === "left" || currentNode.attrs.align === "right"
            ? currentNode.attrs.align
            : "center"
        dom.style.display = "flex"
        dom.style.justifyContent =
          align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center"
        dom.style.margin = "0.5rem 0"
        shapeBox.style.width = `${width}px`
        shapeBox.style.height = `${height}px`
        if (shapeType === "line" || shapeType === "arrow") {
          shapeVisual.removeAttribute("style")
          shapeVisual.style.position = "absolute"
          shapeVisual.style.inset = "0"
          shapeVisual.innerHTML = shapeInnerHTML(
            shapeType,
            width,
            height,
            fill,
            borderColor,
            borderWidth
          )
        } else {
          const borderRadius =
            shapeType === "ellipse" ? "50%" : shapeType === "roundedRectangle" ? "16px" : "0"
          const border =
            borderStyle === "none" || borderWidth <= 0
              ? "none"
              : `${borderWidth}px ${borderStyle} ${borderColor}`
          shapeVisual.innerHTML = ""
          shapeVisual.setAttribute(
            "style",
            `position:absolute;inset:0;background:${fill};border:${border};border-radius:${borderRadius}`
          )
        }
      }
      render()

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "documentShape") return false
          currentNode = updatedNode
          render()
          return true
        },
        selectNode: () => {
          shapeBox.classList.add("document-shape-selected")
        },
        deselectNode: () => {
          shapeBox.classList.remove("document-shape-selected")
        },
        destroy: () => {
          detachHandles()
        },
      }
    }
  },
})

/**
 * KaTeX (~490 KiB de JavaScript, más un CSS de ~24KB que enlaza 60 archivos de
 * fuente de símbolos matemáticos) no forma parte del arranque: la inmensa
 * mayoría de documentos no tiene ni una fórmula. Tanto el módulo como su hoja
 * de estilo se piden la primera vez que una ecuación aparece en pantalla.
 *
 * Mientras el módulo viaja, la ecuación se muestra con su LaTeX en crudo — que
 * es exactamente lo que `renderHTML` produce— y se sustituye por la fórmula
 * compuesta en cuanto carga. A partir de la segunda ecuación el módulo ya está
 * en memoria y el renderizado es síncrono, sin parpadeo.
 */
type KatexModule = (typeof import("katex"))["default"]

let katexStylesheetInjected = false
let katexModule: KatexModule | null = null
let katexRequest: Promise<KatexModule | null> | null = null

function ensureKatexStylesheet() {
  if (katexStylesheetInjected || typeof document === "undefined") return
  katexStylesheetInjected = true
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = "/katex/katex.min.css"
  document.head.appendChild(link)
}

function loadKatex(): Promise<KatexModule | null> {
  if (katexModule) return Promise.resolve(katexModule)
  katexRequest ??= import("katex")
    .then((module) => {
      katexModule = module.default ?? (module as unknown as KatexModule)
      return katexModule
    })
    .catch(() => null)
  return katexRequest
}

/**
 * Compone la fórmula dentro de `target`. Devuelve `true` si KaTeX ya estaba
 * disponible, para que quien llama sepa si hace falta esperar.
 */
function renderEquation(target: HTMLElement, latex: string): boolean {
  if (!katexModule) return false
  try {
    katexModule.render(latex, target, {
      displayMode: true,
      throwOnError: false,
      strict: "ignore",
    })
  } catch {
    target.textContent = latex
  }
  return true
}

export const EquationNode = Node.create({
  name: "equation",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      equationId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-equation-id"),
      },
      latex: {
        default: "E = mc^2",
        parseHTML: (element) =>
          element.getAttribute("data-equation-latex") ?? "E = mc^2",
      },
      number: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-equation-number")
          return value ? Number(value) : null
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-equation-id]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-equation-id": node.attrs.equationId,
        "data-equation-latex": node.attrs.latex,
        "data-equation-number": node.attrs.number,
        class: "document-equation",
        contenteditable: "false",
      }),
      ["code", {}, String(node.attrs.latex)],
      node.attrs.number ? ["span", { class: "equation-number" }, `(${node.attrs.number})`] : "",
    ]
  },

  addNodeView() {
    return ({ node }) => {
      ensureKatexStylesheet()
      const latex = String(node.attrs.latex ?? "")
      const dom = document.createElement("div")
      dom.className = "document-equation"
      dom.dataset.equationId = String(node.attrs.equationId ?? "")
      dom.dataset.equationLatex = latex
      dom.contentEditable = "false"
      const formula = document.createElement("span")
      let destroyed = false

      if (!renderEquation(formula, latex)) {
        formula.textContent = latex
        void loadKatex().then(() => {
          if (destroyed) return
          renderEquation(formula, latex)
        })
      }

      dom.append(formula)
      if (node.attrs.number) {
        const number = document.createElement("span")
        number.className = "equation-number"
        number.textContent = `(${node.attrs.number})`
        dom.append(number)
      }
      return {
        dom,
        destroy() {
          destroyed = true
        },
      }
    }
  },
})

export const PageBreakNode = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "div[data-page-break]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "true",
        class: "manual-page-break",
        contenteditable: "false",
      }),
      ["span", {}, "Salto de página"],
    ]
  },
})

export const SectionBreakNode = Node.create({
  name: "sectionBreak",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      sectionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-section-id"),
      },
      breakType: {
        default: "nextPage",
        parseHTML: (element) =>
          element.getAttribute("data-break-type") ?? "nextPage",
      },
      label: {
        default: "Salto de sección",
        parseHTML: (element) =>
          element.getAttribute("data-label") ?? "Salto de sección",
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-section-break]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-section-break": "true",
        "data-section-id": node.attrs.sectionId,
        "data-break-type": node.attrs.breakType,
        class:
          node.attrs.breakType === "continuous"
            ? "continuous-section-break section-break"
            : "manual-page-break section-break",
        contenteditable: "false",
      }),
      ["span", {}, node.attrs.label || "Salto de sección"],
    ]
  },
})

export const FootnoteReferenceNode = Node.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      footnoteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-footnote-id"),
      },
      number: {
        default: 1,
        parseHTML: (element) =>
          Number.parseInt(
            element.getAttribute("data-footnote-number") ??
              element.textContent ??
              "1",
            10
          ),
      },
    }
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-id]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-id": node.attrs.footnoteId,
        "data-footnote-number": node.attrs.number,
        class: "footnote-reference",
        contenteditable: "false",
        title: `Nota al pie ${node.attrs.number}`,
      }),
      String(node.attrs.number),
    ]
  },

  renderText({ node }) {
    return `[${node.attrs.number}]`
  },
})

export const EndnoteReferenceNode = Node.create({
  name: "endnoteReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      endnoteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-endnote-id"),
      },
      number: {
        default: 1,
        parseHTML: (element) =>
          Number.parseInt(
            element.getAttribute("data-endnote-number") ??
              element.textContent ??
              "1",
            10
          ),
      },
    }
  },

  parseHTML() {
    return [{ tag: "sup[data-endnote-id]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-endnote-id": node.attrs.endnoteId,
        "data-endnote-number": node.attrs.number,
        class: "endnote-reference",
        contenteditable: "false",
        title: `Nota final ${node.attrs.number}`,
      }),
      String(node.attrs.number),
    ]
  },

  renderText({ node }) {
    return `[${node.attrs.number}]`
  },
})

export const CitationNode = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      clusterId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-citation-cluster-id") ||
          element.getAttribute("data-citation-source-id"),
      },
      items: {
        default: [],
        parseHTML: (element) => {
          try {
            const parsed = JSON.parse(
              element.getAttribute("data-citation-items") ?? "[]"
            )
            if (Array.isArray(parsed)) return parsed
          } catch {
            // Los documentos v0.4 usan sourceId.
          }
          const sourceId = element.getAttribute("data-citation-source-id")
          return sourceId ? [{ sourceId }] : []
        },
      },
      mode: {
        default: "parenthetical",
        parseHTML: (element) =>
          element.getAttribute("data-citation-mode") ?? "parenthetical",
      },
      sourceId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-citation-source-id"),
      },
      style: {
        default: "apa",
        parseHTML: (element) =>
          element.getAttribute("data-citation-style") ?? "apa",
      },
      label: {
        default: "(Referencia)",
        parseHTML: (element) =>
          element.getAttribute("data-citation-label") ??
          element.textContent ??
          "(Referencia)",
      },
    }
  },

  parseHTML() {
    return [
      { tag: "span[data-citation-cluster-id]" },
      { tag: "span[data-citation-source-id]" },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-citation-source-id": node.attrs.sourceId,
        "data-citation-cluster-id": node.attrs.clusterId,
        "data-citation-items": JSON.stringify(node.attrs.items ?? []),
        "data-citation-mode": node.attrs.mode,
        "data-citation-style": node.attrs.style,
        "data-citation-label": node.attrs.label,
        class: "citation-field",
        contenteditable: "false",
        title: "Cita vinculada · se actualiza con la biblioteca",
      }),
      String(node.attrs.label),
    ]
  },

  renderText({ node }) {
    return String(node.attrs.label)
  },
})

function parseBibliographyEntries(element: HTMLElement) {
  try {
    const parsed = JSON.parse(
      element.getAttribute("data-bibliography-entries") ?? "[]"
    )
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : []
  } catch {
    return []
  }
}

export const BibliographyNode = Node.create({
  name: "bibliography",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      heading: {
        default: "Bibliografía",
        parseHTML: (element) =>
          element.getAttribute("data-bibliography-heading") ?? "Bibliografía",
      },
      style: {
        default: "apa",
        parseHTML: (element) =>
          element.getAttribute("data-bibliography-style") ?? "apa",
      },
      entries: {
        default: [],
        parseHTML: parseBibliographyEntries,
      },
    }
  },

  parseHTML() {
    return [{ tag: "section[data-bibliography-field]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const entries = Array.isArray(node.attrs.entries)
      ? (node.attrs.entries as string[])
      : []
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-bibliography-field": "true",
        "data-bibliography-heading": node.attrs.heading,
        "data-bibliography-style": node.attrs.style,
        "data-bibliography-entries": JSON.stringify(entries),
        class: "bibliography-field",
        contenteditable: "false",
      }),
      ["h2", {}, String(node.attrs.heading)],
      [
        "div",
        { class: "bibliography-entries" },
        ...entries.map((entry) => ["p", {}, entry]),
      ],
    ]
  },
})

export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-comment-id": HTMLAttributes.commentId,
        class: "document-comment-range",
      }),
      0,
    ]
  },
})

function revisionAttributes() {
  return {
    revisionId: {
      default: null,
      parseHTML: (element: HTMLElement) =>
        element.getAttribute("data-revision-id"),
    },
    author: {
      default: "Autor",
      parseHTML: (element: HTMLElement) =>
        element.getAttribute("data-author") ?? "Autor",
    },
    date: {
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute("data-date"),
    },
  }
}

export const TrackedInsertionMark = Mark.create({
  name: "trackedInsertion",
  inclusive: false,

  addAttributes: revisionAttributes,

  parseHTML() {
    return [{ tag: "ins[data-revision-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ins",
      mergeAttributes(HTMLAttributes, {
        "data-revision-id": HTMLAttributes.revisionId,
        "data-author": HTMLAttributes.author,
        "data-date": HTMLAttributes.date,
        class: "tracked-insertion",
      }),
      0,
    ]
  },
})

export const TrackedDeletionMark = Mark.create({
  name: "trackedDeletion",
  inclusive: false,

  addAttributes: revisionAttributes,

  parseHTML() {
    return [{ tag: "del[data-revision-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "del",
      mergeAttributes(HTMLAttributes, {
        "data-revision-id": HTMLAttributes.revisionId,
        "data-author": HTMLAttributes.author,
        "data-date": HTMLAttributes.date,
        class: "tracked-deletion",
      }),
      0,
    ]
  },
})

function createRevisionAttributes(author: string, id?: string) {
  return {
    revisionId: id ?? crypto.randomUUID(),
    author: author.trim() || "Autor",
    date: new Date().toISOString(),
  }
}

function collectMarkRanges(
  doc: CommandProps["state"]["doc"],
  markName: "trackedInsertion" | "trackedDeletion",
  revisionId?: string
) {
  const ranges: Array<{ from: number; to: number }> = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true
    const mark = node.marks.find(
      (candidate) =>
        candidate.type.name === markName &&
        (!revisionId || candidate.attrs.revisionId === revisionId)
    )
    if (!mark) return true
    const previous = ranges.at(-1)
    if (previous && previous.to === pos) previous.to = pos + node.nodeSize
    else ranges.push({ from: pos, to: pos + node.nodeSize })
    return true
  })
  return ranges
}

function removeRevisionMarks(
  tr: CommandProps["tr"],
  markName: "trackedInsertion" | "trackedDeletion",
  revisionId?: string
) {
  const markType = tr.doc.type.schema.marks[markName]
  for (const range of collectMarkRanges(tr.doc, markName, revisionId)) {
    tr.removeMark(range.from, range.to, markType)
  }
}

function deleteRevisionRanges(
  tr: CommandProps["tr"],
  markName: "trackedInsertion" | "trackedDeletion",
  revisionId?: string
) {
  const ranges = collectMarkRanges(tr.doc, markName, revisionId)
  for (const range of ranges.reverse()) tr.delete(range.from, range.to)
}

function applyRevisionDecision(
  props: CommandProps,
  revisionId: string | undefined,
  decision: "accept" | "reject"
) {
  const { tr, dispatch } = props
  if (decision === "accept") {
    deleteRevisionRanges(tr, "trackedDeletion", revisionId)
    removeRevisionMarks(tr, "trackedInsertion", revisionId)
  } else {
    deleteRevisionRanges(tr, "trackedInsertion", revisionId)
    removeRevisionMarks(tr, "trackedDeletion", revisionId)
  }
  if (dispatch && tr.docChanged) dispatch(tr)
  return true
}

export const TrackChanges = Extension.create<
  Record<string, never>,
  {
    enabled: boolean
    author: string
    lastInsertionId: string | null
    lastInsertionAt: number
    lastInsertionTo: number
  }
>({
  name: "trackChanges",

  addStorage() {
    return {
      enabled: false,
      author: "Autor",
      lastInsertionId: null,
      lastInsertionAt: 0,
      lastInsertionTo: -1,
    }
  },

  addCommands() {
    return {
      setTrackChangesEnabled:
        (enabled, author) =>
        () => {
          this.storage.enabled = enabled
          if (author?.trim()) this.storage.author = author.trim()
          if (!enabled) {
            this.storage.lastInsertionId = null
            this.storage.lastInsertionTo = -1
          }
          return true
        },
      acceptRevision:
        (id) =>
        (props) =>
          applyRevisionDecision(props, id, "accept"),
      rejectRevision:
        (id) =>
        (props) =>
          applyRevisionDecision(props, id, "reject"),
      acceptAllRevisions:
        () =>
        (props) =>
          applyRevisionDecision(props, undefined, "accept"),
      rejectAllRevisions:
        () =>
        (props) =>
          applyRevisionDecision(props, undefined, "reject"),
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("trackChangesInput"),
        props: {
          handleTextInput: (view, from, to, text) => {
            if (!this.storage.enabled || !text) return false
            const now = Date.now()
            const canContinue =
              from === to &&
              this.storage.lastInsertionId &&
              this.storage.lastInsertionTo === from &&
              now - this.storage.lastInsertionAt < 10_000
            const insertionAttrs = createRevisionAttributes(
              this.storage.author,
              canContinue ? this.storage.lastInsertionId ?? undefined : undefined
            )
            const insertionMark =
              view.state.schema.marks.trackedInsertion.create(insertionAttrs)
            const deletionMark =
              view.state.schema.marks.trackedDeletion.create(
                createRevisionAttributes(this.storage.author)
              )
            const tr = view.state.tr
            if (to > from) tr.addMark(from, to, deletionMark)
            tr.insertText(text, to)
            tr.addMark(to, to + text.length, insertionMark)
            tr.setSelection(TextSelection.create(tr.doc, to + text.length))
            tr.setMeta("trackChangesInput", true)
            view.dispatch(tr)
            this.storage.lastInsertionId = insertionAttrs.revisionId
            this.storage.lastInsertionAt = now
            this.storage.lastInsertionTo = to + text.length
            return true
          },
          handleKeyDown: (view, event) => {
            if (
              !this.storage.enabled ||
              (event.key !== "Backspace" && event.key !== "Delete")
            ) {
              return false
            }
            const { state } = view
            let { from, to } = state.selection
            if (from === to) {
              const $position = state.doc.resolve(from)
              if (event.key === "Backspace") {
                if (from <= $position.start()) return false
                from -= 1
              } else {
                if (to >= $position.end()) return false
                to += 1
              }
            }
            if (to <= from || !state.doc.textBetween(from, to, "", "")) return false
            const insertionMark = state.schema.marks.trackedInsertion
            const deletionMark = state.schema.marks.trackedDeletion
            const tr = state.tr
            if (state.doc.rangeHasMark(from, to, insertionMark)) {
              tr.delete(from, to)
            } else if (!state.doc.rangeHasMark(from, to, deletionMark)) {
              tr.addMark(
                from,
                to,
                deletionMark.create(createRevisionAttributes(this.storage.author))
              )
            }
            tr.setSelection(TextSelection.create(tr.doc, Math.min(from, tr.doc.content.size)))
            tr.setMeta("trackChangesInput", true)
            view.dispatch(tr)
            this.storage.lastInsertionId = null
            this.storage.lastInsertionTo = -1
            event.preventDefault()
            return true
          },
        },
      }),
    ]
  },
})

const paginationPluginKey = new PluginKey<PaginationBreak[]>("pagination")

export const Pagination = Extension.create({
  name: "pagination",

  addCommands() {
    return {
      setPaginationBreaks:
        (breaks) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(paginationPluginKey, breaks))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<PaginationBreak[]>({
        key: paginationPluginKey,
        state: {
          init: () => [],
          apply: (tr, current) => tr.getMeta(paginationPluginKey) ?? current,
        },
        props: {
          decorations(state) {
            const breaks = paginationPluginKey.getState(state) ?? []
            return DecorationSet.create(
              state.doc,
              breaks.map((pageBreak) =>
                Decoration.widget(
                  pageBreak.pos,
                  () => {
                    const element = document.createElement("div")
                    element.className = "auto-page-break"
                    element.style.height = `${Math.max(1, pageBreak.height)}px`
                    element.dataset.page = String(pageBreak.page)
                    element.setAttribute("contenteditable", "false")
                    return element
                  },
                  { side: -1, key: `page-${pageBreak.page}-${pageBreak.pos}` }
                )
              )
            )
          },
        },
      }),
    ]
  },
})

export function collectRevisions(
  doc: CommandProps["state"]["doc"]
): RevisionDescriptor[] {
  const revisions: RevisionDescriptor[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true
    for (const mark of node.marks) {
      if (
        mark.type.name !== "trackedInsertion" &&
        mark.type.name !== "trackedDeletion"
      ) {
        continue
      }
      const id = String(mark.attrs.revisionId ?? "")
      if (!id) continue
      const type =
        mark.type.name === "trackedInsertion" ? "insertion" : "deletion"
      const existing = revisions.find(
        (revision) =>
          revision.id === id &&
          revision.type === type &&
          revision.to === pos
      )
      if (existing) {
        existing.to = pos + node.nodeSize
        existing.text += node.text
      } else {
        revisions.push({
          id,
          type,
          author: String(mark.attrs.author ?? "Autor"),
          date: String(mark.attrs.date ?? ""),
          from: pos,
          to: pos + node.nodeSize,
          text: node.text,
        })
      }
    }
    return true
  })
  return revisions
}
