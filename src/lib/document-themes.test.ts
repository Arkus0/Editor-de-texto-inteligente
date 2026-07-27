import { describe, expect, it } from "vitest"

import {
  applyDocumentStyleTheme,
  DOCUMENT_STYLE_THEMES,
} from "@/lib/document-themes"
import { BUILT_IN_DOCUMENT_STYLES } from "@/types/document"

describe("temas del documento", () => {
  it("ofrece temas distintos sin duplicados", () => {
    expect(new Set(DOCUMENT_STYLE_THEMES.map((theme) => theme.id)).size).toBe(
      DOCUMENT_STYLE_THEMES.length
    )
    expect(DOCUMENT_STYLE_THEMES.length).toBeGreaterThanOrEqual(5)
  })

  it("aplica un tema accesible sin destruir estilos personalizados", () => {
    const styles = [
      ...BUILT_IN_DOCUMENT_STYLES.map((style) => ({ ...style })),
      { id: "CustomLegal", name: "Cláusula legal", fontSize: 10 },
    ]
    const themed = applyDocumentStyleTheme(styles, "accessible")

    expect(themed.find((style) => style.id === "Normal")).toMatchObject({
      fontFamily: "Arial",
      fontSize: 12,
      lineHeight: 1.5,
    })
    expect(themed.find((style) => style.id === "CustomLegal")).toMatchObject({
      name: "Cláusula legal",
      fontSize: 10,
    })
  })
})
