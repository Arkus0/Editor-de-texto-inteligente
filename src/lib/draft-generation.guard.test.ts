import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

function protectedDraftFlowSource() {
  const source = readFileSync(
    new URL("../components/app-shell.tsx", import.meta.url),
    "utf8"
  )
  const start = source.indexOf("  const handleGenerate = async () => {")
  const end = source.indexOf("\n  const handleStartBlank = () => {", start)

  if (start < 0 || end < 0) {
    throw new Error("No se encontró el flujo protegido de generación de borradores.")
  }

  return source.slice(start, end).replace(/\r\n/g, "\n")
}

describe("flujo protegido de borradores Gemini", () => {
  it("genera el borrador con una sola operación estable", () => {
    const source = protectedDraftFlowSource()
    expect(source.match(/generateStableAnswerStream\(/g)).toHaveLength(1)
    expect(source).not.toContain("analyzeExercise(")
    expect(source).not.toContain("generateModelAnswerStream(")
    expect(source).not.toContain("review")
  })

  it("mantiene el núcleo estable libre de funciones avanzadas cobrables", () => {
    const source = readFileSync(new URL("./gemini-stable.ts", import.meta.url), "utf8")
    expect(source.match(/generateContentStream\(/g)).toHaveLength(2)
    expect(source).toContain("retryOptions: { attempts: 1 }")
    expect(source).not.toContain("maxOutputTokens")
    expect(source).toContain("thinkingConfig")
    expect(source).toContain("supportsThinkingControls")
    expect(source).toContain("supportsSamplingControls")
    expect(source).toContain("STRUCTURED_EXERCISE_INSTRUCTION")
    expect(source).not.toContain("responseJsonSchema")
    expect(source).not.toContain("googleSearch")
  })
})
