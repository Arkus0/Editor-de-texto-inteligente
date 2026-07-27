import Image from "@tiptap/extension-image"

function boundedImageSpacing(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? Math.min(48, Math.max(0, Math.round(parsed)))
    : 12
}

const IMAGE_WRAPS = new Set([
  "none",
  "square-left",
  "square-right",
  "tight-left",
  "tight-right",
  "behind",
  "in-front",
])

export const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (element) =>
          element.getAttribute("data-image-align") ?? "center",
        renderHTML: (attributes) => ({
          "data-image-align": attributes.align ?? "center",
        }),
      },
      wrap: {
        default: "none",
        parseHTML: (element) => {
          const value = element.getAttribute("data-image-wrap")
          return value && IMAGE_WRAPS.has(value) ? value : "none"
        },
        renderHTML: (attributes) => ({
          "data-image-wrap":
            typeof attributes.wrap === "string" &&
            IMAGE_WRAPS.has(attributes.wrap)
              ? attributes.wrap
              : "none",
        }),
      },
      spacing: {
        default: 12,
        parseHTML: (element) =>
          boundedImageSpacing(element.getAttribute("data-image-spacing")),
        renderHTML: (attributes) => ({
          "data-image-spacing": boundedImageSpacing(attributes.spacing),
          style: `--image-wrap-gap: ${boundedImageSpacing(attributes.spacing)}px; --image-display-height: ${Math.max(1, Number(attributes.height) || 240)}px`,
        }),
      },
    }
  },
})
