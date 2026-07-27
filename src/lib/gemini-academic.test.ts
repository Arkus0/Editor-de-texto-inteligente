import { describe, expect, it } from "vitest"

import {
  AVAILABLE_MODELS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  PROSE_STYLE_RULES,
  RECOMMENDED_TEMPERATURE,
  friendlyGeminiErrorMessage,
  supportsSamplingControls,
} from "@/lib/gemini"
import {
  DEFAULT_PROFESSIONAL_SETTINGS,
  QUICK_GENERATION_SETTINGS,
} from "@/store/useAcademicStore"
import { toAiAttachmentInput } from "@/types/academic"

describe("configuración académica de Gemini", () => {
  it("expone únicamente el catálogo acordado y usa Pro como primera opción", () => {
    expect(AVAILABLE_MODELS.map((model) => model.id)).toEqual([
      "gemini-3.1-pro-preview",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ])
  })

  it("mantiene el modo rápido fijado a máxima calidad", () => {
    expect(QUICK_GENERATION_SETTINGS).toMatchObject({
      model: "gemini-3.1-pro-preview",
      thinkingLevel: "high",
      reviewPasses: 2,
      safetyPreset: "academic",
      sourcePolicy: "material-knowledge",
      lengthPreset: "auto",
    })
  })

  it("solo envía controles de muestreo al modelo que los admite", () => {
    expect(supportsSamplingControls("gemini-3.1-pro-preview")).toBe(true)
    expect(supportsSamplingControls("gemini-3.6-flash")).toBe(false)
    expect(supportsSamplingControls("gemini-3.5-flash-lite")).toBe(false)
  })

  it("conserva la función profesional de cada adjunto", () => {
    expect(
      toAiAttachmentInput({
        id: "rubric-1",
        name: "rubrica.pdf",
        size: 1200,
        mimeType: "application/pdf",
        kind: "pdf",
        role: "rubric",
        status: "ready",
        text: "Criterios",
      })
    ).toMatchObject({
      name: "rubrica.pdf",
      role: "rubric",
      kind: "pdf",
      text: "Criterios",
    })
  })

  it("explica los fallos de red sin recomendar un reintento cobrable", () => {
    expect(
      friendlyGeminiErrorMessage(new TypeError("Failed to fetch"))
    ).toContain("no ha reintentado")
  })

  it("mantiene la temperatura por defecto en el valor recomendado por Google", () => {
    expect(DEFAULT_TEMPERATURE).toBe(RECOMMENDED_TEMPERATURE)
    expect(RECOMMENDED_TEMPERATURE).toBe(1)
  })
})

describe("las reglas de prosa no alteran la generación de borradores", () => {
  it("mantiene el prompt base intacto: las reglas se añaden, no sustituyen", () => {
    expect(DEFAULT_SYSTEM_PROMPT).not.toContain("CUIDADO DE LA PROSA")
    expect(DEFAULT_SYSTEM_PROMPT).toContain(
      "2. ESCRIBE COMO PERSONA: Usa una voz natural, directa y precisa. Evita muletillas de IA, introducciones vacías, repeticiones, conclusiones mecánicas y negritas decorativas."
    )
  })

  it("deja el borrador por defecto con el prompt base, sin reglas de prosa", () => {
    expect(DEFAULT_PROFESSIONAL_SETTINGS.systemPrompt).toBe(
      DEFAULT_SYSTEM_PROMPT
    )
    expect(QUICK_GENERATION_SETTINGS.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT)
  })

  it("subordina las preferencias de estilo a los requisitos del encargo", () => {
    expect(PROSE_STYLE_RULES).toContain(
      "ceden siempre ante los requisitos del encargo"
    )
  })
})
