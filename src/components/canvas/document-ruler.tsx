"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"

import { normalizeParagraphFormat, type ParagraphFormat } from "@/lib/paragraph-format"
import type { DocumentLayoutSettings } from "@/types/document"

const POINTS_TO_PIXELS = 96 / 72
const KEYBOARD_STEP = 6

type DragKind = "firstLine" | "left" | "right"

interface DocumentRulerProps {
  editor: Editor
  pageWidth: number
  zoom: number
  margins: DocumentLayoutSettings["margins"]
}

interface RulerDrag {
  kind: DragKind
  rectLeft: number
  scale: number
  base: ParagraphFormat
}

function currentParagraphFormat(editor: Editor) {
  const nodeType = editor.isActive("heading") ? "heading" : "paragraph"
  return normalizeParagraphFormat(
    editor.getAttributes(nodeType).paragraphFormat
  )
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundPoint(value: number) {
  return Math.round(value * 2) / 2
}

export function DocumentRuler({
  editor,
  pageWidth,
  zoom,
  margins,
}: DocumentRulerProps) {
  const [, refresh] = React.useReducer((value) => value + 1, 0)
  const [drag, setDrag] = React.useState<RulerDrag | null>(null)
  const [preview, setPreview] = React.useState<ParagraphFormat | null>(null)
  const previewRef = React.useRef<ParagraphFormat | null>(null)
  const formatSignatureRef = React.useRef("")
  const rulerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let frame = 0
    const update = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const signature = JSON.stringify(currentParagraphFormat(editor))
        if (signature === formatSignatureRef.current) return
        formatSignatureRef.current = signature
        refresh()
      })
    }
    update()
    editor.on("selectionUpdate", update)
    editor.on("transaction", update)
    return () => {
      cancelAnimationFrame(frame)
      editor.off("selectionUpdate", update)
      editor.off("transaction", update)
    }
  }, [editor])

  const format = currentParagraphFormat(editor)
  const visibleFormat = preview ?? format
  const contentWidthPoints =
    Math.max(48, pageWidth - margins.left - margins.right) / POINTS_TO_PIXELS
  const displayScale = Math.max(0.5, zoom)
  const contentStart = margins.left * displayScale
  const pointPosition = (point: number) =>
    contentStart + point * POINTS_TO_PIXELS * displayScale
  const firstLinePosition = pointPosition(
    visibleFormat.leftIndent + visibleFormat.firstLineIndent
  )
  const leftPosition = pointPosition(visibleFormat.leftIndent)
  const rightPosition = pointPosition(
    contentWidthPoints - visibleFormat.rightIndent
  )

  React.useEffect(() => {
    if (!drag) return

    const pointFromClientX = (clientX: number) =>
      clamp(
        (clientX - drag.rectLeft - margins.left * drag.scale) /
          drag.scale /
          POINTS_TO_PIXELS,
        0,
        contentWidthPoints
      )

    const handlePointerMove = (event: PointerEvent) => {
      const point = roundPoint(pointFromClientX(event.clientX))
      let next = drag.base
      if (drag.kind === "firstLine") {
        next = {
          ...drag.base,
          firstLineIndent: clamp(
            point - drag.base.leftIndent,
            -drag.base.leftIndent,
            contentWidthPoints -
              drag.base.leftIndent -
              drag.base.rightIndent
          ),
        }
      } else if (drag.kind === "left") {
        next = {
          ...drag.base,
          leftIndent: clamp(
            point,
            0,
            contentWidthPoints - drag.base.rightIndent - 6
          ),
        }
      } else {
        next = {
          ...drag.base,
          rightIndent: clamp(
            contentWidthPoints - point,
            0,
            contentWidthPoints - drag.base.leftIndent - 6
          ),
        }
      }
      previewRef.current = next
      setPreview(next)
    }

    const finishDrag = () => {
      const next = previewRef.current
      if (next) {
        const partial =
          drag.kind === "firstLine"
            ? { firstLineIndent: next.firstLineIndent }
            : drag.kind === "left"
              ? { leftIndent: next.leftIndent }
              : { rightIndent: next.rightIndent }
        editor.chain().focus().setParagraphFormat(partial).run()
      }
      previewRef.current = null
      setPreview(null)
      setDrag(null)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", finishDrag, { once: true })
    window.addEventListener("pointercancel", finishDrag, { once: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", finishDrag)
      window.removeEventListener("pointercancel", finishDrag)
    }
  }, [contentWidthPoints, drag, editor, margins.left])

  const beginDrag = (kind: DragKind, event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = rulerRef.current?.getBoundingClientRect()
    if (!rect) return
    const nextDrag = {
      kind,
      rectLeft: rect.left,
      scale: rect.width / pageWidth,
      base: format,
    }
    previewRef.current = format
    setPreview(format)
    setDrag(nextDrag)
  }

  const updateWithKeyboard = (
    kind: DragKind,
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const direction = event.key === "ArrowRight" ? 1 : -1
    const delta = direction * (event.shiftKey ? KEYBOARD_STEP * 2 : KEYBOARD_STEP)
    if (kind === "firstLine") {
      editor
        .chain()
        .focus()
        .setParagraphFormat({
          firstLineIndent: clamp(
            format.firstLineIndent + delta,
            -format.leftIndent,
            contentWidthPoints -
              format.leftIndent -
              format.rightIndent
          ),
        })
        .run()
    } else if (kind === "left") {
      editor
        .chain()
        .focus()
        .setParagraphFormat({
          leftIndent: clamp(
            format.leftIndent + delta,
            0,
            contentWidthPoints - format.rightIndent - 6
          ),
        })
        .run()
    } else {
      editor
        .chain()
        .focus()
        .setParagraphFormat({
          rightIndent: clamp(
            format.rightIndent - delta,
            0,
            contentWidthPoints - format.leftIndent - 6
          ),
        })
        .run()
    }
  }

  const addOrRemoveTab = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = rect.width / pageWidth
    const point = roundPoint(
      (event.clientX - rect.left - margins.left * scale) /
        scale /
        POINTS_TO_PIXELS
    )
    if (point <= 0 || point >= contentWidthPoints) return
    const snappedPoint = Math.round(point / KEYBOARD_STEP) * KEYBOARD_STEP
    const existing = format.tabStops.find(
      (tabStop) => Math.abs(tabStop - snappedPoint) <= 3
    )
    const tabStops = existing
      ? format.tabStops.filter((tabStop) => tabStop !== existing)
      : [...format.tabStops, snappedPoint].sort((left, right) => left - right)
    editor.chain().focus().setParagraphFormat({ tabStops }).run()
  }

  return (
    <div
      ref={rulerRef}
      className="document-ruler relative mx-auto mb-2 h-6 border border-border/70"
      style={{ width: pageWidth * displayScale }}
      title="Clic para añadir una tabulación. Arrastra los marcadores para ajustar las sangrías."
      aria-label="Regla del documento"
      onMouseDown={(event) => event.preventDefault()}
      onClick={addOrRemoveTab}
    >
      <span
        className="document-ruler__margin left-0"
        style={{ width: margins.left * displayScale }}
        aria-hidden="true"
      />
      <span
        className="document-ruler__margin right-0"
        style={{ width: margins.right * displayScale }}
        aria-hidden="true"
      />
      {format.tabStops.map((stop) => (
        <button
          key={stop}
          type="button"
          className="document-ruler__tab"
          style={{ left: pointPosition(stop) }}
          aria-label={`Tabulación a ${stop} puntos. Pulsa para quitarla.`}
          title={`Tabulación: ${stop} pt · Clic para quitar`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation()
            editor
              .chain()
              .focus()
              .setParagraphFormat({
                tabStops: format.tabStops.filter(
                  (tabStop) => tabStop !== stop
                ),
              })
              .run()
          }}
        />
      ))}
      <button
        type="button"
        className="document-ruler__handle document-ruler__handle--first-line"
        style={{ left: firstLinePosition }}
        aria-label={`Sangría de primera línea: ${Math.round(visibleFormat.firstLineIndent)} puntos`}
        title="Sangría de primera línea"
        onPointerDown={(event) => beginDrag("firstLine", event)}
        onKeyDown={(event) => updateWithKeyboard("firstLine", event)}
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        className="document-ruler__handle document-ruler__handle--left"
        style={{ left: leftPosition }}
        aria-label={`Sangría izquierda: ${Math.round(visibleFormat.leftIndent)} puntos`}
        title="Sangría izquierda"
        onPointerDown={(event) => beginDrag("left", event)}
        onKeyDown={(event) => updateWithKeyboard("left", event)}
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        className="document-ruler__handle document-ruler__handle--right"
        style={{ left: rightPosition }}
        aria-label={`Sangría derecha: ${Math.round(visibleFormat.rightIndent)} puntos`}
        title="Sangría derecha"
        onPointerDown={(event) => beginDrag("right", event)}
        onKeyDown={(event) => updateWithKeyboard("right", event)}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}
