import { describe, expect, it } from "vitest"

import {
  DEFAULT_AI_CONTEXT_OPTIONS,
  estimateIncludedContextCharacters,
} from "@/lib/ai-context"

describe("vista previa de contexto de IA", () => {
  const preview = {
    documentCharacters: 12_000,
    selectionCharacters: 300,
    editorStateCharacters: 2_000,
    attachmentCount: 2,
    attachmentCharacters: 8_000,
    historyTurns: 4,
  }

  it("estima todo el contexto habilitado por defecto", () => {
    expect(
      estimateIncludedContextCharacters(preview, DEFAULT_AI_CONTEXT_OPTIONS)
    ).toBe(22_300)
  })

  it("mantiene la selección aunque se retire el resto del documento", () => {
    expect(
      estimateIncludedContextCharacters(preview, {
        includeDocument: false,
        includeEditorState: false,
        includeAttachments: false,
        includeHistory: false,
      })
    ).toBe(300)
  })
})
