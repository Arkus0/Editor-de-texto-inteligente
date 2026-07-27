"use client"

import * as React from "react"
import { EditorContent, posToDOMRect, type Editor } from "@tiptap/react"
import { Loader2, Sparkles } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { MarkdownView } from "@/components/canvas/markdown-view"
import { DocumentRuler } from "@/components/canvas/document-ruler"
import { DocumentStarter } from "@/components/canvas/document-starter"
import { SelectionBubble, type FloatingSelection } from "@/components/canvas/selection-bubble"
import { formatPageNumber } from "@/lib/page-number"
import type { EditorMode } from "@/components/app-shell"
import type {
  DocumentLayoutSettings,
  PageAppearanceSettings,
  DocumentSection,
  DocumentStyleDefinition,
} from "@/types/document"
import {
  GENERATION_PHASE_LABELS,
  type AiGenerationPhase,
} from "@/types/academic"

interface DocumentCanvasProps {
  editor: Editor | null
  mode: EditorMode
  responseText: string
  generationPhase: AiGenerationPhase
  starter: React.ComponentProps<typeof DocumentStarter>
  onSelectFragment: (fragment: string, range: { from: number; to: number }) => void
  onFragmentAction: (fragment: string, range: { from: number; to: number }, instruction: string) => void
  layout: DocumentLayoutSettings
  pageAppearance: PageAppearanceSettings
  section: DocumentSection
  styles: DocumentStyleDefinition[]
  showMarkup: boolean
  /** Se superpone al documento sin desplazarlo: hoy, la barra de búsqueda. */
  overlay?: React.ReactNode
}

interface LineNumberMarker {
  top: number
  number: number
}

function styleCssColor(value: string | undefined, fallback: string) {
  return value ? (value.startsWith("#") ? value : `#${value}`) : fallback
}

function styleRuleCss(style: DocumentStyleDefinition): string {
  const declarations: string[] = []
  if (style.fontFamily) declarations.push(`font-family: ${style.fontFamily}`)
  if (style.fontSize) declarations.push(`font-size: ${style.fontSize}pt`)
  declarations.push(`font-weight: ${style.bold ? 700 : 400}`)
  declarations.push(`font-style: ${style.italic ? "italic" : "normal"}`)
  if (style.color) declarations.push(`color: ${styleCssColor(style.color, "inherit")}`)
  if (style.spacingBefore !== undefined) declarations.push(`margin-top: ${style.spacingBefore}pt`)
  if (style.spacingAfter !== undefined) declarations.push(`margin-bottom: ${style.spacingAfter}pt`)
  if (style.lineHeight !== undefined) declarations.push(`line-height: ${style.lineHeight}`)
  if (!declarations.length) return ""
  return `.doc-page .ProseMirror [data-word-style="${style.id}"] { ${declarations.join("; ")}; }`
}

