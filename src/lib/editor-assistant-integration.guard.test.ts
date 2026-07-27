import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("integración real de Gemini con el editor", () => {
  it("inyecta el inventario y las capacidades nativas en cada turno del chat", () => {
    const source = readFileSync(
      new URL("../components/app-shell.tsx", import.meta.url),
      "utf8"
    )
    const streamStart = source.indexOf("  const streamChatTurn = async (")
    const streamEnd = source.indexOf(
      "\n  const handleSendChatMessage = (",
      streamStart
    )
    const streamSource = source.slice(streamStart, streamEnd)

    expect(streamStart).toBeGreaterThan(-1)
    expect(streamEnd).toBeGreaterThan(streamStart)
    expect(streamSource).toContain("buildEditorAssistantContext(")
    // El prompt del sistema se compone con el estado del editor y con el perfil
    // activo; el orden importa menos que el hecho de que ambos viajen siempre.
    expect(streamSource).toContain("activeGenerationSettings.systemPrompt")
    expect(streamSource).toContain(
      "buildProfileOverlay(profile, resolvedProvider)"
    )
    expect(streamSource).toContain("assistantContext,")
    expect(streamSource).toContain("parseEditorAssistantResponse(")
  })

  it("adapta el contexto y el proveedor al perfil activo", () => {
    const source = readFileSync(
      new URL("../components/app-shell.tsx", import.meta.url),
      "utf8"
    )
    const streamStart = source.indexOf("  const streamChatTurn = async (")
    const streamSource = source.slice(
      streamStart,
      source.indexOf("\n  const handleSendChatMessage = (", streamStart)
    )

    expect(streamSource).toContain("detail: profile.editorContext")
    expect(streamSource).toContain('proactive: profile.id === "design"')
    expect(streamSource).toContain("provider: resolvedProvider.provider")
    // Investigar con Gemini pasa por el módulo con búsqueda web.
    expect(streamSource).toContain("resolvedProvider.grounding")
    expect(streamSource).toContain("researchChatStream")
    // Y sus fuentes llegan al mensaje en vez de descartarse.
    expect(streamSource).toContain("sources: groundingSources")
  })

  it("permite revisar y aplicar las acciones nativas preparadas", () => {
    const panelSource = readFileSync(
      new URL("../components/canvas/gemini-panel.tsx", import.meta.url),
      "utf8"
    )
    const shellSource = readFileSync(
      new URL("../components/app-shell.tsx", import.meta.url),
      "utf8"
    )

    expect(panelSource).toContain("Acciones nativas preparadas")
    expect(panelSource).toContain("onApplyEditorActions(")
    expect(panelSource).toContain("editorActionLabel(action)")
    expect(shellSource).toContain("editorActionsApplied: true")
  })
})
