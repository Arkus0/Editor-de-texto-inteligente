import { Node, mergeAttributes } from "@tiptap/core"

/**
 * Campos de formulario rellenables: casilla, hueco de texto y desplegable.
 *
 * Word los tiene, pero para poder rellenarlos hay que ir a «Restringir edición
 * → Rellenando formularios» y proteger el documento; si se te olvida quitar la
 * protección, el archivo se queda bloqueado para todo lo demás, y esa es la
 * queja clásica de sus formularios. Aquí los campos son interactivos siempre,
 * y el bloqueo del resto del documento es un modo de vista que se activa y se
 * quita con un botón, sin tocar el archivo.
 *
 * Son nodos en línea atómicos: se comportan como una palabra dentro del
 * párrafo, se seleccionan y se borran de una pieza, y al exportar se convierten
 * en texto fiel (`☒`, el valor escrito, la opción elegida) para que impriman
 * bien y se vean igual en Word o LibreOffice.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    formFields: {
      insertFormCheckbox: (label?: string) => ReturnType
      insertFormTextField: (placeholder?: string) => ReturnType
      insertFormDropdown: (options?: string[]) => ReturnType
    }
  }
}

function createFieldId() {
  return `field-${Math.random().toString(36).slice(2, 10)}`
}

/** Ancho visible de un hueco de texto vacío, en caracteres. */
const DEFAULT_TEXT_FIELD_WIDTH = 18

export const FormCheckbox = Node.create({
  name: "formCheckbox",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-field-id"),
      },
      checked: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-checked") === "true",
      },
      label: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-label") ?? "",
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-form-checkbox]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-form-checkbox": "true",
        "data-field-id": node.attrs.fieldId,
        "data-checked": node.attrs.checked ? "true" : "false",
        "data-label": node.attrs.label,
        class: "document-form-checkbox",
      }),
      node.attrs.checked ? "☒" : "☐",
    ]
  },

  addCommands() {
    return {
      insertFormCheckbox:
        (label = "") =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { fieldId: createFieldId(), checked: false, label },
          }),
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("span")
      dom.className = "document-form-checkbox"
      dom.setAttribute("role", "checkbox")
      dom.setAttribute("tabindex", "0")
      dom.contentEditable = "false"

      const render = (checked: boolean, label: string) => {
        dom.textContent = checked ? "☒" : "☐"
        dom.setAttribute("aria-checked", checked ? "true" : "false")
        dom.setAttribute(
          "aria-label",
          label ? `Casilla: ${label}` : "Casilla de verificación"
        )
        dom.dataset.checked = checked ? "true" : "false"
      }

      const toggle = () => {
        const position = getPos()
        if (typeof position !== "number") return
        const current = editor.state.doc.nodeAt(position)
        if (!current) return
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(position, undefined, {
            ...current.attrs,
            checked: !current.attrs.checked,
          })
        )
      }

      dom.addEventListener("mousedown", (event) => {
        event.preventDefault()
        event.stopPropagation()
        toggle()
      })
      dom.addEventListener("keydown", (event) => {
        if (event.key !== " " && event.key !== "Enter") return
        event.preventDefault()
        toggle()
      })

      render(Boolean(node.attrs.checked), String(node.attrs.label ?? ""))

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "formCheckbox") return false
          render(
            Boolean(updated.attrs.checked),
            String(updated.attrs.label ?? "")
          )
          return true
        },
        stopEvent: () => true,
      }
    }
  },
})