export function DocumentCanvas({
  editor,
  mode,
  responseText,
  generationPhase,
  starter,
  onSelectFragment,
  onFragmentAction,
  layout,
  pageAppearance,
  section,
  styles,
  showMarkup,
  overlay,
}: DocumentCanvasProps) {
  const [floatingSelection, setFloatingSelection] = React.useState<FloatingSelection | null>(null)
  const [pageCount, setPageCount] = React.useState(1)
  const [lineNumberMarkers, setLineNumberMarkers] = React.useState<
    LineNumberMarker[]
  >([])
  const [lineNumberPreviewLimited, setLineNumberPreviewLimited] =
    React.useState(false)
  const bubbleRef = React.useRef<HTMLDivElement>(null)
  const pageRef = React.useRef<HTMLDivElement>(null)
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)
  const previousModeRef = React.useRef(mode)
  const paginationSignatureRef = React.useRef("")
  const lineNumberSignatureRef = React.useRef("")

  React.useEffect(() => {
    const enteredEditing =
      mode === "editing" && previousModeRef.current !== "editing"
    previousModeRef.current = mode
    if (!enteredEditing) return

    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const viewport =
          scrollAreaRef.current?.querySelector<HTMLElement>(
            "[data-radix-scroll-area-viewport]"
          )
        viewport?.scrollTo({ top: 0, left: 0 })
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [mode])

  React.useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const { from, to, empty } = editor.state.selection
      if (empty || mode !== "editing") {
        setFloatingSelection(null)
        return
      }
      const text = editor.state.doc.textBetween(from, to, " ").trim()
      if (!text) {
        setFloatingSelection(null)
        return
      }
      const rect = posToDOMRect(editor.view, from, to)
      setFloatingSelection({ text, top: rect.top, left: rect.left + rect.width / 2, from, to })
    }

    editor.on("selectionUpdate", updateSelection)
    return () => {
      editor.off("selectionUpdate", updateSelection)
    }
  }, [editor, mode])

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (bubbleRef.current?.contains(event.target as Node)) return
      setFloatingSelection(null)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const dismissBubble = () => {
    if (floatingSelection) editor?.commands.setTextSelection(floatingSelection.to)
    setFloatingSelection(null)
  }

  const portraitSize = layout.pageSize === "a4"
    ? { width: 794, height: 1123 }
    : { width: 816, height: 1056 }
  const pageSize =
    layout.orientation === "landscape"
      ? { width: portraitSize.height, height: portraitSize.width }
      : portraitSize
  const normalStyle = styles.find((style) => style.id === "Normal")
  const dynamicStyleCss = React.useMemo(
    () => styles.map(styleRuleCss).filter(Boolean).join("\n"),
    [styles]
  )

  React.useEffect(() => {
    if (!editor || mode !== "editing") return
    let frame = 0
    let debounceTimer = 0
    let idleHandle = 0

    /**
     * Altura ya medida de cada bloque, indexada por el propio nodo. Los nodos
     * de ProseMirror son inmutables: escribir una letra sustituye el párrafo
     * tocado por un objeto nuevo y deja intactos todos los demás, así que un
     * acierto de caché garantiza que ese bloque no ha cambiado.
     *
     * Sin esto, cada pausa al escribir volvía a medir el documento entero
     * —12,5 ms con 2.200 bloques, y creciendo en proporción al documento—
     * cuando en realidad solo uno podía haber cambiado de altura.
     *
     * La caché se vacía cuando el ResizeObserver detecta que la página ha
     * cambiado de alto, que es lo que ocurre si se carga una fuente o una
     * imagen, o si cambia el tema de estilos: en esos casos las alturas
     * anteriores dejan de ser válidas aunque los nodos sean los mismos.
     */
    let blockHeights = new WeakMap<object, number>()

    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const contentHeight = Math.max(
          120,
          pageSize.height - layout.margins.top - layout.margins.bottom
        )
        const pageGap = 28
        const breaks: Array<{ pos: number; height: number; page: number }> = []
        const measuredBlocks: Array<{
          pos: number
          height: number
          type: string
          breakType?: string
          keepWithNext: boolean
          pageBreakBefore: boolean
        }> = []
        let used = 0
        let pages = 1

        editor.state.doc.forEach((node, offset) => {
          if (
            node.type.name === "pageBreak" ||
            node.type.name === "sectionBreak"
          ) {
            measuredBlocks.push({
              pos: offset,
              height: 0,
              type: node.type.name,
              breakType: String(node.attrs.breakType ?? ""),
              keepWithNext: false,
              pageBreakBefore: false,
            })
            return
          }
          let height = blockHeights.get(node)
          if (height === undefined) {
            const dom = editor.view.nodeDOM(offset)
            const element =
              dom instanceof HTMLElement
                ? dom
                : dom?.parentElement instanceof HTMLElement
                  ? dom.parentElement
                  : null
            if (!element) return
            const computed = window.getComputedStyle(element)
            height =
              element.offsetHeight +
              Number.parseFloat(computed.marginTop || "0") +
              Number.parseFloat(computed.marginBottom || "0")
            blockHeights.set(node, height)
          }
          const paragraphFormat =
            node.attrs.paragraphFormat &&
            typeof node.attrs.paragraphFormat === "object"
              ? node.attrs.paragraphFormat
              : {}
          measuredBlocks.push({
            pos: offset,
            height,
            type: node.type.name,
            keepWithNext: Boolean(paragraphFormat.keepWithNext),
            pageBreakBefore: Boolean(paragraphFormat.pageBreakBefore),
          })
        })

        for (let index = 0; index < measuredBlocks.length; index += 1) {
          const block = measuredBlocks[index]
          if (block.type === "pageBreak") {
            used = 0
            pages += 1
            continue
          }
          if (block.type === "sectionBreak") {
            if (block.breakType === "continuous") continue
            const needsTwoPages =
              (block.breakType === "evenPage" && pages % 2 === 0) ||
              (block.breakType === "oddPage" && pages % 2 === 1)
            pages += needsTwoPages ? 2 : 1
            used = 0
            continue
          }

          let keptHeight = block.height
          let keptIndex = index
          while (measuredBlocks[keptIndex]?.keepWithNext) {
            const next = measuredBlocks[keptIndex + 1]
            if (
              !next ||
              next.type === "pageBreak" ||
              next.type === "sectionBreak"
            ) {
              break
            }
            keptHeight += next.height
            keptIndex += 1
          }

          if (
            used > 0 &&
            (block.pageBreakBefore || used + keptHeight > contentHeight)
          ) {
            pages += 1
            breaks.push({
              pos: block.pos,
              height:
                Math.max(0, contentHeight - used) +
                layout.margins.bottom +
                pageGap +
                layout.margins.top,
              page: pages,
            })
            used = block.height
          } else {
            used += block.height
          }
        }
        const signature = JSON.stringify(breaks)
        if (signature !== paginationSignatureRef.current) {
          paginationSignatureRef.current = signature
          editor.commands.setPaginationBreaks(breaks)
        }
        setPageCount((current) => (current === pages ? current : pages))

        if (layout.lineNumbers.mode === "none" || !pageRef.current) {
          if (lineNumberSignatureRef.current) {
            lineNumberSignatureRef.current = ""
            setLineNumberMarkers([])
            setLineNumberPreviewLimited(false)
          }
          return
        }

        const editorRoot =
          pageRef.current.querySelector<HTMLElement>(".ProseMirror")
        if (!editorRoot) return
        const pageRect = pageRef.current.getBoundingClientRect()
        const scale = Math.max(0.5, layout.zoom)
        const lineTops: number[] = []
        const walker = document.createTreeWalker(
          editorRoot,
          NodeFilter.SHOW_TEXT
        )
        let textNodeCount = 0
        let limited = false
        let textNode = walker.nextNode()
        while (textNode && textNodeCount < 5_000 && lineTops.length < 10_000) {
          textNodeCount += 1
          const parent = textNode.parentElement
          if (
            textNode.textContent?.trim() &&
            parent &&
            !parent.closest(
              "table, sup, [data-section-break], [data-page-break], [data-suppress-line-numbers='true'], .bibliography-field"
            )
          ) {
            const range = document.createRange()
            range.selectNodeContents(textNode)
            for (const rect of range.getClientRects()) {
              if (rect.width <= 0 || rect.height <= 0) continue
              const top = (rect.top - pageRect.top) / scale
              const previous = lineTops.at(-1)
              if (previous === undefined || Math.abs(previous - top) > 2) {
                lineTops.push(top)
              }
            }
          }
          textNode = walker.nextNode()
        }
        if (textNode || lineTops.length >= 10_000) limited = true
        lineTops.sort((left, right) => left - right)
        const uniqueLineTops = lineTops.filter(
          (top, index) => index === 0 || Math.abs(top - lineTops[index - 1]) > 2
        )
        const sectionBreakTops = Array.from(
          editorRoot.querySelectorAll<HTMLElement>("[data-section-break]")
        )
          .map(
            (element) =>
              (element.getBoundingClientRect().top - pageRect.top) / scale
          )
          .sort((left, right) => left - right)
        const groupCounts = new Map<number, number>()
        const markers: LineNumberMarker[] = []
        for (const top of uniqueLineTops) {
          const group =
            layout.lineNumbers.mode === "newPage"
              ? Math.max(0, Math.floor(top / (pageSize.height + 28)))
              : layout.lineNumbers.mode === "newSection"
                ? sectionBreakTops.filter((breakTop) => breakTop < top).length
                : 0
          const offset = groupCounts.get(group) ?? 0
          groupCounts.set(group, offset + 1)
          const number = layout.lineNumbers.start + offset
          if (
            layout.lineNumbers.countBy === 1 ||
            number % layout.lineNumbers.countBy === 0
          ) {
            markers.push({ top, number })
            if (markers.length >= 4_000) {
              limited = true
              break
            }
          }
        }
        const lineNumberSignature = JSON.stringify(markers)
        if (lineNumberSignature !== lineNumberSignatureRef.current) {
          lineNumberSignatureRef.current = lineNumberSignature
          setLineNumberMarkers(markers)
        }
        setLineNumberPreviewLimited((current) =>
          current === limited ? current : limited
        )
      })
    }

    const scheduleMeasure = (immediate = false) => {
      window.clearTimeout(debounceTimer)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
        idleHandle = 0
      }
      if (immediate) {
        measure()
        return
      }
      debounceTimer = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idleHandle = window.requestIdleCallback(() => {
            idleHandle = 0
            measure()
          }, { timeout: 1_000 })
        } else {
          measure()
        }
      }, 240)
    }

    /**
     * Todo lo que cambia la altura de un bloque sin sustituir su nodo: una
     * fuente o una imagen que terminan de cargar. La geometría de la página,
     * las columnas y los estilos ya rehacen este efecto entero, con lo que la
     * caché nace vacía.
     */
    const remeasureEverything = () => {
      blockHeights = new WeakMap()
      scheduleMeasure()
    }

    scheduleMeasure(true)
    const onEditorUpdate = () => scheduleMeasure()
    editor.on("update", onEditorUpdate)
    const observer = new ResizeObserver(() => scheduleMeasure())
    if (pageRef.current) observer.observe(pageRef.current)
    editor.view.dom.addEventListener("load", remeasureEverything, true)
    let fontsSettled = false
    void document.fonts?.ready.then(() => {
      if (fontsSettled) return
      remeasureEverything()
    })
    return () => {
      fontsSettled = true
      cancelAnimationFrame(frame)
      window.clearTimeout(debounceTimer)
      if (idleHandle && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
      }
      observer.disconnect()
      editor.off("update", onEditorUpdate)
      editor.view.dom.removeEventListener("load", remeasureEverything, true)
    }
  }, [
    dynamicStyleCss,
    editor,
    layout.columnGap,
    layout.columns,
    layout.margins.bottom,
    layout.margins.left,
    layout.margins.top,
    layout.lineNumbers.countBy,
    layout.lineNumbers.mode,
    layout.lineNumbers.start,
    layout.orientation,
    layout.pageSize,
    layout.zoom,
    mode,
    pageSize.height,
  ])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-desk">
      {overlay}
      <ScrollArea ref={scrollAreaRef} className="desk-scroll min-h-0 flex-1">
        <div className="px-4 py-6 sm:px-8 sm:py-10">
          {layout.showRuler && mode === "editing" && editor && (
            <DocumentRuler
              editor={editor}
              pageWidth={pageSize.width}
              zoom={layout.zoom}
              margins={layout.margins}
            />
          )}
          <div
            ref={pageRef}
            className={[
              "doc-page",
              mode === "welcome" ? "academic-workspace-page" : "",
              layout.showFormattingMarks ? "show-formatting-marks" : "",
              layout.columns > 1 ? "multi-column-document" : "",
              pageAppearance.hyphenation ? "hyphenated-document" : "",
              showMarkup ? "show-revision-markup" : "hide-revision-markup",
            ].filter(Boolean).join(" ")}
            style={{
              width:
                mode === "welcome"
                  ? "min(1180px, calc(100vw - 120px))"
                  : pageSize.width,
              minHeight: mode === "welcome" ? 720 : pageSize.height,
              // También como variable: los rótulos flotantes (salto de sección
              // continuo, cuadro de texto) necesitan tapar el texto con el
              // color real de la página para poder leerse.
              ...(mode === "welcome"
                ? {}
                : {
                    backgroundColor: pageAppearance.color,
                    "--document-page-background": pageAppearance.color,
                  }),
              border:
                mode !== "welcome" &&
                pageAppearance.borderStyle !== "none"
                  ? `${pageAppearance.borderWidth}px ${pageAppearance.borderStyle} ${pageAppearance.borderColor}`
                  : undefined,
              paddingTop: mode === "welcome" ? 28 : layout.margins.top,
              paddingRight: mode === "welcome" ? 28 : layout.margins.right,
              paddingBottom: mode === "welcome" ? 28 : layout.margins.bottom,
              paddingLeft: mode === "welcome" ? 28 : layout.margins.left,
              zoom: mode === "welcome" ? 1 : layout.zoom,
              "--document-columns": layout.columns,
              "--document-column-gap": `${layout.columnGap}px`,
              "--page-margin-top": `${layout.margins.top}px`,
              "--page-margin-right": `${layout.margins.right}px`,
              "--page-margin-bottom": `${layout.margins.bottom}px`,
              "--page-margin-left": `${layout.margins.left}px`,
              "--document-body-font": normalStyle?.fontFamily ?? "Calibri",
              "--document-body-size": `${normalStyle?.fontSize ?? 11}pt`,
              "--document-body-line-height": normalStyle?.lineHeight ?? 1.15,
              "--document-body-color": styleCssColor(normalStyle?.color, "#202020"),
            } as React.CSSProperties}
          >
            {dynamicStyleCss && <style>{dynamicStyleCss}</style>}
            {mode === "editing" && pageAppearance.watermarkText && (
              <div
                className="document-watermark"
                style={{
                  color: pageAppearance.watermarkColor,
                  opacity: pageAppearance.watermarkOpacity,
                  transform: `translate(-50%, -50%) rotate(${pageAppearance.watermarkAngle}deg)`,
                  fontSize: `${Math.max(
                    28,
                    Math.min(72, 820 / pageAppearance.watermarkText.length)
                  )}px`,
                }}
                aria-hidden="true"
                contentEditable={false}
              >
                {pageAppearance.watermarkText}
              </div>
            )}
            {mode === "editing" &&
              layout.lineNumbers.mode !== "none" &&
              lineNumberMarkers.length > 0 && (
                <div
                  className="document-line-number-layer"
                  aria-label="Vista previa de números de línea"
                  contentEditable={false}
                >
                  {lineNumberMarkers.map((marker, index) => (
                    <span
                      key={`${marker.number}-${marker.top}-${index}`}
                      className="document-line-number"
                      style={{
                        top: marker.top,
                        left: Math.max(
                          4,
                          layout.margins.left -
                            layout.lineNumbers.distance -
                            32
                        ),
                      }}
                    >
                      {marker.number}
                    </span>
                  ))}
                </div>
              )}
            {mode === "editing" && section.header.default && (
              <div
                className="document-header-preview"
                style={{
                  top: layout.margins.header,
                  left: layout.margins.left,
                  right: layout.margins.right,
                }}
                contentEditable={false}
              >
                {section.header.default}
              </div>
            )}
            {mode === "streaming" ? (
              <div>
                <div className="mb-7 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 font-sans">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {generationPhase === "complete" ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {GENERATION_PHASE_LABELS[generationPhase] ||
                        "Preparando el documento"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {generationPhase === "reading"
                        ? "Interpretando las instrucciones, los archivos y sus requisitos."
                        : generationPhase === "reviewing"
                          ? "Segunda pasada silenciosa: rigor, cobertura, estructura y prosa."
                          : "El texto aparece a medida que el modelo lo redacta."}
                    </p>
                  </div>
                </div>
                <div className="prose prose-slate max-w-none font-serif text-[1.05rem] leading-[1.9] dark:prose-invert prose-p:my-4 prose-headings:font-sans">
                  <MarkdownView>{responseText}</MarkdownView>
                  <span className="ml-0.5 inline-block h-5 w-2 animate-pulse bg-foreground/60 align-text-bottom" />
                </div>
              </div>
            ) : mode === "welcome" ? (
              <DocumentStarter {...starter} />
            ) : (
              <div
                className="document-editor-columns"
              >
                <EditorContent editor={editor} />
              </div>
            )}
            {mode === "editing" &&
              (section.footer.default ||
                section.pageNumberPosition.startsWith("footer-")) && (
                <div
                  className="document-footer-preview"
                  style={{
                    bottom: layout.margins.footer,
                    left: layout.margins.left,
                    right: layout.margins.right,
                    textAlign: section.pageNumberPosition.endsWith("left")
                      ? "left"
                      : section.pageNumberPosition.endsWith("right")
                        ? "right"
                        : "center",
                  }}
                  contentEditable={false}
                >
                  {section.footer.default}
                  {section.footer.default &&
                    section.pageNumberPosition.startsWith("footer-") &&
                    " · "}
                  {section.pageNumberPosition.startsWith("footer-") &&
                    formatPageNumber(
                      section.pageNumberStart ?? 1,
                      section.pageNumberFormat
                    )}
                </div>
              )}
          </div>
          {mode === "editing" && (
            <div
              className="mx-auto mt-2 text-center text-xs text-muted-foreground"
              style={{ width: pageSize.width * layout.zoom }}
              aria-live="polite"
            >
              {pageCount} {pageCount === 1 ? "página" : "páginas"} · Diseño de impresión
              {layout.lineNumbers.mode !== "none" &&
                ` · líneas ${
                  {
                    continuous: "continuas",
                    newPage: "por página",
                    newSection: "por sección",
                  }[layout.lineNumbers.mode]
                }${lineNumberPreviewLimited ? " (vista parcial)" : ""}`}
            </div>
          )}
        </div>
      </ScrollArea>

      {floatingSelection && (
        <SelectionBubble
          ref={bubbleRef}
          selection={floatingSelection}
          onAsk={() => {
            onSelectFragment(floatingSelection.text, { from: floatingSelection.from, to: floatingSelection.to })
            dismissBubble()
          }}
          onAction={(instruction) => {
            onFragmentAction(
              floatingSelection.text,
              { from: floatingSelection.from, to: floatingSelection.to },
              instruction
            )
            dismissBubble()
          }}
        />
      )}
    </div>
  )
}
