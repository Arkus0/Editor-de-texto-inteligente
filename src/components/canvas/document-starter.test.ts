import { describe, expect, it } from "vitest"

import { formatRecentDate } from "./document-starter"

const NOW = new Date("2026-07-26T14:30:00").getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe("fechas de la lista de recientes", () => {
  it("cuenta en minutos lo que se acaba de cerrar", () => {
    expect(formatRecentDate(NOW - 30_000, NOW)).toBe("ahora mismo")
    expect(formatRecentDate(NOW - 12 * MINUTE, NOW)).toBe("hace 12 min")
    expect(formatRecentDate(NOW - 59 * MINUTE, NOW)).toBe("hace 59 min")
  })

  it("pasa a la hora del día cuando supera la hora pero sigue siendo hoy", () => {
    const result = formatRecentDate(NOW - 5 * HOUR, NOW)
    expect(result.startsWith("hoy, ")).toBe(true)
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it("distingue ayer aunque hayan pasado menos de 24 horas", () => {
    // 23:00 del día anterior, a solo 15 h 30 min de distancia: por reloj sigue
    // dentro del día de ayer y así debe leerse.
    const lastNight = new Date("2026-07-25T23:00:00").getTime()
    expect(formatRecentDate(lastNight, NOW).startsWith("ayer, ")).toBe(true)
  })

  it("no llama ayer a algo de hace más de un día", () => {
    const result = formatRecentDate(NOW - 3 * DAY, NOW)
    expect(result.startsWith("ayer")).toBe(false)
    expect(result.startsWith("hoy")).toBe(false)
  })

  it("añade el año solo cuando el documento es de otro año", () => {
    const sameYear = new Date("2026-02-10T09:00:00").getTime()
    const otherYear = new Date("2025-11-02T09:00:00").getTime()
    expect(formatRecentDate(sameYear, NOW)).not.toMatch(/2026/)
    expect(formatRecentDate(otherYear, NOW)).toMatch(/2025/)
  })
})
