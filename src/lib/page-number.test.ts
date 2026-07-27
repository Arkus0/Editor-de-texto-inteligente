import { describe, expect, it } from "vitest"

import { formatPageNumber } from "./page-number"

describe("formatPageNumber", () => {
  it("formatea numeración académica romana", () => {
    expect(formatPageNumber(1, "lowerRoman")).toBe("i")
    expect(formatPageNumber(14, "upperRoman")).toBe("XIV")
    expect(formatPageNumber(1999, "lowerRoman")).toBe("mcmxcix")
  })

  it("formatea series alfabéticas y normaliza valores inválidos", () => {
    expect(formatPageNumber(1, "lowerLetter")).toBe("a")
    expect(formatPageNumber(27, "upperLetter")).toBe("AA")
    expect(formatPageNumber(0, "decimal")).toBe("1")
  })
})
