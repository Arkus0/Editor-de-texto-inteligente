type DocxLib = typeof import("docx")
type DocxMathComponent = import("docx").MathComponent
type OrderedXmlNode = Record<string, unknown>

function elementName(node: OrderedXmlNode) {
  return Object.keys(node).find((key) => key !== ":@")
}

function elementChildren(node: OrderedXmlNode) {
  const name = elementName(node)
  const value = name ? node[name] : undefined
  return Array.isArray(value)
    ? value.filter(
        (child): child is OrderedXmlNode =>
          typeof child === "object" && child !== null
      )
    : []
}

function elementAttributes(node: OrderedXmlNode) {
  const attributes = node[":@"]
  return typeof attributes === "object" && attributes !== null
    ? (attributes as Record<string, unknown>)
    : {}
}

function xmlText(node: OrderedXmlNode): string {
  if ("#text" in node) return String(node["#text"] ?? "")
  return elementChildren(node).map(xmlText).join("")
}

function findElement(
  nodes: OrderedXmlNode[],
  targetName: string
): OrderedXmlNode | undefined {
  for (const node of nodes) {
    if (elementName(node) === targetName) return node
    const descendant = findElement(elementChildren(node), targetName)
    if (descendant) return descendant
  }
}

function normalizedMathText(value: string) {
  return value
    .replace(/[\u2061\u2062\u2063\u2064]/g, "")
    .replace(/\u00a0/g, " ")
}

function mathRun(docxLib: DocxLib, value: string): DocxMathComponent[] {
  const text = normalizedMathText(value)
  return text ? [new docxLib.MathRun(text)] : []
}

function componentsFromNodes(
  docxLib: DocxLib,
  nodes: OrderedXmlNode[]
): DocxMathComponent[] {
  return nodes.flatMap((node) => componentsFromNode(docxLib, node))
}

function fencedComponents(
  docxLib: DocxLib,
  opening: string,
  closing: string,
  children: DocxMathComponent[]
): DocxMathComponent[] {
  if (opening === "(" && closing === ")") {
    return [new docxLib.MathRoundBrackets({ children })]
  }
  if (opening === "[" && closing === "]") {
    return [new docxLib.MathSquareBrackets({ children })]
  }
  if (opening === "{" && closing === "}") {
    return [new docxLib.MathCurlyBrackets({ children })]
  }
  if (
    (opening === "⟨" || opening === "〈") &&
    (closing === "⟩" || closing === "〉")
  ) {
    return [new docxLib.MathAngledBrackets({ children })]
  }
  return [
    ...mathRun(docxLib, opening),
    ...children,
    ...mathRun(docxLib, closing),
  ]
}

function rowComponents(
  docxLib: DocxLib,
  children: OrderedXmlNode[]
): DocxMathComponent[] {
  if (children.length >= 2) {
    const first = children[0]
    const last = children[children.length - 1]
    const firstAttributes = elementAttributes(first)
    const lastAttributes = elementAttributes(last)
    if (
      elementName(first) === "mo" &&
      elementName(last) === "mo" &&
      (firstAttributes["@_fence"] === "true" ||
        firstAttributes["@_fence"] === true) &&
      (lastAttributes["@_fence"] === "true" ||
        lastAttributes["@_fence"] === true)
    ) {
      return fencedComponents(
        docxLib,
        normalizedMathText(xmlText(first)),
        normalizedMathText(xmlText(last)),
        componentsFromNodes(docxLib, children.slice(1, -1))
      )
    }
  }
  return componentsFromNodes(docxLib, children)
}

function tableFallback(docxLib: DocxLib, rows: OrderedXmlNode[]) {
  const text = rows
    .filter((row) => elementName(row) === "mtr")
    .map((row) =>
      elementChildren(row)
        .filter((cell) => elementName(cell) === "mtd")
        .map((cell) => normalizedMathText(xmlText(cell)))
        .join("  ")
    )
    .join("; ")
  return mathRun(docxLib, text)
}

