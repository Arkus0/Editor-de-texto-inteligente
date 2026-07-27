export type AccessibilitySeverity = "error" | "warning" | "tip"

export type AccessibilityRuleId =
  | "document-title"
  | "document-language"
  | "image-alt"
  | "heading-empty"
  | "heading-order"
  | "link-target"
  | "link-text"
  | "table-header"
  | "table-header-empty"
  | "long-paragraph"
  | "text-contrast"

export interface AccessibilityIssue {
  id: string
  rule: AccessibilityRuleId
  severity: AccessibilitySeverity
  title: string
  description: string
  position: number
  nodeType: string
}

export interface AccessibilityReport {
  score: number
  issues: AccessibilityIssue[]
  errors: number
  warnings: number
  tips: number
  checkedNodes: number
}

interface DocumentNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{
    type?: string
    attrs?: Record<string, unknown>
  }>
  content?: DocumentNode[]
}

export interface AccessibilityAuditOptions {
  title?: string
  language?: string
  longParagraphWords?: number
}

function nodeSize(node: DocumentNode): number {
  if (node.type === "text") return node.text?.length ?? 0
  if (!node.content?.length) return 1
  const contentSize = node.content.reduce(
    (size, child) => size + nodeSize(child),
    0
  )
  return node.type === "doc" ? contentSize : contentSize + 2
}

function nodeText(node: DocumentNode): string {
  if (node.type === "text") return node.text ?? ""
  return (node.content ?? []).map(nodeText).join("")
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0
}

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseHexColor(value: unknown): [number, number, number] | null {
  const color = normalize(value)
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(color)
  if (short) {
    return short.slice(1).map((channel) => Number.parseInt(channel + channel, 16)) as [
      number,
      number,
      number,
    ]
  }
  const full = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color)
  if (!full) return null
  return full.slice(1).map((channel) => Number.parseInt(channel, 16)) as [
    number,
    number,
    number,
  ]
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return (
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  )
}

function contrastRatio(
  foreground: [number, number, number],
  background: [number, number, number]
): number {
  const light = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background)
  )
  const dark = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background)
  )
  return (light + 0.05) / (dark + 0.05)
}

function isGenericDocumentTitle(title: string): boolean {
  return (
    !title ||
    /^(documento(?:\s+sin\s+t[ií]tulo)?|document\d*|untitled(?:\s+document)?)$/iu.test(
      title.replace(/\.[^.]+$/u, "").trim()
    )
  )
}

function isWeakLinkText(text: string): boolean {
  const normalized = text
    .trim()
    .toLocaleLowerCase("es")
    .replace(/[.!?]+$/u, "")
  return (
    !normalized ||
    /^(aqu[ií]|aquí|clic aqu[ií]|click here|enlace|link|m[aá]s|leer m[aá]s|ver m[aá]s)$/iu.test(
      normalized
    ) ||
    /^https?:\/\//iu.test(normalized)
  )
}

