// Propiedades de estilo en línea que se descartan al pegar (fuente, tamaño,
// color) porque son la causa típica de que pegar desde la web o desde otro
// documento "traiga" un formato ajeno al del documento actual. Se conservan
// negrita/cursiva/subrayado en línea (algunos orígenes los codifican como
// estilo en vez de como <b>/<i>/<u>) porque sí son parte del significado del
// texto, no solo de su apariencia visual.
const STRIPPED_STYLE_PROPERTIES = [
  "font-family",
  "font-size",
  "color",
  "background",
  "background-color",
  "line-height",
  "letter-spacing",
]

function sanitizeStyleAttribute(value: string): string {
  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      if (!declaration) return false
      const property = declaration.split(":")[0]?.trim().toLowerCase()
      return property ? !STRIPPED_STYLE_PROPERTIES.includes(property) : false
    })
    .join("; ")
}

/**
 * "Fusiona el formato" del contenido pegado con el del documento actual, al
 * estilo de Word/Google Docs: descarta fuente/tamaño/color en línea pero
 * conserva la estructura semántica (negrita, cursiva, listas, títulos,
 * enlaces...). Se usa como comportamiento por defecto de Ctrl+V; "Pegar solo
 * texto" (Ctrl+Mayús+V) y "Mantener formato de origen" siguen aparte.
 *
 * Procesa el HTML como texto (regex de atributos), no con DOMParser, para
 * que el mismo código funcione igual en el navegador y en los tests (Node).
 */
export function mergePastedFormatting(html: string): string {
  const withoutInlineStyles = html.replace(
    /\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi,
    (match, quote: string, value: string) => {
      const cleaned = sanitizeStyleAttribute(value)
      return cleaned ? ` style=${quote}${cleaned}${quote}` : ""
    }
  )
  return withoutInlineStyles.replace(
    /<font\b([^>]*)>/gi,
    (match, attrs: string) => {
      const cleanedAttrs = attrs.replace(
        /\s(?:face|color|size)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
        ""
      )
      return `<font${cleanedAttrs}>`
    }
  )
}
