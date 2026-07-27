"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { Crop, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DEFAULT_IMAGE_PROCESSING_OPTIONS,
  normalizeImageProcessingOptions,
  processImage,
  type ImageCrop,
  type ImageProcessingOptions,
} from "@/lib/image-processing"

export function ImageEditPopover({ editor }: { editor: Editor }) {
  const attributes = editor.getAttributes("image")
  const [options, setOptions] = React.useState<ImageProcessingOptions>(
    DEFAULT_IMAGE_PROCESSING_OPTIONS
  )
  const [processing, setProcessing] = React.useState(false)

  const update = (patch: Partial<ImageProcessingOptions>) =>
    setOptions((current) =>
      normalizeImageProcessingOptions({ ...current, ...patch })
    )
  const updateCrop = (edge: keyof ImageCrop, value: number) =>
    update({ crop: { ...options.crop, [edge]: value } })

  const apply = async () => {
    const src = String(attributes.src ?? "")
    if (!src || processing) return
    setProcessing(true)
    try {
      const result = await processImage(src, options)
      const displayWidth = Math.max(
        48,
        Math.min(1200, Number(attributes.width) || result.width)
      )
      editor
        .chain()
        .focus()
        .updateAttributes("image", {
          src: result.src,
          width: Math.round(displayWidth),
          height: Math.max(
            1,
            Math.round(displayWidth * (result.height / result.width))
          ),
        })
        .run()
      setOptions(DEFAULT_IMAGE_PROCESSING_OPTIONS)
      toast.success("Imagen procesada localmente", {
        description: `${result.width}×${result.height}px · ${Math.max(
          1,
          Math.round(result.bytes / 1024)
        )} KiB · se puede deshacer`,
      })
    } catch (error) {
      toast.error("No se pudo procesar la imagen", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setProcessing(false)
    }
  }

  const filter = [
    `brightness(${options.brightness})`,
    `contrast(${options.contrast})`,
    `saturate(${options.saturation})`,
    `grayscale(${options.grayscale})`,
  ].join(" ")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={!editor.isActive("image")}
          onMouseDown={(event) => event.preventDefault()}
        >
          <SlidersHorizontal />
          Recortar y corregir
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[23rem] space-y-4" align="start">
        <div>
          <p className="text-sm font-medium">Edición local de píxeles</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            El resultado se conserva en DOCX, PDF y ODT. La operación queda en
            el historial de Deshacer.
          </p>
        </div>

        <div className="flex h-36 items-center justify-center overflow-hidden rounded border bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:16px_16px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={String(attributes.src ?? "")}
            alt=""
            className="max-h-full max-w-full object-contain"
            style={{
              filter,
              clipPath: `inset(${options.crop.top}% ${options.crop.right}% ${options.crop.bottom}% ${options.crop.left}%)`,
            }}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1 text-xs font-medium">
            <Crop className="h-3.5 w-3.5" />
            Recorte por borde (%)
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["top", "Arriba"],
                ["right", "Derecha"],
                ["bottom", "Abajo"],
                ["left", "Izquierda"],
              ] as const
            ).map(([edge, label]) => (
              <label key={edge} className="grid gap-1 text-[11px]">
                <span className="text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  min={0}
                  max={45}
                  value={options.crop[edge]}
                  onChange={(event) =>
                    updateCrop(edge, Number(event.target.value))
                  }
                  className="h-8"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          {(
            [
              ["brightness", "Brillo", 25, 200],
              ["contrast", "Contraste", 25, 200],
              ["saturation", "Saturación", 0, 200],
              ["grayscale", "Escala de grises", 0, 100],
            ] as const
          ).map(([key, label, min, max]) => (
            <label
              key={key}
              className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 text-xs"
            >
              <span className="text-muted-foreground">{label}</span>
              <input
                type="range"
                min={min}
                max={max}
                value={Math.round(options[key] * 100)}
                onChange={(event) =>
                  update({ [key]: Number(event.target.value) / 100 })
                }
              />
              <span className="text-right tabular-nums">
                {Math.round(options[key] * 100)}%
              </span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Formato</span>
            <select
              value={options.format}
              onChange={(event) =>
                update({
                  format: event.target.value as ImageProcessingOptions["format"],
                })
              }
              className="h-8 rounded border border-input bg-background px-2"
            >
              <option value="preserve">Conservar PNG/JPEG</option>
              <option value="jpeg">JPEG optimizado</option>
              <option value="png">PNG sin pérdida</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Lado máximo</span>
            <select
              value={options.maxDimension}
              onChange={(event) =>
                update({ maxDimension: Number(event.target.value) })
              }
              className="h-8 rounded border border-input bg-background px-2"
            >
              <option value={1200}>1.200 px · compacto</option>
              <option value={2400}>2.400 px · recomendado</option>
              <option value={4096}>4.096 px · alta calidad</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={processing || !attributes.src}
            onClick={() => void apply()}
          >
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SlidersHorizontal className="h-3.5 w-3.5" />
            )}
            Aplicar a la imagen
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Restaurar controles"
            onClick={() => setOptions(DEFAULT_IMAGE_PROCESSING_OPTIONS)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
