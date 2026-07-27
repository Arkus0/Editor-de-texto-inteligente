// Fuentes reales incrustables en la exportación a PDF, además de la Roboto
// que trae pdfmake por defecto. Los .ttf viven en public/fonts/pdf (licencia
// OFL, bajados de github.com/google/fonts) y se cargan bajo demanda solo
// cuando se exporta a PDF, para no aumentar el bundle de la app.

export const PDF_FONT_FAMILY_SERIF = "PT Serif"
export const PDF_FONT_FAMILY_MONOSPACE = "Courier Prime"
export const PDF_FONT_FAMILY_SANS = "Roboto"

const PDF_FONT_FILES: Record<string, string> = {
  "PTSerif-Regular.ttf": "/fonts/pdf/PTSerif-Regular.ttf",
  "PTSerif-Bold.ttf": "/fonts/pdf/PTSerif-Bold.ttf",
  "PTSerif-Italic.ttf": "/fonts/pdf/PTSerif-Italic.ttf",
  "PTSerif-BoldItalic.ttf": "/fonts/pdf/PTSerif-BoldItalic.ttf",
  "CourierPrime-Regular.ttf": "/fonts/pdf/CourierPrime-Regular.ttf",
  "CourierPrime-Bold.ttf": "/fonts/pdf/CourierPrime-Bold.ttf",
  "CourierPrime-Italic.ttf": "/fonts/pdf/CourierPrime-Italic.ttf",
  "CourierPrime-BoldItalic.ttf": "/fonts/pdf/CourierPrime-BoldItalic.ttf",
}

const PDF_FONT_DEFINITIONS = {
  [PDF_FONT_FAMILY_SERIF]: {
    normal: "PTSerif-Regular.ttf",
    bold: "PTSerif-Bold.ttf",
    italics: "PTSerif-Italic.ttf",
    bolditalics: "PTSerif-BoldItalic.ttf",
  },
  [PDF_FONT_FAMILY_MONOSPACE]: {
    normal: "CourierPrime-Regular.ttf",
    bold: "CourierPrime-Bold.ttf",
    italics: "CourierPrime-Italic.ttf",
    bolditalics: "CourierPrime-BoldItalic.ttf",
  },
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

interface PdfMakeFontApi {
  addVirtualFileSystem: (vfs: Record<string, string>) => void
  addFonts: (fonts: Record<string, Record<string, string>>) => void
}

/**
 * Descarga los .ttf de fuentes reales e incrusta serif/monoespaciada en
 * pdfmake. Si falla la descarga (offline, empaquetado incompleto...) se
 * degrada en silencio: el PDF sigue exportándose, solo con Roboto.
 */
export async function loadPdfFonts(pdfMake: PdfMakeFontApi): Promise<boolean> {
  try {
    const entries = Object.entries(PDF_FONT_FILES)
    const vfs: Record<string, string> = {}
    await Promise.all(
      entries.map(async ([filename, url]) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`No se pudo cargar ${url}`)
        vfs[filename] = arrayBufferToBase64(await response.arrayBuffer())
      })
    )
    pdfMake.addVirtualFileSystem(vfs)
    pdfMake.addFonts(PDF_FONT_DEFINITIONS)
    return true
  } catch {
    return false
  }
}

/**
 * Traduce una pila de fuentes CSS (p.ej. "'PT Serif', Georgia, serif") a la
 * familia PDF más parecida ya incrustada, usando la familia genérica CSS
 * final de la pila (serif/monospace/sans-serif...) como pista.
 */
export function mapFontStackToPdfFamily(
  cssStack: string | undefined
): typeof PDF_FONT_FAMILY_SERIF | typeof PDF_FONT_FAMILY_MONOSPACE | typeof PDF_FONT_FAMILY_SANS {
  if (!cssStack) return PDF_FONT_FAMILY_SANS
  const segments = cssStack.split(",").map((segment) => segment.trim().toLowerCase())
  const generic = segments[segments.length - 1]
  if (generic === "monospace") return PDF_FONT_FAMILY_MONOSPACE
  if (generic === "serif") return PDF_FONT_FAMILY_SERIF
  return PDF_FONT_FAMILY_SANS
}
