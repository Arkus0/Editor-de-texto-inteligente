import { Node, mergeAttributes } from "@tiptap/core"

import type { ChartData, ChartKind } from "@/lib/chart"

/**
 * Gráfico a partir de una tabla del documento.
 *
 * No pretende ser el motor de gráficos de Word, que es un Excel incrustado con
 * su rejilla de datos y su asistente. Aquí los datos ya están escritos en una
 * tabla del documento, así que el gráfico se saca de ahí y se puede volver a
 * sacar cuando la tabla cambie.
 *
 * En pantalla se dibuja como SVG, que se ve nítido a cualquier zoom. Para
 * exportar se guarda además una copia en PNG, y así DOCX, PDF y ODT lo tratan
 * como una imagen normal —un camino que ya funcionaba— en vez de necesitar tres
 * implementaciones distintas.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    documentChart: {
      insertDocumentChart: (
        data: ChartData & { kind: ChartKind; title?: string }
      ) => ReturnType
      setChartKind: (kind: ChartKind) => ReturnType
      updateChartData: (data: ChartData) => ReturnType
    }
  }
}

const CHART_WIDTH = 560
const CHART_HEIGHT = 320

function attributesToData(attrs: Record<string, unknown>): ChartData {
  return {
    labels: Array.isArray(attrs.labels) ? (attrs.labels as string[]) : [],
    values: Array.isArray(attrs.values) ? (attrs.values as number[]) : [],
    seriesName: String(attrs.seriesName ?? "Serie"),
  }
}

/**
 * El dibujante se carga bajo demanda: son ~9 KiB que solo hacen falta al crear
 * un gráfico o al cambiarle la forma. Un documento guardado ya trae su PNG, así
 * que abrirlo y leerlo no descarga nada de esto.
 */
async function chartSvgFor(attrs: Record<string, unknown>) {
  const { renderChartSvg } = await import("@/lib/chart")
  return renderChartSvg({
    ...attributesToData(attrs),
    kind: (attrs.kind as ChartKind) ?? "bar",
    title: String(attrs.title ?? ""),
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
  })
}

/**
 * Convierte el SVG en PNG para poder exportarlo. Es asíncrono porque el
 * navegador necesita decodificar la imagen antes de poder pintarla en el
 * lienzo; si algo falla se deja el PNG anterior en vez de romper el nodo.
 */
async function rasterizeSvg(svg: string): Promise<string | null> {
  if (typeof document === "undefined") return null
  try {
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("svg"))
      image.src = encoded
    })
    const scale = 2 // el doble de resolución para que no se vea borroso impreso
    const canvas = document.createElement("canvas")
    canvas.width = CHART_WIDTH * scale
    canvas.height = CHART_HEIGHT * scale
    const context = canvas.getContext("2d")
    if (!context) return null
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

export const DocumentChart = Node.create({
  name: "documentChart",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      chartId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-chart-id"),
      },
      kind: {
        default: "bar",
        parseHTML: (element) => element.getAttribute("data-chart-kind") ?? "bar",
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-chart-title") ?? "",
      },
      seriesName: {
        default: "Serie",
        parseHTML: (element) =>
          element.getAttribute("data-chart-series") ?? "Serie",
      },
      labels: {
        default: [] as string[],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-chart-labels") ?? ""
          return raw ? raw.split("|") : []
        },
      },
      values: {
        default: [] as number[],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-chart-values") ?? ""
          return raw
            ? raw
                .split("|")
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value))
            : []
        },
      },
      image: {
        default: "",
        parseHTML: (element) =>
          element.querySelector("img")?.getAttribute("src") ?? "",
      },
    }
  },

  parseHTML() {
    return [{ tag: "figure[data-chart-id]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const labels = Array.isArray(node.attrs.labels) ? node.attrs.labels : []
    const values = Array.isArray(node.attrs.values) ? node.attrs.values : []
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-chart-id": node.attrs.chartId,
        "data-chart-kind": node.attrs.kind,
        "data-chart-title": node.attrs.title,
        "data-chart-series": node.attrs.seriesName,
        "data-chart-labels": labels.join("|"),
        "data-chart-values": values.join("|"),
        class: "document-chart",
      }),
      [
        "img",
        {
          src: String(node.attrs.image ?? ""),
          alt: String(node.attrs.title || node.attrs.seriesName || "Gráfico"),
        },
      ],
    ]
  },

  addCommands() {
    return {
      insertDocumentChart:
        (data) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              chartId: `chart-${Math.random().toString(36).slice(2, 10)}`,
              kind: data.kind,
              title: data.title ?? "",
              seriesName: data.seriesName,
              labels: data.labels,
              values: data.values,
              image: "",
            },
          }),

      setChartKind:
        (kind) =>
        ({ state, dispatch }) => {
          const { from } = state.selection
          const node = state.doc.nodeAt(from)
          if (!node || node.type.name !== this.name) return false
          if (dispatch) {
            dispatch(
              state.tr.setNodeMarkup(from, undefined, {
                ...node.attrs,
                kind,
                // Se vacía para que el nodo vuelva a rasterizar con la forma
                // nueva; si no, exportaría el PNG de la anterior.
                image: "",
              })
            )
          }
          return true
        },

      updateChartData:
        (data) =>
        ({ state, dispatch }) => {
          const { from } = state.selection
          const node = state.doc.nodeAt(from)
          if (!node || node.type.name !== this.name) return false
          if (dispatch) {
            dispatch(
              state.tr.setNodeMarkup(from, undefined, {
                ...node.attrs,
                ...data,
                image: "",
              })
            )
          }
          return true
        },
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("figure")
      dom.className = "document-chart"
      dom.contentEditable = "false"
      let destroyed = false
      let renderedSignature = ""

      const paint = (current: typeof node) => {
        const signature = JSON.stringify([
          current.attrs.kind,
          current.attrs.title,
          current.attrs.seriesName,
          current.attrs.labels,
          current.attrs.values,
        ])
        if (signature === renderedSignature) return
        renderedSignature = signature
        dom.dataset.chartId = String(current.attrs.chartId ?? "")

        // Mientras llega el dibujante se enseña el PNG guardado, que en un
        // documento reabierto es ya la imagen definitiva.
        const stored = String(current.attrs.image ?? "")
        if (stored && !dom.querySelector("svg")) {
          dom.innerHTML = `<img src="${stored}" alt="">`
        }

        void chartSvgFor(current.attrs).then((svg) => {
          if (destroyed) return
          dom.innerHTML = svg
          if (current.attrs.image) return
          void paintRaster(svg)
        })
      }

      const paintRaster = (svg: string) =>
        rasterizeSvg(svg).then((png) => {
          if (destroyed || !png) return
          const position = getPos()
          if (typeof position !== "number") return
          const latest = editor.state.doc.nodeAt(position)
          if (!latest || latest.type.name !== "documentChart") return
          if (latest.attrs.image) return
          const transaction = editor.state.tr.setNodeMarkup(
            position,
            undefined,
            { ...latest.attrs, image: png }
          )
          // Guardar la copia rasterizada no es una edición del usuario: no debe
          // aparecer en deshacer ni marcar el documento como modificado.
          transaction.setMeta("addToHistory", false)
          transaction.setMeta("etiChartRaster", true)
          editor.view.dispatch(transaction)
        })

      paint(node)

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "documentChart") return false
          paint(updated)
          return true
        },
        destroy() {
          destroyed = true
        },
      }
    }
  },
})