export function auditDocumentAccessibility(
  input: unknown,
  options: AccessibilityAuditOptions = {}
): AccessibilityReport {
  const document = (input && typeof input === "object" ? input : {}) as DocumentNode
  const issues: AccessibilityIssue[] = []
  const longParagraphWords = Math.max(80, options.longParagraphWords ?? 140)
  let checkedNodes = 0
  let previousHeadingLevel = 0
  let issueSequence = 0

  const addIssue = (
    issue: Omit<AccessibilityIssue, "id">
  ) => {
    issueSequence += 1
    issues.push({ ...issue, id: `${issue.rule}-${issueSequence}` })
  }

  if (
    options.title !== undefined &&
    isGenericDocumentTitle(normalize(options.title))
  ) {
    addIssue({
      rule: "document-title",
      severity: "warning",
      title: "El documento necesita un título descriptivo",
      description:
        "Un nombre específico facilita identificar el archivo en lectores de pantalla, pestañas, historiales y documentos compartidos.",
      position: 0,
      nodeType: "doc",
    })
  }

  if (!normalize(options.language)) {
    addIssue({
      rule: "document-language",
      severity: "error",
      title: "No se ha definido el idioma del documento",
      description:
        "Define el idioma principal para que los lectores de pantalla y el corrector pronuncien e interpreten el texto correctamente.",
      position: 0,
      nodeType: "doc",
    })
  }

  const visit = (node: DocumentNode, position: number) => {
    checkedNodes += 1
    const type = node.type ?? "unknown"
    const text = nodeText(node).trim()

    if (type === "image" && !normalize(node.attrs?.alt)) {
      addIssue({
        rule: "image-alt",
        severity: "error",
        title: "Imagen sin texto alternativo",
        description:
          "Describe la información o finalidad de la imagen. Si solo es decorativa, indícalo explícitamente en sus opciones.",
        position,
        nodeType: type,
      })
    }

    if (type === "heading") {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))
      if (!text) {
        addIssue({
          rule: "heading-empty",
          severity: "error",
          title: "Título vacío",
          description:
            "Elimina el título vacío o añade un texto que describa la sección.",
          position,
          nodeType: type,
        })
      }
      if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) {
        addIssue({
          rule: "heading-order",
          severity: "warning",
          title: `Salto de nivel: Título ${previousHeadingLevel} → Título ${level}`,
          description:
            "Usa niveles consecutivos para que la estructura sea comprensible al navegar con teclado o lector de pantalla.",
          position,
          nodeType: type,
        })
      }
      previousHeadingLevel = level
    }

    if (type === "paragraph" && wordCount(text) > longParagraphWords) {
      addIssue({
        rule: "long-paragraph",
        severity: "tip",
        title: `Párrafo de ${wordCount(text)} palabras`,
        description:
          "Valora dividirlo o introducir una lista o subtítulo. Es una recomendación de legibilidad, no un error de accesibilidad.",
        position,
        nodeType: type,
      })
    }

    if (type === "table") {
      const firstRow = node.content?.find((child) => child.type === "tableRow")
      const firstRowCells = firstRow?.content ?? []
      if (
        firstRowCells.length > 0 &&
        firstRowCells.every((cell) => cell.type !== "tableHeader")
      ) {
        addIssue({
          rule: "table-header",
          severity: "warning",
          title: "Tabla sin fila de encabezado",
          description:
            "Marca la primera fila como encabezado para que cada columna tenga contexto al recorrer la tabla.",
          position,
          nodeType: type,
        })
      }
      firstRowCells.forEach((cell) => {
        if (cell.type === "tableHeader" && !nodeText(cell).trim()) {
          addIssue({
            rule: "table-header-empty",
            severity: "warning",
            title: "Encabezado de tabla vacío",
            description:
              "Escribe una etiqueta breve que describa el contenido de la columna o fila.",
            position,
            nodeType: type,
          })
        }
      })
    }

    if (type === "text") {
      const link = node.marks?.find((mark) => mark.type === "link")
      if (link) {
        const href = normalize(link.attrs?.href)
        if (!href) {
          addIssue({
            rule: "link-target",
            severity: "error",
            title: "Enlace sin destino",
            description:
              "Añade una dirección válida o elimina el formato de enlace.",
            position,
            nodeType: type,
          })
        }
        if (isWeakLinkText(node.text ?? "")) {
          addIssue({
            rule: "link-text",
            severity: "warning",
            title: "Texto de enlace poco descriptivo",
            description:
              "Sustituye «aquí», «enlace» o la URL completa por un texto que explique el destino.",
            position,
            nodeType: type,
          })
        }
      }

      const foregroundMark = node.marks?.find(
        (mark) => mark.type === "textStyle" && mark.attrs?.color
      )
      const highlightMark = node.marks?.find(
        (mark) => mark.type === "highlight" && mark.attrs?.color
      )
      const foreground = parseHexColor(foregroundMark?.attrs?.color)
      const background = parseHexColor(highlightMark?.attrs?.color)
      if (
        foreground &&
        background &&
        contrastRatio(foreground, background) < 4.5
      ) {
        addIssue({
          rule: "text-contrast",
          severity: "warning",
          title: "Contraste de texto insuficiente",
          description:
            "Cambia el color del texto o del resaltado hasta alcanzar una relación de contraste de al menos 4,5:1.",
          position,
          nodeType: type,
        })
      }
    }

    let childPosition = type === "doc" ? position : position + 1
    for (const child of node.content ?? []) {
      visit(child, childPosition)
      childPosition += nodeSize(child)
    }
  }

  visit(document, 0)

  const order: Record<AccessibilitySeverity, number> = {
    error: 0,
    warning: 1,
    tip: 2,
  }
  issues.sort(
    (left, right) =>
      order[left.severity] - order[right.severity] ||
      left.position - right.position
  )

  const errors = issues.filter((issue) => issue.severity === "error").length
  const warnings = issues.filter((issue) => issue.severity === "warning").length
  const tips = issues.filter((issue) => issue.severity === "tip").length
  const score = Math.max(0, 100 - errors * 18 - warnings * 6 - tips * 2)

  return { score, issues, errors, warnings, tips, checkedNodes }
}
