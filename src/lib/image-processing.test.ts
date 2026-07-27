import { describe, expect, it } from "vitest"

import {
  calculateImageGeometry,
  DEFAULT_IMAGE_PROCESSING_OPTIONS,
  normalizeImageProcessingOptions,
} from "@/lib/image-processing"

describe("procesamiento local de imágenes", () => {
  it("calcula recorte proporcional y reduce sin ampliar", () => {
    expect(
      calculateImageGeometry(6000, 4000, {
        ...DEFAULT_IMAGE_PROCESSING_OPTIONS,
        crop: { left: 10, right: 20, top: 25, bottom: 0 },
        maxDimension: 2100,
      })
    ).toEqual({
      sourceX: 600,
      sourceY: 1000,
      sourceWidth: 4200,
      sourceHeight: 3000,
      outputWidth: 2100,
      outputHeight: 1500,
    })
  })

  it("acota filtros, calidad, tamaño y recortes incompatibles", () => {
    expect(
      normalizeImageProcessingOptions({
        crop: { left: 45, right: 80, top: -5, bottom: 100 },
        brightness: 10,
        contrast: 0,
        saturation: -1,
        grayscale: 3,
        maxDimension: 100,
        format: "preserve",
        quality: 0,
      })
    ).toEqual({
      crop: { left: 45, right: 45, top: 0, bottom: 45 },
      brightness: 2,
      contrast: 0.25,
      saturation: 0,
      grayscale: 1,
      maxDimension: 320,
      format: "preserve",
      quality: 0.5,
    })
  })
})
