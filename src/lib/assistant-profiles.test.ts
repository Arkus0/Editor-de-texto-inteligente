import { describe, expect, it } from "vitest"

import {
  ASSISTANT_PROFILES,
  buildProfileOverlay,
  getAssistantProfile,
  resolveProfileProvider,
  type ProviderAvailability,
} from "@/lib/assistant-profiles"

const BOTH: ProviderAvailability = {
  gemini: true,
  openrouter: true,
  global: "gemini",
}
const ONLY_OPENROUTER: ProviderAvailability = {
  gemini: false,
  openrouter: true,
  global: "openrouter",
}
const ONLY_GEMINI: ProviderAvailability = {
  gemini: true,
  openrouter: false,
  global: "gemini",
}

const write = getAssistantProfile("write")
const research = getAssistantProfile("research")
const design = getAssistantProfile("design")

describe("catálogo de perfiles", () => {
  it("expone los tres casos de uso acordados", () => {
    expect(ASSISTANT_PROFILES.map((profile) => profile.id)).toEqual([
      "write",
      "research",
      "design",
    ])
  })

  it("cae en Escribir ante un identificador desconocido", () => {
    expect(getAssistantProfile("write")).toBe(write)
    expect(
      getAssistantProfile("inexistente" as never).id
    ).toBe("write")
  })

  it("solo manda el catálogo de acciones al perfil que lo necesita", () => {
    expect(design.editorContext).toBe("full")
    expect(write.editorContext).toBe("slim")
    expect(research.editorContext).toBe("bibliography")
  })

  it("evita que Escribir hable de maquetación", () => {
    expect(write.overlay).toContain("modo Diseñar")
    expect(write.overlay).toContain("CUIDADO DE LA PROSA")
  })

  it("prohíbe inventar fuentes en Investigar", () => {
    expect(research.overlay).toContain("Nunca inventes una fuente")
  })

  it("pide diagnóstico antes de tocar en Diseñar", () => {
    expect(design.overlay).toContain("Diagnostica antes de tocar")
  })

  it("da a cada perfil acciones propias y no vacías", () => {
    for (const profile of ASSISTANT_PROFILES) {
      expect(profile.actions.length).toBeGreaterThan(0)
      const ids = profile.actions.map((action) => action.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe("reparto de proveedor por perfil", () => {
  it("con ambas claves usa el proveedor preferido de cada perfil", () => {
    expect(resolveProfileProvider(write, BOTH).provider).toBe("gemini")
    expect(resolveProfileProvider(research, BOTH).provider).toBe("gemini")
    expect(resolveProfileProvider(design, BOTH).provider).toBe("openrouter")
  })

  it("da grounding a Investigar solo cuando corre en Gemini", () => {
    expect(resolveProfileProvider(research, BOTH).grounding).toBe(true)
    expect(resolveProfileProvider(research, ONLY_OPENROUTER).grounding).toBe(
      false
    )
  })

  it("deja funcionar los tres perfiles a quien solo tiene OpenRouter", () => {
    for (const profile of ASSISTANT_PROFILES) {
      expect(resolveProfileProvider(profile, ONLY_OPENROUTER).provider).toBe(
        "openrouter"
      )
    }
  })

  it("avisa de la pérdida de fuentes en vez de fingir que verifica", () => {
    const resolved = resolveProfileProvider(research, ONLY_OPENROUTER)
    expect(resolved.notice).toContain("Sin búsqueda web")

    const overlay = buildProfileOverlay(research, resolved)
    expect(overlay).toContain("NO tienes acceso a búsqueda web")
    expect(overlay).toContain("pendientes de confirmar")
  })

  it("no añade el aviso cuando sí hay búsqueda web", () => {
    const resolved = resolveProfileProvider(research, BOTH)
    expect(resolved.notice).toBeUndefined()
    expect(buildProfileOverlay(research, resolved)).toBe(research.overlay)
  })

  it("manda Diseñar a Gemini si no hay clave de OpenRouter", () => {
    expect(resolveProfileProvider(design, ONLY_GEMINI).provider).toBe("gemini")
  })

  it("respeta la elección manual del usuario si esa clave existe", () => {
    expect(resolveProfileProvider(design, BOTH, "gemini").provider).toBe(
      "gemini"
    )
    expect(resolveProfileProvider(write, BOTH, "openrouter").provider).toBe(
      "openrouter"
    )
  })

  it("ignora una elección manual sin clave detrás", () => {
    expect(resolveProfileProvider(design, ONLY_GEMINI, "openrouter").provider).toBe(
      "gemini"
    )
  })
})
