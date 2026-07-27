import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

function readProjectFile(relativeUrl: string) {
  return readFileSync(new URL(relativeUrl, import.meta.url), "utf8")
}

describe("transporte cobrable de Gemini", () => {
  it("no mezcla Interactions API con parámetros exclusivos de Enterprise", () => {
    const browserTransport = readProjectFile("./gemini.ts")
    const desktopTransport = readProjectFile("../../electron/main.cjs")

    for (const source of [browserTransport, desktopTransport]) {
      expect(source).not.toContain("interactions.create")
      expect(source).not.toContain("safety_settings")
    }
  })

  it("limita el SDK a un solo intento por operación", () => {
    const browserTransport = readProjectFile("./gemini.ts")
    const desktopTransport = readProjectFile("../../electron/main.cjs")

    expect(browserTransport).toContain("retryOptions: { attempts: 1 }")
    expect(desktopTransport).toContain("retryOptions: { attempts: 1 }")
  })

  it("no impone un techo artificial a la respuesta final", () => {
    const browserTransport = readProjectFile("./gemini.ts")
    const desktopTransport = readProjectFile("../../electron/main.cjs")

    expect(browserTransport).not.toContain("maxOutputTokens")
    expect(desktopTransport).not.toContain("maxOutputTokens")
  })

  it("prioriza el texto extraído de un PDF cuando está disponible", () => {
    const browserTransport = readProjectFile("./gemini.ts")
    const desktopTransport = readProjectFile("../../electron/main.cjs")

    expect(browserTransport).toContain("TEXTO EXTRAÍDO DEL PDF")
    expect(desktopTransport).toContain("TEXTO EXTRAÍDO DEL PDF")
  })

  it("usa una sola clave activa por proveedor para borrador y chat", () => {
    const browserTransport = readProjectFile("./gemini.ts")
    const desktopTransport = readProjectFile("../../electron/main.cjs")
    const settingsStore = readProjectFile("../store/useSettingsStore.ts")
    const appShell = readProjectFile("../components/app-shell.tsx")

    expect(settingsStore).toContain("apiKey: state.apiKey")
    expect(settingsStore).toContain(
      "openRouterApiKey: state.openRouterApiKey"
    )
    expect(browserTransport.match(/\n        apiKey,\n        mode:/g)).toHaveLength(4)
    expect(desktopTransport).toContain(
      "apiKey: z.string().trim().min(10).max(500)"
    )
    expect(desktopTransport).not.toContain("gemini-key.bin")
    expect(appShell).not.toContain("apiKeyConfigured")
    expect(appShell).toContain("if (!activeApiKey.trim())")
    expect(appShell).toContain("provider: activeProvider")
  })

  it("mantiene el preload compatible con el sandbox de Electron", () => {
    const preload = readProjectFile("../../electron/preload.cjs")
    const desktopTransport = readProjectFile("../../electron/main.cjs")

    expect(preload).not.toMatch(/require\([\"']node:(?!events|timers|url)/)
    expect(preload).toContain('ipcRenderer.send("runtime:preload-ready")')
    expect(desktopTransport).toContain('"preload-error"')
    expect(desktopTransport).toContain('"runtime:preload-ready"')
  })
})
