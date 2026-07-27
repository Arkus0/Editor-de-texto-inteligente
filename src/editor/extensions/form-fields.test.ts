import { describe, expect, it } from "vitest"

import {
  FormCheckbox,
  FormDropdown,
  FormTextField,
} from "@/editor/extensions/form-fields"

type Attrs = Record<string, unknown>

/**
 * `renderHTML` es lo que produce `editor.getHTML()`, y ese HTML es el que
 * alimenta la exportación a Markdown y a texto. Es una función pura, así que se
 * puede comprobar sin montar el editor ni un DOM.
 */
function renderText(
  extension:
    | typeof FormCheckbox
    | typeof FormDropdown
    | typeof FormTextField,
  attrs: Attrs
): string {
  const output = extension.config.renderHTML?.call(extension as never, {
    node: { attrs } as never,
    HTMLAttributes: {},
  } as never)
  const children = Array.isArray(output) ? output : []
  return String(children.at(-1) ?? "")
}

describe("campos de formulario en el HTML del documento", () => {
  it("no da por elegida la primera opción de un desplegable en blanco", () => {
    // Se imprimía `options[0]`, así que exportar un cuestionario sin rellenar
    // devolvía todas las respuestas contestadas con el primer valor de cada
    // lista. Se muestran las opciones, igual que la exportación a DOCX y PDF.
    expect(
      renderText(FormDropdown, {
        fieldId: "f1",
        value: "",
        options: ["Buena", "Regular", "Baja"],
      })
    ).toBe("(Buena / Regular / Baja)")
  })

  it("imprime la opción elegida cuando la hay", () => {
    expect(
      renderText(FormDropdown, {
        fieldId: "f1",
        value: "Regular",
        options: ["Buena", "Regular", "Baja"],
      })
    ).toBe("Regular")
  })

  it("resuelve un desplegable sin opciones sin romper el documento", () => {
    expect(
      renderText(FormDropdown, { fieldId: "f1", value: "", options: [] })
    ).toBe("Elegir…")
  })

  it("distingue la casilla marcada de la vacía", () => {
    expect(renderText(FormCheckbox, { fieldId: "c", checked: true, label: "" }))
      .toBe("☒")
    expect(renderText(FormCheckbox, { fieldId: "c", checked: false, label: "" }))
      .toBe("☐")
  })

  it("escribe el valor del hueco de texto, no su marcador", () => {
    expect(
      renderText(FormTextField, {
        fieldId: "t",
        value: "Ana Ruiz",
        placeholder: "Nombre",
        width: 18,
      })
    ).toBe("Ana Ruiz")
    expect(
      renderText(FormTextField, {
        fieldId: "t",
        value: "",
        placeholder: "Nombre",
        width: 18,
      })
    ).toBe("")
  })
})
