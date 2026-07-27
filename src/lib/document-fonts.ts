export interface DocumentFontOption {
  id: string
  label: string
  cssStack: string
  category: "system" | "web"
}

// Fuentes típicas de Windows/Office. No requieren ningún recurso adicional:
// se renderizan con lo que tenga instalado quien abra el documento, igual
// que hace Word. El stack incluye una alternativa razonable de respaldo.
const SYSTEM_FONTS: DocumentFontOption[] = [
  { id: "Calibri", label: "Calibri", cssStack: "Calibri, Candara, Segoe UI, sans-serif" },
  { id: "Cambria", label: "Cambria", cssStack: "Cambria, Georgia, serif" },
  { id: "Candara", label: "Candara", cssStack: "Candara, Calibri, sans-serif" },
  { id: "Corbel", label: "Corbel", cssStack: "Corbel, Calibri, sans-serif" },
  { id: "Constantia", label: "Constantia", cssStack: "Constantia, Cambria, serif" },
  { id: "Consolas", label: "Consolas", cssStack: "Consolas, 'Courier New', monospace" },
  { id: "Arial", label: "Arial", cssStack: "Arial, Helvetica, sans-serif" },
  { id: "Arial Black", label: "Arial Black", cssStack: "'Arial Black', Arial, sans-serif" },
  { id: "Times New Roman", label: "Times New Roman", cssStack: "'Times New Roman', Times, serif" },
  { id: "Georgia", label: "Georgia", cssStack: "Georgia, 'Times New Roman', serif" },
  { id: "Garamond", label: "Garamond", cssStack: "Garamond, 'Book Antiqua', serif" },
  { id: "Book Antiqua", label: "Book Antiqua", cssStack: "'Book Antiqua', Palatino, serif" },
  { id: "Century Gothic", label: "Century Gothic", cssStack: "'Century Gothic', 'Trebuchet MS', sans-serif" },
  { id: "Tahoma", label: "Tahoma", cssStack: "Tahoma, Verdana, sans-serif" },
  { id: "Trebuchet MS", label: "Trebuchet MS", cssStack: "'Trebuchet MS', Tahoma, sans-serif" },
  { id: "Verdana", label: "Verdana", cssStack: "Verdana, Tahoma, sans-serif" },
  { id: "Segoe UI", label: "Segoe UI", cssStack: "'Segoe UI', Calibri, sans-serif" },
  { id: "Courier New", label: "Courier New", cssStack: "'Courier New', Courier, monospace" },
  { id: "Comic Sans MS", label: "Comic Sans MS", cssStack: "'Comic Sans MS', 'Comic Sans', cursive" },
  { id: "Impact", label: "Impact", cssStack: "Impact, 'Arial Black', sans-serif" },
  { id: "Palatino Linotype", label: "Palatino Linotype", cssStack: "'Palatino Linotype', Palatino, serif" },
].map((font) => ({ ...font, category: "system" as const }))

// Fuentes web autoalojadas mediante paquetes @fontsource (ver src/app/document-fonts.css).
// Se sirven en local, sin llamadas de red en tiempo de ejecución, así que funcionan
// igual en el navegador y empaquetadas en Electron. Usan su nombre real (no un hash),
// por lo que la exportación a DOCX escribe el nombre de fuente correcto.
const WEB_FONTS: DocumentFontOption[] = [
  { id: "Roboto", label: "Roboto", cssStack: "Roboto, Arial, sans-serif" },
  { id: "Open Sans", label: "Open Sans", cssStack: "'Open Sans', Arial, sans-serif" },
  { id: "Lato", label: "Lato", cssStack: "Lato, Arial, sans-serif" },
  { id: "Montserrat", label: "Montserrat", cssStack: "Montserrat, Arial, sans-serif" },
  { id: "Nunito", label: "Nunito", cssStack: "Nunito, Arial, sans-serif" },
  { id: "Playfair Display", label: "Playfair Display", cssStack: "'Playfair Display', Georgia, serif" },
  { id: "Lora", label: "Lora", cssStack: "Lora, Georgia, serif" },
  { id: "PT Serif", label: "PT Serif", cssStack: "'PT Serif', Georgia, serif" },
].map((font) => ({ ...font, category: "web" as const }))

export const DOCUMENT_FONTS: DocumentFontOption[] = [...WEB_FONTS, ...SYSTEM_FONTS]

export const DOCUMENT_FONT_CATEGORY_LABELS: Record<DocumentFontOption["category"], string> = {
  web: "Fuentes web (incluidas)",
  system: "Fuentes del sistema",
}

export function findDocumentFont(value: string): DocumentFontOption | undefined {
  const normalized = value.trim().toLowerCase()
  return DOCUMENT_FONTS.find(
    (font) =>
      font.id.toLowerCase() === normalized ||
      font.cssStack.toLowerCase() === normalized
  )
}

// Extrae el primer nombre de familia de una pila CSS ("'Open Sans', Arial" -> "Open Sans"),
// útil para mostrar el nombre corto de una fuente personalizada escrita a mano.
export function primaryFontName(cssStack: string): string {
  const first = cssStack.split(",")[0]?.trim() ?? cssStack
  return first.replace(/^['"]|['"]$/g, "")
}

// Tabla de tamaños de Word para los botones de aumentar/disminuir fuente.
export const FONT_SIZE_STEPS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96,
]

export function stepFontSize(currentPt: number, direction: 1 | -1): number {
  if (direction > 0) {
    const next = FONT_SIZE_STEPS.find((step) => step > currentPt)
    return next ?? Math.round(currentPt * 1.1)
  }
  const reversed = [...FONT_SIZE_STEPS].reverse()
  const next = reversed.find((step) => step < currentPt)
  return next ?? Math.max(1, Math.round(currentPt * 0.9))
}
