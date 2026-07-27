import { Fragment } from "@tiptap/pm/model"
import { TextSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"

export type TableSortDirection = "ascending" | "descending"
export type TableFormulaOperation = "SUM" | "AVERAGE" | "COUNT" | "MIN" | "MAX"
export type TableFormulaDirection = "ABOVE" | "LEFT"

export function parseTableNumber(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[%\u20ac$\u00a3\u00a5]/g, "")
  if (!normalized) return null
  const lastComma = normalized.lastIndexOf(",")
  const lastPeriod = normalized.lastIndexOf(".")
  const decimal =
    lastComma >= 0 && lastPeriod >= 0
      ? lastComma > lastPeriod
        ? normalized.replaceAll(".", "").replace(",", ".")
        : normalized.replaceAll(",", "")
      : lastComma >= 0
        ? normalized.replace(",", ".")
        : normalized
  const number = Number(decimal)
  return Number.isFinite(number) ? number : null
}

function compareCellValues(left: string, right: string, locale: string) {
  const leftNumber = parseTableNumber(left)
  const rightNumber = parseTableNumber(right)
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber
  }
  return left.localeCompare(right, locale, {
    numeric: true,
    sensitivity: "base",
  })
}

export function sortedTableRowIndices(
  rows: string[][],
  columnIndex: number,
  direction: TableSortDirection,
  hasHeader: boolean,
  locale = "es"
) {
  const firstDataRow = hasHeader ? 1 : 0
  const prefix = rows.slice(0, firstDataRow).map((_, index) => index)
  const data = rows
    .slice(firstDataRow)
    .map((row, index) => ({ row, index: index + firstDataRow }))
    .sort((left, right) => {
      const comparison = compareCellValues(
        left.row[columnIndex] ?? "",
        right.row[columnIndex] ?? "",
        locale
      )
      return direction === "ascending" ? comparison : -comparison
    })
    .map((entry) => entry.index)
  return [...prefix, ...data]
}

export function calculateTableFormula(
  rows: string[][],
  rowIndex: number,
  columnIndex: number,
  operation: TableFormulaOperation,
  direction: TableFormulaDirection
) {
  const source =
    direction === "ABOVE"
      ? rows.slice(0, rowIndex).map((row) => row[columnIndex] ?? "")
      : (rows[rowIndex] ?? []).slice(0, columnIndex)
  const values = source
    .map(parseTableNumber)
    .filter((value): value is number => value !== null)

  let result = 0
  if (operation === "SUM") {
    result = values.reduce((total, value) => total + value, 0)
  } else if (operation === "AVERAGE") {
    result =
      values.length > 0
        ? values.reduce((total, value) => total + value, 0) / values.length
        : 0
  } else if (operation === "COUNT") {
    result = values.length
  } else if (operation === "MIN") {
    result = values.length > 0 ? Math.min(...values) : 0
  } else {
    result = values.length > 0 ? Math.max(...values) : 0
  }

  return {
    expression: `${operation}(${direction})`,
    result,
    sourceCount: values.length,
  }
}

export function formatTableFormulaResult(value: number, locale = "es-ES") {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 6,
    useGrouping: false,
  }).format(value)
}

function selectedTableContext(editor: Editor) {
  const $from = editor.state.selection.$from
  let tableDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "table") {
      tableDepth = depth
      break
    }
  }
  if (tableDepth < 0) return null
  const tableNode = $from.node(tableDepth)
  const rowIndex = $from.index(tableDepth)
  const columnIndex = $from.index(tableDepth + 1)
  const cellDepth = tableDepth + 2
  if (
    rowIndex >= tableNode.childCount ||
    columnIndex >= tableNode.child(rowIndex).childCount ||
    cellDepth > $from.depth
  ) {
    return null
  }
  return {
    tableDepth,
    tableNode,
    tablePosition: $from.before(tableDepth),
    rowIndex,
    columnIndex,
    cellNode: $from.node(cellDepth),
    cellPosition: $from.before(cellDepth),
  }
}

function tableTextRows(editor: Editor) {
  const context = selectedTableContext(editor)
  if (!context) return null
  return {
    context,
    rows: Array.from(
      { length: context.tableNode.childCount },
      (_, rowIndex) => {
        const row = context.tableNode.child(rowIndex)
        return Array.from(
          { length: row.childCount },
          (_, cellIndex) => row.child(cellIndex).textContent
        )
      }
    ),
  }
}

/**
 * Contenido en texto de la tabla donde está el cursor, fila a fila. Lo usa el
 * gráfico para leer sus datos de una tabla que el usuario ya ha escrito.
 */
export function selectedTableRows(editor: Editor): string[][] | null {
  return tableTextRows(editor)?.rows ?? null
}

export function sortSelectedTable(
  editor: Editor,
  direction: TableSortDirection,
  locale = "es"
) {
  const selected = tableTextRows(editor)
  if (!selected) return false
  const { context, rows } = selected
  const firstRow = context.tableNode.firstChild
  const hasHeader =
    context.tableNode.attrs.repeatHeader !== false ||
    firstRow?.firstChild?.type.name === "tableHeader"
  const order = sortedTableRowIndices(
    rows,
    context.columnIndex,
    direction,
    hasHeader,
    locale
  )
  const sorted = context.tableNode.copy(
    Fragment.fromArray(order.map((index) => context.tableNode.child(index)))
  )
  const transaction = editor.state.tr.replaceWith(
    context.tablePosition,
    context.tablePosition + context.tableNode.nodeSize,
    sorted
  )
  transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(context.tablePosition + 2))
  )
  editor.view.dispatch(transaction.scrollIntoView())
  return true
}

export function applySelectedTableFormula(
  editor: Editor,
  operation: TableFormulaOperation,
  direction: TableFormulaDirection,
  locale = "es-ES"
) {
  const selected = tableTextRows(editor)
  if (!selected) return null
  const { context, rows } = selected
  const calculation = calculateTableFormula(
    rows,
    context.rowIndex,
    context.columnIndex,
    operation,
    direction
  )
  const value = formatTableFormulaResult(calculation.result, locale)
  const paragraph = editor.schema.nodes.paragraph?.create(
    null,
    editor.schema.text(value)
  )
  if (!paragraph) return null
  const cell = context.cellNode.type.create(
    {
      ...context.cellNode.attrs,
      formula: calculation.expression,
    },
    paragraph
  )
  const transaction = editor.state.tr.replaceWith(
    context.cellPosition,
    context.cellPosition + context.cellNode.nodeSize,
    cell
  )
  transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(context.cellPosition + 1))
  )
  editor.view.dispatch(transaction.scrollIntoView())
  return { ...calculation, displayValue: value }
}
