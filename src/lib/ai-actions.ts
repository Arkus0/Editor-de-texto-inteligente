export type AiActionScope = "selection" | "document"

export interface AiAction {
  id: string
  label: string
  /** Instrucción que se envía a Gemini como mensaje del usuario. */
  instruction: (language?: string) => string
  scope: AiActionScope
}

const CLEAN_OUTPUT =
  "Responde ÚNICAMENTE con el texto resultante, respetando el formato y el género del documento, sin comillas, comentarios ni introducciones sobre la tarea."

/** Acciones sobre el fragmento seleccionado. El resultado reemplaza el fragmento. */
export const SELECTION_ACTIONS: AiAction[] = [
  {
    id: "rewrite",
    label: "Reescribir",
    scope: "selection",
    instruction: () =>
      "Reescribe este fragmento manteniendo el sentido pero con otras palabras y mejor redacción.",
  },
  {
    id: "expand",
    label: "Ampliar",
    scope: "selection",
    instruction: () => "Amplía este fragmento desarrollando la idea con mayor profundidad.",
  },
  {
    id: "shorten",
    label: "Acortar",
    scope: "selection",
    instruction: () => "Sintetiza este fragmento de forma más concisa sin perder el sentido.",
  },
  {
    id: "fix",
    label: "Corregir",
    scope: "selection",
    instruction: () =>
      "Corrige la ortografía, la gramática y la puntuación de este fragmento sin cambiar su sentido ni su estilo.",
  },
  {
    id: "tone",
    label: "Cambiar tono",
    scope: "selection",
    instruction: () =>
      "Reescribe este fragmento con un tono profesional, claro y adecuado al propósito y a los destinatarios del documento.",
  },
  {
    id: "strengthen-argument",
    label: "Reforzar argumento",
    scope: "selection",
    instruction: () =>
      "Reescribe este fragmento reforzando su razonamiento, haciendo explícitas las premisas necesarias y anticipando la objeción más relevante, sin inventar datos ni fuentes.",
  },
  {
    id: "clarify-concepts",
    label: "Precisar conceptos",
    scope: "selection",
    instruction: () =>
      "Reescribe este fragmento definiendo con precisión los conceptos decisivos y distinguiéndolos de nociones próximas, sin volver el texto artificial ni redundante.",
  },
  {
    id: "check-attributions",
    label: "Verificar afirmaciones",
    scope: "selection",
    instruction: () =>
      "Revisa las cifras, nombres, fechas, citas, fuentes y afirmaciones verificables del fragmento. Señala o corrige formulaciones imprecisas y no inventes referencias.",
  },
]

/** Acciones sobre el documento completo. El resultado se inserta o reemplaza el documento. */
export const DOCUMENT_ACTIONS: AiAction[] = [
  {
    id: "continue",
    label: "Continuar escribiendo",
    scope: "document",
    instruction: () =>
      `Continúa escribiendo el documento a partir de donde termina, en el mismo estilo y registro, con uno o dos párrafos nuevos. ${CLEAN_OUTPUT}`,
  },
  {
    id: "summarize",
    label: "Resumir",
    scope: "document",
    instruction: () =>
      `Redacta un resumen conciso del documento completo en prosa continua. ${CLEAN_OUTPUT}`,
  },
  {
    id: "outline",
    label: "Generar esquema",
    scope: "document",
    instruction: () =>
      "Genera un esquema jerárquico (índice) del documento con sus secciones y subsecciones principales, usando encabezados y listas en Markdown. Responde únicamente con el esquema.",
  },
  {
    id: "restyle",
    label: "Cambiar de estilo",
    scope: "document",
    instruction: () =>
      `Reescribe el documento completo mejorando su redacción, cohesión y elegancia, manteniendo todas sus ideas y su longitud aproximada. ${CLEAN_OUTPUT}`,
  },
  {
    id: "philosophical-review",
    label: "Revisión integral",
    scope: "document",
    instruction: () =>
      `Reescribe el documento completo tras auditar propósito, destinatarios, estructura, claridad, coherencia, precisión, tono y calidad de la redacción. Conserva cualquier estructura o requisito obligatorio y no inventes datos ni fuentes. ${CLEAN_OUTPUT}`,
  },
  {
    id: "requirements-audit",
    label: "Comprobar requisitos",
    scope: "document",
    instruction: () =>
      "Comprueba el documento frente a las instrucciones y materiales adjuntos. Identifica de forma numerada qué requisitos están cubiertos, cuáles faltan y qué cambios concretos conviene hacer. No reescribas todavía el documento.",
  },
]

export const TRANSLATE_LANGUAGES = [
  "Inglés",
  "Español",
  "Francés",
  "Alemán",
  "Italiano",
  "Portugués",
  "Catalán",
] as const

export function translateInstruction(language: string, scope: AiActionScope): string {
  const target = scope === "selection" ? "este fragmento" : "el documento completo"
  return `Traduce ${target} al ${language}. ${CLEAN_OUTPUT}`
}

export function findSelectionAction(id: string): AiAction | undefined {
  return SELECTION_ACTIONS.find((a) => a.id === id)
}
