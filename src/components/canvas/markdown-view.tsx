"use client"

import * as React from "react"

/**
 * `react-markdown` y `remark-gfm` suman unos 150 KiB y solo hacen falta para
 * leer una respuesta de la IA: ni abrir, ni escribir, ni guardar un documento
 * los necesitan. Se cargan bajo demanda para no pagarlos en cada arranque.
 *
 * Hasta que el módulo llega, el texto se muestra tal cual con los saltos de
 * línea respetados. Como la IA tarda segundos en responder y el módulo llega en
 * milisegundos, en la práctica nunca se ve el estado intermedio; y una vez
 * cargado queda en memoria, así que el resto de mensajes se pintan sin esperar.
 */
type MarkdownRenderer = (props: { children: string }) => React.ReactElement

let cachedRenderer: MarkdownRenderer | null = null
let rendererRequest: Promise<MarkdownRenderer | null> | null = null

function loadMarkdownRenderer(): Promise<MarkdownRenderer | null> {
  if (cachedRenderer) return Promise.resolve(cachedRenderer)
  rendererRequest ??= Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
  ])
    .then(([markdownModule, gfmModule]) => {
      const ReactMarkdown = markdownModule.default
      const remarkGfm = gfmModule.default
      const plugins = [remarkGfm]
      cachedRenderer = function RenderedMarkdown({ children }) {
        return <ReactMarkdown remarkPlugins={plugins}>{children}</ReactMarkdown>
      }
      return cachedRenderer
    })
    .catch(() => null)
  return rendererRequest
}

export function MarkdownView({ children }: { children: string }) {
  const [renderer, setRenderer] = React.useState<MarkdownRenderer | null>(
    () => cachedRenderer
  )

  React.useEffect(() => {
    if (renderer) return
    let cancelled = false
    void loadMarkdownRenderer().then((loaded) => {
      if (!cancelled && loaded) setRenderer(() => loaded)
    })
    return () => {
      cancelled = true
    }
  }, [renderer])

  if (!renderer) {
    return <div className="whitespace-pre-wrap">{children}</div>
  }
  const Rendered = renderer
  return <Rendered>{children}</Rendered>
}
