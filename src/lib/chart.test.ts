import { describe, expect, it } from "vitest"

import {
  extractChartDataFromRows,
  niceAxisMax,
  parseChartNumber,
  renderChartSvg,
} from "./chart"

describe("lectura de números escritos a mano", () => {
  it("entiende el formato español y el inglés", () => {
    expect(parseChartNumber("1.234,5")).toBe(1234.5)
    expect(parseChartNumber("1,234.5")).toBe(1234.5)
    expect(parseChartNumber("1234")).toBe(1234)
    expect(parseChartNumber("12,5")).toBe(12.5)
    expect(parseChartNumber("12.5")).toBe(12.5)
  })

  it("ignora unidades y símbolos que la gente escribe en la celda", () => {
    expect(parseChartNumber("85 %")).toBe(85)
    expect(parseChartNumber("1.200 €")).toBe(1200)
    expect(parseChartNumber(" 42 ")).toBe(42)
  })

  it("lee los negativos entre paréntesis de contabilidad", () => {
    expect(parseChartNumber("(350)")).toBe(-350)
    expect(parseChartNumber("-350")).toBe(-350)
  })

  it("resuelve el separador ambiguo por la regla de las tres cifras", () => {
    // «1.200» es mil doscientos en español; «1.2» y «1.23» son decimales.
    expect(parseChartNumber("1.200")).toBe(1200)
    expect(parseChartNumber("82.400")).toBe(82400)
    expect(parseChartNumber("1.2")).toBe(1.2)
    expect(parseChartNumber("1.23")).toBe(1.23)
    expect(parseChartNumber("1.2345")).toBe(1.2345)
  })

  it("entiende varios separadores de millar seguidos", () => {
    expect(parseChartNumber("1.234.567")).toBe(1234567)
    expect(parseChartNumber("1,234,567")).toBe(1234567)
  })

  it("devuelve null cuando la celda no es un número", () => {
    expect(parseChartNumber("")).toBeNull()
    expect(parseChartNumber("Enero")).toBeNull()
    expect(parseChartNumber("sin datos")).toBeNull()
    expect(parseChartNumber("12-15")).toBeNull()
  })
})

describe("extracción de datos desde una tabla", () => {
  it("toma la primera columna como etiquetas y la primera numérica como serie", () => {
    const data = extractChartDataFromRows([
      ["Mes", "Peso"],
      ["Enero", "82,4"],
      ["Febrero", "81,1"],
      ["Marzo", "80,3"],
    ])
    expect(data).toEqual({
      labels: ["Enero", "Febrero", "Marzo"],
      values: [82.4, 81.1, 80.3],
      seriesName: "Peso",
    })
  })

  it("salta las columnas de texto hasta encontrar la de números", () => {
    const data = extractChartDataFromRows([
      ["Alumno", "Grupo", "Nota"],
      ["Ana", "A", "8,5"],
      ["Luis", "B", "6"],
    ])
    expect(data?.seriesName).toBe("Nota")
    expect(data?.values).toEqual([8.5, 6])
  })

  it("descarta las filas cuya celda de valor no es un número", () => {
    const data = extractChartDataFromRows([
      ["Mes", "Peso"],
      ["Enero", "82"],
      ["Febrero", "pendiente"],
      ["Marzo", "80"],
    ])
    expect(data?.labels).toEqual(["Enero", "Marzo"])
    expect(data?.values).toEqual([82, 80])
  })

  it("no inventa una serie donde no hay números", () => {
    expect(
      extractChartDataFromRows([
        ["Concepto", "Observación"],
        ["Uno", "pendiente"],
        ["Dos", "en curso"],
      ])
    ).toBeNull()
  })

  it("necesita algo más que la fila de cabecera", () => {
    expect(extractChartDataFromRows([["Mes", "Peso"]])).toBeNull()
    expect(extractChartDataFromRows([])).toBeNull()
  })

  it("pone nombre a las filas sin etiqueta para no dejar huecos mudos", () => {
    const data = extractChartDataFromRows([
      ["Mes", "Peso"],
      ["", "82"],
    ])
    expect(data?.labels[0]).toBe("Fila 1")
  })
})

describe("tope del eje", () => {
  it("elige una cifra redonda por encima del máximo", () => {
    expect(niceAxisMax(82.4)).toBe(100)
    expect(niceAxisMax(8.5)).toBe(10)
    expect(niceAxisMax(1200)).toBe(1500)
    expect(niceAxisMax(0)).toBe(1)
  })

  it("nunca deja el máximo por debajo del dato", () => {
    for (const value of [1, 7, 33, 480, 999, 1001, 74321]) {
      expect(niceAxisMax(value)).toBeGreaterThanOrEqual(value)
    }
  })
})

describe("dibujo del gráfico", () => {
  const data = {
    labels: ["Enero", "Febrero", "Marzo"],
    values: [82.4, 81.1, 80.3],
    seriesName: "Peso",
  }

  it("produce SVG con las tres formas", () => {
    for (const kind of ["bar", "line", "pie"] as const) {
      const svg = renderChartSvg({ ...data, kind })
      expect(svg.startsWith("<svg")).toBe(true)
      expect(svg.endsWith("</svg>")).toBe(true)
    }
  })

  it("dibuja una barra por dato", () => {
    const svg = renderChartSvg({ ...data, kind: "bar" })
    // Una es el fondo blanco del lienzo.
    expect((svg.match(/<rect/g) ?? []).length).toBe(1 + data.values.length)
  })

  it("une los puntos en el gráfico de líneas", () => {
    const svg = renderChartSvg({ ...data, kind: "line" })
    expect(svg).toContain("<polyline")
    expect((svg.match(/<circle/g) ?? []).length).toBe(data.values.length)
  })

  it("reparte los sectores y muestra su porcentaje", () => {
    const svg = renderChartSvg({
      labels: ["Sí", "No"],
      values: [75, 25],
      seriesName: "Adherencia",
      kind: "pie",
    })
    expect(svg).toContain("Sí · 75%")
    expect(svg).toContain("No · 25%")
  })

  it("dibuja el círculo entero cuando solo hay un sector", () => {
    // Con un único valor el arco sería de 360°, que en SVG no pinta nada.
    const svg = renderChartSvg({
      labels: ["Total"],
      values: [10],
      seriesName: "x",
      kind: "pie",
    })
    expect(svg).toContain("<circle")
  })

  it("no se rompe sin datos ni con todo a cero", () => {
    for (const kind of ["bar", "line", "pie"] as const) {
      expect(() =>
        renderChartSvg({ labels: [], values: [], seriesName: "x", kind })
      ).not.toThrow()
      expect(() =>
        renderChartSvg({
          labels: ["a", "b"],
          values: [0, 0],
          seriesName: "x",
          kind,
        })
      ).not.toThrow()
    }
  })

  it("escapa el texto para que un título no rompa el SVG", () => {
    const svg = renderChartSvg({
      ...data,
      kind: "bar",
      title: 'Peso <script> & "co"',
    })
    expect(svg).not.toContain("<script>")
    expect(svg).toContain("&lt;script&gt;")
    expect(svg).toContain("&amp;")
  })

  it("admite valores negativos sin salirse del lienzo", () => {
    const svg = renderChartSvg({
      labels: ["a", "b"],
      values: [-40, 60],
      seriesName: "Saldo",
      kind: "bar",
    })
    const ys = [...svg.matchAll(/<rect[^>]*y="([-\d.]+)"/g)].map((m) =>
      Number(m[1])
    )
    expect(ys.every((y) => y >= 0)).toBe(true)
  })
})
