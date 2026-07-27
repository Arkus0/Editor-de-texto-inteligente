/**
 * Punto único de descarga de todo lo que exporta el editor: DOCX, ODT, PDF,
 * Markdown, texto y el ZIP de combinar correspondencia.
 *
 * Dos detalles que parecen ceremonia y no lo son:
 *
 * 1. El enlace se añade al documento antes de pulsarlo. Un `<a>` suelto en
 *    memoria funciona en Chromium, pero Firefox ignora `click()` si el elemento
 *    no está en el árbol, y ahí la exportación fallaba en silencio.
 * 2. La URL del blob se libera en un turno posterior, no justo después de
 *    `click()`. Revocarla en el acto es una carrera contra el propio navegador,
 *    que todavía no ha empezado a leer el blob: con un DOCX pequeño casi nunca
 *    se nota, pero con el ZIP de una combinación de treinta destinatarios la
 *    descarga se cancelaba o llegaba truncada.
 */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  link.style.display = "none"
  document.body.append(link)
  link.click()
  link.remove()
  // Un minuto es de sobra para que arranque la descarga y sigue liberando la
  // memoria del blob aunque el usuario deje la ventana abierta toda la tarde.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
