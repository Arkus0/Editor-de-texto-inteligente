import { afterEach, describe, expect, it, vi } from "vitest"

import { attachResizeHandles } from "@/editor/extensions/resize-handles"

/**
 * El módulo trabaja contra el DOM real, pero solo usa cinco operaciones. Un
 * doble mínimo evita meter `jsdom` en una suite que hoy corre entera en Node en
 * menos de dos segundos.
 */
type Listener = (event: unknown) => void

interface ElementDouble {
  className: string
  listeners: Map<string, Set<Listener>>
  removed: boolean
  setAttribute: () => void
  appendChild: () => void
  addEventListener: (type: string, listener: Listener) => void
  remove: () => void
}

function createDomDouble() {
  const documentListeners = new Map<string, Set<Listener>>()
  const created: ElementDouble[] = []

  const createElement = (): ElementDouble => {
    const listeners = new Map<string, Set<Listener>>()
    const element: ElementDouble = {
      className: "",
      listeners,
      removed: false,
      setAttribute: () => undefined,
      appendChild: () => undefined,
      addEventListener: (type, listener) => {
        const set = listeners.get(type) ?? new Set<Listener>()
        set.add(listener)
        listeners.set(type, set)
      },
      remove: () => {
        element.removed = true
      },
    }
    created.push(element)
    return element
  }

  const documentDouble = {
    createElement,
    addEventListener: (type: string, listener: Listener) => {
      const set = documentListeners.get(type) ?? new Set<Listener>()
      set.add(listener)
      documentListeners.set(type, set)
    },
    removeEventListener: (type: string, listener: Listener) => {
      documentListeners.get(type)?.delete(listener)
    },
  }

  return {
    documentDouble,
    created,
    /** Escuchadores vivos en `document`, que es donde estaba la fuga. */
    countDocumentListeners: () =>
      [...documentListeners.values()].reduce(
        (total, set) => total + set.size,
        0
      ),
    dispatchOnDocument: (type: string, event: unknown) => {
      for (const listener of [...(documentListeners.get(type) ?? [])]) {
        listener(event)
      }
    },
  }
}

function mouseEvent(clientX: number, clientY: number) {
  return {
    clientX,
    clientY,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  }
}

function setUp() {
  const dom = createDomDouble()
  vi.stubGlobal("document", dom.documentDouble)
  const container = dom.documentDouble.createElement()
  const config = {
    minWidth: 40,
    maxWidth: 800,
    minHeight: 40,
    maxHeight: 800,
    getSize: () => ({ width: 200, height: 100 }),
    onResize: vi.fn(),
    onResizeEnd: vi.fn(),
  }
  const detach = attachResizeHandles(
    container as unknown as HTMLElement,
    config
  )

  /** Pulsa un tirador desde la esquina inferior derecha, en (200, 100). */
  const startDrag = () => {
    // El primer elemento creado es el contenedor; los cuatro siguientes son los
    // tiradores, en el orden de `CORNER_CLASS`, que empieza por `nw`.
    const handle = dom.created.find((element) =>
      element.className.includes("document-resize-handle-se")
    )
    if (!handle) throw new Error("no se creó el tirador inferior derecho")
    for (const listener of handle.listeners.get("mousedown") ?? []) {
      listener(mouseEvent(200, 100))
    }
  }

  return { dom, config, detach, startDrag }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("tiradores de redimensionado", () => {
  it("no deja escuchadores sueltos si el nodo muere en mitad del arrastre", () => {
    // Los escuchadores del arrastre viven en `document`, porque el ratón se sale
    // de la imagen al arrastrarla. Quitar los tiradores no los desenganchaba: al
    // borrar la imagen o deshacer sin soltar el botón, seguían sujetos al
    // documento llamando a `onResize` sobre un nodo que ya no existía.
    const { dom, config, detach, startDrag } = setUp()
    expect(dom.countDocumentListeners()).toBe(0)

    startDrag()
    expect(dom.countDocumentListeners()).toBeGreaterThan(0)

    detach()
    expect(dom.countDocumentListeners()).toBe(0)

    dom.dispatchOnDocument("mousemove", mouseEvent(300, 200))
    expect(config.onResize).not.toHaveBeenCalled()
  })

  it("suelta los escuchadores al terminar un arrastre normal", () => {
    const { dom, config, startDrag } = setUp()
    startDrag()

    dom.dispatchOnDocument("mousemove", mouseEvent(260, 140))
    expect(config.onResize).toHaveBeenCalledWith({ width: 260, height: 140 })

    dom.dispatchOnDocument("mouseup", mouseEvent(260, 140))
    expect(config.onResizeEnd).toHaveBeenCalledWith({ width: 260, height: 140 })
    expect(dom.countDocumentListeners()).toBe(0)
  })

  it("respeta los límites de tamaño", () => {
    const { dom, config, startDrag } = setUp()
    startDrag()

    dom.dispatchOnDocument("mousemove", mouseEvent(5_000, 5_000))
    expect(config.onResize).toHaveBeenCalledWith({ width: 800, height: 800 })

    dom.dispatchOnDocument("mousemove", mouseEvent(-5_000, -5_000))
    expect(config.onResize).toHaveBeenCalledWith({ width: 40, height: 40 })
  })

  it("cancela con Escape y devuelve el tamaño de partida", () => {
    const { dom, config, startDrag } = setUp()
    startDrag()

    dom.dispatchOnDocument("mousemove", mouseEvent(400, 300))
    dom.dispatchOnDocument("keydown", {
      key: "Escape",
      preventDefault: () => undefined,
    })

    expect(config.onResizeEnd).toHaveBeenCalledWith({ width: 200, height: 100 })
    expect(dom.countDocumentListeners()).toBe(0)
  })

  it("un segundo arrastre no acumula escuchadores del primero", () => {
    const { dom, startDrag } = setUp()
    startDrag()
    const afterFirst = dom.countDocumentListeners()
    startDrag()
    expect(dom.countDocumentListeners()).toBe(afterFirst)
  })
})
