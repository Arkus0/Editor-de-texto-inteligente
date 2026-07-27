import { describe, expect, it } from "vitest"

import {
  createDefaultDocumentWorkspaceState,
  normalizeDocumentWorkspaceState,
} from "./document"

describe("normalizeDocumentWorkspaceState", () => {
  it("conserva comentarios sin anclaje y sanea la numeración de página", () => {
    const state = createDefaultDocumentWorkspaceState()
    state.proofingLanguage = "en-GB"
    state.sections[0].pageNumberFormat = "lowerRoman"
    state.sections[0].pageNumberStart = -4
    state.sections[0].layout.lineNumbers = {
      mode: "newSection",
      start: -8,
      countBy: 500,
      distance: -12,
    }
    state.writingAssistant = {
      disabledRules: ["long-sentence"],
      ignoredIssues: ["repeated-word:que que"],
      longSentenceThreshold: 75,
    }
    state.endnotes = [
      { id: "endnote-one", number: 0, text: "Nota final académica" },
    ]
    state.pageAppearance = {
      color: "#F4F1E8",
      borderStyle: "double",
      borderColor: "#123456",
      borderWidth: 50,
      watermarkText: ` BORRADOR ${"x".repeat(150)} `,
      watermarkColor: "no-es-un-color",
      watermarkOpacity: 2,
      watermarkAngle: -500,
      hyphenation: true,
    }
    state.autocorrect = {
      enabled: true,
      capitalizeSentences: false,
      smartQuotes: false,
      smartDashes: true,
      replacements: [
        {
          id: "",
          from: `  ${"x".repeat(60)}  `,
          to: "y".repeat(140),
          caseSensitive: true,
        },
        {
          id: "invalid",
          from: "   ",
          to: "ignorar",
          caseSensitive: false,
        },
      ],
    }
    state.comments = [
      {
        id: "comment-one",
        author: "Ana",
        initials: "A",
        text: "No perder esta observación",
        createdAt: "2026-07-24T10:00:00.000Z",
        resolved: false,
        replies: [],
        anchorText: "fragmento eliminado",
        orphaned: true,
      },
    ]

    const normalized = normalizeDocumentWorkspaceState(state)

    expect(normalized.sections[0].pageNumberFormat).toBe("lowerRoman")
    expect(normalized.proofingLanguage).toBe("en-GB")
    expect(normalized.sections[0].pageNumberStart).toBe(1)
    expect(normalized.sections[0].layout.lineNumbers).toEqual({
      mode: "newSection",
      start: 1,
      countBy: 100,
      distance: 0,
    })
    expect(normalized.writingAssistant).toEqual({
      disabledRules: ["long-sentence"],
      ignoredIssues: ["repeated-word:que que"],
      longSentenceThreshold: 75,
    })
    expect(normalized.endnotes).toEqual([
      { id: "endnote-one", number: 1, text: "Nota final académica" },
    ])
    expect(normalized.pageAppearance).toEqual({
      color: "#f4f1e8",
      borderStyle: "double",
      borderColor: "#123456",
      borderWidth: 8,
      watermarkText: expect.stringMatching(/^BORRADOR .{100,}$/),
      watermarkColor: "#808080",
      watermarkOpacity: 0.8,
      watermarkAngle: -180,
      hyphenation: true,
    })
    expect(normalized.pageAppearance.watermarkText).toHaveLength(120)
    expect(normalized.schemaVersion).toBe(8)
    expect(normalized.autocorrect).toEqual({
      enabled: true,
      capitalizeSentences: false,
      smartQuotes: false,
      smartDashes: true,
      replacements: [
        {
          id: "autocorrect-1",
          from: "x".repeat(40),
          to: "y".repeat(100),
          caseSensitive: true,
        },
      ],
    })
    expect(normalized.comments[0]).toMatchObject({
      id: "comment-one",
      anchorText: "fragmento eliminado",
      orphaned: true,
    })
  })
})