function componentsFromNode(
  docxLib: DocxLib,
  node: OrderedXmlNode
): DocxMathComponent[] {
  const name = elementName(node)
  const children = elementChildren(node)

  if (name === "#text") return mathRun(docxLib, xmlText(node))
  if (name === "annotation" || name === "annotation-xml") return []
  if (
    name === "mi" ||
    name === "mn" ||
    name === "mo" ||
    name === "mtext" ||
    name === "ms"
  ) {
    return mathRun(docxLib, xmlText(node))
  }
  if (name === "mspace") return mathRun(docxLib, " ")
  if (name === "mrow") return rowComponents(docxLib, children)
  if (name === "mfrac" && children.length >= 2) {
    return [
      new docxLib.MathFraction({
        numerator: componentsFromNode(docxLib, children[0]),
        denominator: componentsFromNode(docxLib, children[1]),
      }),
    ]
  }
  if (name === "msqrt") {
    return [
      new docxLib.MathRadical({
        children: componentsFromNodes(docxLib, children),
      }),
    ]
  }
  if (name === "mroot" && children.length >= 2) {
    return [
      new docxLib.MathRadical({
        children: componentsFromNode(docxLib, children[0]),
        degree: componentsFromNode(docxLib, children[1]),
      }),
    ]
  }
  if (name === "msup" && children.length >= 2) {
    return [
      new docxLib.MathSuperScript({
        children: componentsFromNode(docxLib, children[0]),
        superScript: componentsFromNode(docxLib, children[1]),
      }),
    ]
  }
  if (name === "msub" && children.length >= 2) {
    const base = normalizedMathText(xmlText(children[0]))
    if (/^(lim|max|min|sup|inf)$/.test(base)) {
      return [
        new docxLib.MathLimitLower({
          children: componentsFromNode(docxLib, children[0]),
          limit: componentsFromNode(docxLib, children[1]),
        }),
      ]
    }
    return [
      new docxLib.MathSubScript({
        children: componentsFromNode(docxLib, children[0]),
        subScript: componentsFromNode(docxLib, children[1]),
      }),
    ]
  }
  if (name === "msubsup" && children.length >= 3) {
    const base = normalizedMathText(xmlText(children[0]))
    const subScript = componentsFromNode(docxLib, children[1])
    const superScript = componentsFromNode(docxLib, children[2])
    if (base === "∑") {
      return [
        new docxLib.MathSum({
          children: [],
          subScript,
          superScript,
        }),
      ]
    }
    if (/^[∫∬∭∮]$/.test(base)) {
      return [
        new docxLib.MathIntegral({
          children: [],
          subScript,
          superScript,
        }),
      ]
    }
    return [
      new docxLib.MathSubSuperScript({
        children: componentsFromNode(docxLib, children[0]),
        subScript,
        superScript,
      }),
    ]
  }
  if (name === "munder" && children.length >= 2) {
    return [
      new docxLib.MathLimitLower({
        children: componentsFromNode(docxLib, children[0]),
        limit: componentsFromNode(docxLib, children[1]),
      }),
    ]
  }
  if (name === "mover" && children.length >= 2) {
    const attributes = elementAttributes(node)
    if (
      attributes["@_accent"] === "true" ||
      attributes["@_accent"] === true
    ) {
      return mathRun(docxLib, xmlText(node))
    }
    return [
      new docxLib.MathLimitUpper({
        children: componentsFromNode(docxLib, children[0]),
        limit: componentsFromNode(docxLib, children[1]),
      }),
    ]
  }
  if (name === "munderover" && children.length >= 3) {
    return [
      new docxLib.MathSubSuperScript({
        children: componentsFromNode(docxLib, children[0]),
        subScript: componentsFromNode(docxLib, children[1]),
        superScript: componentsFromNode(docxLib, children[2]),
      }),
    ]
  }
  if (name === "mfenced") {
    const attributes = elementAttributes(node)
    return fencedComponents(
      docxLib,
      String(attributes["@_open"] ?? "("),
      String(attributes["@_close"] ?? ")"),
      componentsFromNodes(docxLib, children)
    )
  }
  if (name === "mtable") return tableFallback(docxLib, children)

  return componentsFromNodes(docxLib, children)
}

export async function latexToDocxMath(
  docxLib: DocxLib,
  latex: string
): Promise<InstanceType<DocxLib["Math"]>> {
  try {
    const [{ default: katex }, { XMLParser }] = await Promise.all([
      import("katex"),
      import("fast-xml-parser"),
    ])
    const mathMl = katex.renderToString(latex, {
      output: "mathml",
      throwOnError: false,
      strict: false,
    })
    const parsed = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      trimValues: false,
    }).parse(mathMl) as OrderedXmlNode[]
    const semantics = findElement(parsed, "semantics")
    const presentation = semantics
      ? elementChildren(semantics).find(
          (node) => elementName(node) !== "annotation"
        )
      : findElement(parsed, "math")
    const children = presentation
      ? componentsFromNode(docxLib, presentation)
      : []
    return new docxLib.Math({
      children:
        children.length > 0 ? children : [new docxLib.MathRun(latex)],
    })
  } catch {
    return new docxLib.Math({
      children: [new docxLib.MathRun(latex)],
    })
  }
}
