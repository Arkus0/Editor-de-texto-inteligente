import { describe, expect, it } from "vitest"

import {
  calculateTableFormula,
  formatTableFormulaResult,
  parseTableNumber,
  sortedTableRowIndices,
} from "@/lib/table-tools"

describe("herramientas de tabla", () => {
  it("ordena texto y números conservando la cabecera", () => {
    const rows = [
      ["Nombre", "Nota"],
      ["Álvaro", "8,5"],
      ["Bea", "10"],
      ["Carlos", "7"],
    ]
    expect(sortedTableRowIndices(rows, 1, "descending", true)).toEqual([
      0, 2, 1, 3,
    ])
    expect(sortedTableRowIndices(rows, 0, "ascending", true)).toEqual([
      0, 1, 2, 3,
    ])
  })

  it("calcula fórmulas arriba e izquierda con números localizados", () => {
    const rows = [
      ["10", "2"],
      ["5,5", "3"],
      ["", ""],
    ]
    expect(calculateTableFormula(rows, 2, 0, "SUM", "ABOVE")).toEqual({
      expression: "SUM(ABOVE)",
      result: 15.5,
      sourceCount: 2,
    })
    expect(calculateTableFormula(rows, 1, 1, "AVERAGE", "LEFT").result).toBe(
      5.5
    )
    expect(parseTableNumber("12,5 %")).toBe(12.5)
    expect(parseTableNumber("1.234,56 €")).toBe(1234.56)
    expect(parseTableNumber("$1,234.56")).toBe(1234.56)
    expect(formatTableFormulaResult(15.5, "es-ES")).toBe("15,5")
  })
})
