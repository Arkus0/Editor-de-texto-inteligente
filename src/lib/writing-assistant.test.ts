import { describe, expect, it } from "vitest"

import type { WritingAssistantSettings } from "@/types/document"
import { analyzeWritingSegments } from "./writing-assistant"

const academicSettings: WritingAssistantSettings = {
  disabledRules: [],
  ignoredIssues: [],
  longSentenceThreshold: 60,
}

describe("asistente de escritura académico", () => {
  it("separa correcciones mecánicas de sugerencias de estilo", () => {
    const issues = analyzeWritingSegments(
      [
        {
          position: 10,
          text: "La la tesis  contiene un espacio , antes de la coma.",
        },
        {
          position: 100,
          text: `${Array.from(
            { length: 61 },
            (_, index) => `argumento${index}`
          ).join(" ")}.`,
        },
      ],
      academicSettings,
      "es-ES"
    )

    expect(
      issues.filter((issue) => issue.severity === "correction")
    ).toHaveLength(3)
    expect(
      issues.filter((issue) => issue.severity === "suggestion")
    ).toHaveLength(1)
    expect(issues.find((issue) => issue.ruleId === "repeated-word"))
      .toMatchObject({ replacement: "La", from: 10 })
  })

  it("respeta la puntuación francesa asignada al fragmento", () => {
    const issues = analyzeWritingSegments(
      [
        {
          position: 1,
          text: "Question : réponse ; conclusion .",
          language: "fr-FR",
        },
      ],
      academicSettings,
      "es-ES"
    )

    expect(
      issues.filter(
        (issue) => issue.ruleId === "space-before-punctuation"
      )
    ).toHaveLength(1)
    expect(issues[0].excerpt).toBe(".")
  })

  it("permite desactivar por completo la sugerencia de longitud", () => {
    const issues = analyzeWritingSegments(
      [
        {
          position: 1,
          text: `${Array.from(
            { length: 100 },
            (_, index) => `concepto${index}`
          ).join(" ")}.`,
        },
      ],
      { ...academicSettings, longSentenceThreshold: null },
      "es-ES"
    )

    expect(issues).toHaveLength(0)
  })

  it("mantiene estable la huella al mover el mismo problema", () => {
    const first = analyzeWritingSegments(
      [{ position: 1, text: "que que" }],
      academicSettings,
      "es-ES"
    )[0]
    const moved = analyzeWritingSegments(
      [{ position: 500, text: "que  que" }],
      academicSettings,
      "es-ES"
    )[0]

    expect(moved.fingerprint).toBe(first.fingerprint)
    expect(moved.from).not.toBe(first.from)
  })
})
