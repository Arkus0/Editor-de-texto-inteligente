import type { PageNumberFormat } from "@/types/document"

function toRoman(value: number) {
  const numerals = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ] as const
  let remainder = value
  let result = ""
  for (const [amount, numeral] of numerals) {
    while (remainder >= amount) {
      result += numeral
      remainder -= amount
    }
  }
  return result
}

function toLetters(value: number) {
  let remainder = value
  let result = ""
  while (remainder > 0) {
    remainder -= 1
    result = String.fromCharCode(65 + (remainder % 26)) + result
    remainder = Math.floor(remainder / 26)
  }
  return result
}

export function formatPageNumber(
  value: number,
  format: PageNumberFormat = "decimal"
) {
  const page = Math.max(1, Math.trunc(value))
  if (format === "lowerRoman") return toRoman(page).toLowerCase()
  if (format === "upperRoman") return toRoman(page)
  if (format === "lowerLetter") return toLetters(page).toLowerCase()
  if (format === "upperLetter") return toLetters(page)
  return String(page)
}
