import { describe, expect, it } from "vitest"

import {
  formattingSnapshotDescription,
  sanitizeFormattingBlock,
  sanitizeFormattingMarks,
} from "@/lib/formatting-tools"

describe("herramientas de formato", () => {
  it("copia el formato visual sin comentarios ni revisiones", () => {
    expect(
      sanitizeFormattingMarks([
        { type: "bold" },
        { type: "textStyle", attrs: { color: "#185abd", fontSize: "12pt" } },
        { type: "comment", attrs: { commentId: "comment-1" } },
        { type: "trackedInsertion", attrs: { revisionId: "revision-1" } },
      ])
    ).toEqual([
      { type: "bold", attrs: {} },
      {
        type: "textStyle",
        attrs: { color: "#185abd", fontSize: "12pt" },
      },
    ])
  })

  it("conserva solo atributos de estilo y párrafo seguros", () => {
    expect(
      sanitizeFormattingBlock("heading", {
        level: 2,
        styleId: "Heading2",
        anchorId: "stable-heading",
        outlineNumber: "1.2",
        textAlign: "center",
      })
    ).toEqual({
      blockType: "heading",
      blockAttrs: {
        level: 2,
        styleId: "Heading2",
        textAlign: "center",
      },
    })
  })

  it("explica el formato capturado en lenguaje legible", () => {
    expect(
      formattingSnapshotDescription({
        blockType: "paragraph",
        blockAttrs: { styleName: "Cuerpo", textAlign: "justify" },
        marks: [
          { type: "bold", attrs: {} },
          {
            type: "textStyle",
            attrs: { fontFamily: "Aptos", fontSize: "11pt" },
          },
        ],
      })
    ).toEqual([
      "Estilo: Cuerpo",
      "Énfasis: negrita",
      "Texto: Aptos · 11pt",
      "Alineación: justify",
    ])
  })
})