export const FormTextField = Node.create({
  name: "formTextField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-field-id"),
      },
      value: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-value") ?? "",
      },
      placeholder: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-placeholder") ?? "",
      },
      width: {
        default: DEFAULT_TEXT_FIELD_WIDTH,
        parseHTML: (element) =>
          Number(element.getAttribute("data-width")) ||
          DEFAULT_TEXT_FIELD_WIDTH,
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-form-text-field]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-form-text-field": "true",
        "data-field-id": node.attrs.fieldId,
        "data-value": node.attrs.value,
        "data-placeholder": node.attrs.placeholder,
        "data-width": String(node.attrs.width),
        class: "document-form-text-field",
      }),
      String(node.attrs.value ?? ""),
    ]
  },

  addCommands() {
    return {
      insertFormTextField:
        (placeholder = "") =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              fieldId: createFieldId(),
              value: "",
              placeholder,
              width: DEFAULT_TEXT_FIELD_WIDTH,
            },
          }),
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("span")
      dom.className = "document-form-text-field"
      dom.contentEditable = "false"

      const input = document.createElement("input")
      input.type = "text"
      input.className = "document-form-text-field__input"
      input.value = String(node.attrs.value ?? "")
      input.placeholder = String(node.attrs.placeholder ?? "")
      input.size = Math.max(4, Number(node.attrs.width) || DEFAULT_TEXT_FIELD_WIDTH)
      input.setAttribute(
        "aria-label",
        node.attrs.placeholder
          ? `Campo: ${node.attrs.placeholder}`
          : "Campo de texto rellenable"
      )

      input.addEventListener("input", () => {
        const position = getPos()
        if (typeof position !== "number") return
        const current = editor.state.doc.nodeAt(position)
        if (!current) return
        const transaction = editor.state.tr.setNodeMarkup(position, undefined, {
          ...current.attrs,
          value: input.value,
        })
        // Sin esto, cada letra escrita en el campo movería el cursor del
        // documento al campo y perdería el foco del `input`.
        transaction.setMeta("addToHistory", true)
        editor.view.dispatch(transaction)
      })

      dom.append(input)

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "formTextField") return false
          const value = String(updated.attrs.value ?? "")
          if (document.activeElement !== input && input.value !== value) {
            input.value = value
          }
          const placeholder = String(updated.attrs.placeholder ?? "")
          input.placeholder = placeholder
          // El ancho y la etiqueta también se editan desde la cinta y desde la
          // IA; sin refrescarlos aquí el campo se quedaba con los del momento
          // en que se insertó hasta recargar el documento.
          input.size = Math.max(
            4,
            Number(updated.attrs.width) || DEFAULT_TEXT_FIELD_WIDTH
          )
          input.setAttribute(
            "aria-label",
            placeholder ? `Campo: ${placeholder}` : "Campo de texto rellenable"
          )
          return true
        },
        stopEvent: () => true,
      }
    }
  },
})

export const FormDropdown = Node.create({
  name: "formDropdown",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-field-id"),
      },
      value: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-value") ?? "",
      },
      options: {
        default: [] as string[],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-options") ?? ""
          return raw ? raw.split("|") : []
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-form-dropdown]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const options = Array.isArray(node.attrs.options) ? node.attrs.options : []
    const value = String(node.attrs.value ?? "")
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-form-dropdown": "true",
        "data-field-id": node.attrs.fieldId,
        "data-value": value,
        "data-options": options.join("|"),
        class: "document-form-dropdown",
      }),
      // Un desplegable sin rellenar no puede imprimir la primera opción: quien
      // exportaba a Markdown un cuestionario en blanco se llevaba todas las
      // respuestas contestadas con el primer valor. Se muestran las opciones,
      // igual que hace la exportación a DOCX, PDF y ODT.
      value || (options.length ? `(${options.join(" / ")})` : "Elegir…"),
    ]
  },

  addCommands() {
    return {
      insertFormDropdown:
        (options = ["Sí", "No"]) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { fieldId: createFieldId(), value: "", options },
          }),
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("span")
      dom.className = "document-form-dropdown"
      dom.contentEditable = "false"

      const select = document.createElement("select")
      select.className = "document-form-dropdown__select"
      select.setAttribute("aria-label", "Campo desplegable")

      // Reconstruir la lista en cada `update` cerraba el desplegable y le robaba
      // el foco justo al elegir una opción, porque elegir dispara la transacción
      // que provoca el `update`. Solo se rehace cuando las opciones cambian de
      // verdad; si únicamente cambia el valor, basta con moverlo.
      let renderedOptions: string | null = null
      const fill = (options: string[], value: string) => {
        const signature = options.join("|")
        if (renderedOptions !== signature) {
          renderedOptions = signature
          select.textContent = ""
          const empty = document.createElement("option")
          empty.value = ""
          empty.textContent = "Elegir…"
          select.append(empty)
          for (const option of options) {
            const element = document.createElement("option")
            element.value = option
            element.textContent = option
            select.append(element)
          }
        }
        if (select.value !== value) select.value = value
      }

      select.addEventListener("change", () => {
        const position = getPos()
        if (typeof position !== "number") return
        const current = editor.state.doc.nodeAt(position)
        if (!current) return
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(position, undefined, {
            ...current.attrs,
            value: select.value,
          })
        )
      })

      fill(
        Array.isArray(node.attrs.options) ? node.attrs.options : [],
        String(node.attrs.value ?? "")
      )
      dom.append(select)

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "formDropdown") return false
          fill(
            Array.isArray(updated.attrs.options) ? updated.attrs.options : [],
            String(updated.attrs.value ?? "")
          )
          return true
        },
        stopEvent: () => true,
      }
    }
  },
})
