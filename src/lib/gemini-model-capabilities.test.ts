import { describe, expect, it } from "vitest"

import {
  normalizeThinkingLevel,
  supportedThinkingLevels,
  supportsSamplingControls,
  supportsThinkingControls,
} from "./gemini"

describe("capacidades de los modelos Gemini activos", () => {
  it("ofrece razonamiento en los tres modelos y adapta el mínimo de Pro", () => {
    expect(supportsThinkingControls("gemini-3.1-pro-preview")).toBe(true)
    expect(supportsThinkingControls("gemini-3.6-flash")).toBe(true)
    expect(supportsThinkingControls("gemini-3.5-flash-lite")).toBe(true)
    expect(supportedThinkingLevels("gemini-3.1-pro-preview")).toEqual([
      "low",
      "medium",
      "high",
    ])
    expect(supportedThinkingLevels("gemini-3.6-flash")).toContain("minimal")
    expect(supportedThinkingLevels("gemini-3.5-flash-lite")).toContain(
      "minimal"
    )
    expect(
      normalizeThinkingLevel("gemini-3.1-pro-preview", "minimal")
    ).toBe("low")
  })

  it("solo permite parámetros de muestreo en Gemini 3.1 Pro", () => {
    expect(supportsSamplingControls("gemini-3.1-pro-preview")).toBe(true)
    expect(supportsSamplingControls("gemini-3.6-flash")).toBe(false)
    expect(supportsSamplingControls("gemini-3.5-flash-lite")).toBe(false)
  })
})
