export interface ImageCrop {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ImageProcessingOptions {
  crop: ImageCrop
  brightness: number
  contrast: number
  saturation: number
  grayscale: number
  maxDimension: number
  format: "preserve" | "jpeg" | "png"
  quality: number
}

export interface ImageGeometry {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
  outputWidth: number
  outputHeight: number
}

export const DEFAULT_IMAGE_PROCESSING_OPTIONS: ImageProcessingOptions = {
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  brightness: 1,
  contrast: 1,
  saturation: 1,
  grayscale: 0,
  maxDimension: 2400,
  format: "preserve",
  quality: 0.86,
}

function bounded(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function normalizeImageProcessingOptions(
  options: ImageProcessingOptions
): ImageProcessingOptions {
  const left = bounded(options.crop.left, 0, 45)
  const right = bounded(options.crop.right, 0, 45)
  const top = bounded(options.crop.top, 0, 45)
  const bottom = bounded(options.crop.bottom, 0, 45)
  return {
    crop: {
      left,
      right: Math.min(right, 90 - left),
      top,
      bottom: Math.min(bottom, 90 - top),
    },
    brightness: bounded(options.brightness, 0.25, 2),
    contrast: bounded(options.contrast, 0.25, 2),
    saturation: bounded(options.saturation, 0, 2),
    grayscale: bounded(options.grayscale, 0, 1),
    maxDimension: Math.round(bounded(options.maxDimension, 320, 4096)),
    format:
      options.format === "jpeg" || options.format === "png"
        ? options.format
        : "preserve",
    quality: bounded(options.quality, 0.5, 1),
  }
}

export function calculateImageGeometry(
  naturalWidth: number,
  naturalHeight: number,
  rawOptions: ImageProcessingOptions
): ImageGeometry {
  const options = normalizeImageProcessingOptions(rawOptions)
  const width = Math.max(1, Math.round(naturalWidth))
  const height = Math.max(1, Math.round(naturalHeight))
  const sourceX = Math.round((width * options.crop.left) / 100)
  const sourceY = Math.round((height * options.crop.top) / 100)
  const sourceWidth = Math.max(
    1,
    width -
      sourceX -
      Math.round((width * options.crop.right) / 100)
  )
  const sourceHeight = Math.max(
    1,
    height -
      sourceY -
      Math.round((height * options.crop.bottom) / 100)
  )
  const scale = Math.min(
    1,
    options.maxDimension / Math.max(sourceWidth, sourceHeight)
  )
  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    outputWidth: Math.max(1, Math.round(sourceWidth * scale)),
    outputHeight: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("No se pudo decodificar la imagen."))
    image.src = src
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("No se pudo procesar la imagen.")),
      type,
      quality
    )
  })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."))
    reader.readAsDataURL(blob)
  })
}

export async function processImage(
  src: string,
  rawOptions: ImageProcessingOptions
) {
  const options = normalizeImageProcessingOptions(rawOptions)
  const image = await loadImage(src)
  const geometry = calculateImageGeometry(
    image.naturalWidth,
    image.naturalHeight,
    options
  )
  const canvas = document.createElement("canvas")
  canvas.width = geometry.outputWidth
  canvas.height = geometry.outputHeight
  const context = canvas.getContext("2d")
  if (!context) throw new Error("El sistema no ofrece procesamiento 2D.")

  const sourceMime = /^data:([^;,]+)/i.exec(src)?.[1]?.toLocaleLowerCase()
  const outputMime =
    options.format === "jpeg"
      ? "image/jpeg"
      : options.format === "png"
        ? "image/png"
        : sourceMime === "image/jpeg" || sourceMime === "image/png"
          ? sourceMime
          : "image/png"
  if (outputMime === "image/jpeg") {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.filter = [
    `brightness(${options.brightness})`,
    `contrast(${options.contrast})`,
    `saturate(${options.saturation})`,
    `grayscale(${options.grayscale})`,
  ].join(" ")
  context.drawImage(
    image,
    geometry.sourceX,
    geometry.sourceY,
    geometry.sourceWidth,
    geometry.sourceHeight,
    0,
    0,
    geometry.outputWidth,
    geometry.outputHeight
  )

  const blob = await canvasToBlob(
    canvas,
    outputMime,
    outputMime === "image/jpeg" ? options.quality : undefined
  )
  return {
    src: await blobToDataUrl(blob),
    width: geometry.outputWidth,
    height: geometry.outputHeight,
    bytes: blob.size,
    mime: outputMime,
  }
}
