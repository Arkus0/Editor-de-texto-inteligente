export interface ResizeHandlesOptions {
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
  getSize: () => { width: number; height: number }
  onResize: (size: { width: number; height: number }) => void
  onResizeEnd: (size: { width: number; height: number }) => void
}

type Corner = "nw" | "ne" | "sw" | "se"

const CORNER_CLASS: Record<Corner, string> = {
  nw: "document-resize-handle document-resize-handle-nw",
  ne: "document-resize-handle document-resize-handle-ne",
  sw: "document-resize-handle document-resize-handle-sw",
  se: "document-resize-handle document-resize-handle-se",
}

const CORNER_SIGN: Record<Corner, { x: 1 | -1; y: 1 | -1 }> = {
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
  ne: { x: 1, y: -1 },
  nw: { x: -1, y: -1 },
}

/**
 * Manejadores de esquina para redimensionar por arrastre (vanilla DOM, sin
 * React) — pensado para NodeViews de Tiptap, que en esta app se construyen
 * con addNodeView() directo (ver TabStopNode/EquationNode).
 */
export function attachResizeHandles(
  container: HTMLElement,
  options: ResizeHandlesOptions
): () => void {
  const { minWidth, maxWidth, minHeight, maxHeight, getSize, onResize, onResizeEnd } =
    options
  const handles: HTMLElement[] = []
  /**
   * Suelta los escuchadores del arrastre en curso, si lo hay.
   *
   * Viven en `document`, no en el contenedor, porque el ratón se sale de la
   * imagen mientras se arrastra. Eso significa que quitar los tiradores no basta
   * para desengancharlos: si el NodeView muere en mitad del arrastre —al borrar
   * la imagen, al deshacer, al recargar el documento— quedaban sujetos al
   * documento llamando a `onResize` sobre un nodo que ya no existe.
   */
  let releaseActiveDrag: (() => void) | null = null

  const startDrag = (corner: Corner, startEvent: MouseEvent) => {
    startEvent.preventDefault()
    startEvent.stopPropagation()
    const startX = startEvent.clientX
    const startY = startEvent.clientY
    const start = getSize()
    const sign = CORNER_SIGN[corner]

    const onMouseMove = (event: MouseEvent) => {
      const dx = (event.clientX - startX) * sign.x
      const dy = (event.clientY - startY) * sign.y
      const width = Math.min(maxWidth, Math.max(minWidth, Math.round(start.width + dx)))
      const height = Math.min(maxHeight, Math.max(minHeight, Math.round(start.height + dy)))
      onResize({ width, height })
    }
    const onMouseUp = (event: MouseEvent) => {
      release()
      const dx = (event.clientX - startX) * sign.x
      const dy = (event.clientY - startY) * sign.y
      const width = Math.min(maxWidth, Math.max(minWidth, Math.round(start.width + dx)))
      const height = Math.min(maxHeight, Math.max(minHeight, Math.round(start.height + dy)))
      onResizeEnd({ width, height })
    }
    // `Esc` cancela y devuelve la imagen a su tamaño anterior, como en Word.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      release()
      onResizeEnd({ width: start.width, height: start.height })
    }
    function release() {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("keydown", onKeyDown)
      releaseActiveDrag = null
    }

    releaseActiveDrag?.()
    releaseActiveDrag = release
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("keydown", onKeyDown)
  }

  for (const corner of Object.keys(CORNER_CLASS) as Corner[]) {
    const handle = document.createElement("span")
    handle.className = CORNER_CLASS[corner]
    handle.setAttribute("contenteditable", "false")
    handle.setAttribute("aria-hidden", "true")
    handle.addEventListener("mousedown", (event) => startDrag(corner, event))
    container.appendChild(handle)
    handles.push(handle)
  }

  return () => {
    releaseActiveDrag?.()
    for (const handle of handles) handle.remove()
  }
}
