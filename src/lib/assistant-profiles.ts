import { PROSE_STYLE_RULES } from "@/lib/gemini"
import type { AiAction } from "@/lib/ai-actions"
import type { AiProvider } from "@/store/useSettingsStore"

/**
 * Perfiles del asistente. Cada uno agrupa la instrucción, el contexto que viaja,
 * las herramientas y las acciones rápidas de un caso de uso, para que el usuario
 * elija "qué trabajo quiere hacer" en vez de "sobre qué trozo de texto".
 */
export type AssistantProfileId = "write" | "research" | "design"

/** Cuánto estado del editor acompaña a la petición. */
export type EditorContextDetail = "slim" | "bibliography" | "full"

export interface AssistantProfile {
  id: AssistantProfileId
  label: string
  /** Frase corta para el selector. */
  tagline: string
  description: string
  overlay: string
  editorContext: EditorContextDetail
  /** El documento entero, o solo su esqueleto de títulos. */
  documentScope: "full" | "outline"
  /**
   * "edit" produce texto destinado a sustituir el documento o el fragmento;
   * "conversation" nunca reescribe: responde, y si acaso propone acciones.
   */
  outputMode: "edit" | "conversation"
  /** Necesita búsqueda web para cumplir su promesa. */
  needsGrounding: boolean
  /** Proveedor que mejor encaja cuando hay varios disponibles. */
  preferredProvider: AiProvider | "follow-global"
  actions: AiAction[]
}

const CLEAN_OUTPUT =
  "Responde ÚNICAMENTE con el texto resultante, respetando el formato y el género del documento, sin comillas, comentarios ni introducciones sobre la tarea."

/* ------------------------------------------------------------------ *
 * Escribir                                                            *
 * ------------------------------------------------------------------ */

const WRITE_ACTIONS: AiAction[] = [
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
    id: "connect",
    label: "Conectar",
    scope: "selection",
    instruction: () =>
      "Reescribe este fragmento para que enlace con naturalidad con lo que viene antes y después: explicita la transición y elimina saltos bruscos, sin añadir ideas nuevas.",
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
    id: "restyle",
    label: "Pulir redacción",
    scope: "document",
    instruction: () =>
      `Reescribe el documento completo mejorando su redacción, cohesión y elegancia, manteniendo todas sus ideas y su longitud aproximada. ${CLEAN_OUTPUT}`,
  },
]

const WRITE_OVERLAY = `MODO ESCRIBIR. Trabajas la prosa: reescribes, amplías, acortas, conectas y parafraseas.

${PROSE_STYLE_RULES}

Cuando el usuario tenga un fragmento seleccionado y pida transformarlo, responde ÚNICAMENTE con el texto de reemplazo, sin comillas, preámbulos ni explicaciones: la aplicación lo insertará tal cual en el documento. Conserva el idioma, el género y la voz del original salvo que se pida cambiarlos, y respeta las etiquetas, campos o numeraciones que el fragmento contenga.

Si el usuario pregunta algo en vez de pedir una reescritura, responde conversando. No propongas cambios de formato ni de maquetación: para eso existe el modo Diseñar.`

/* ------------------------------------------------------------------ *
 * Investigar                                                          *
 * ------------------------------------------------------------------ */

const RESEARCH_ACTIONS: AiAction[] = [
  {
    id: "verify-claims",
    label: "Verificar afirmaciones",
    scope: "document",
    instruction: () =>
      "Localiza las afirmaciones verificables del documento (cifras, fechas, nombres, atribuciones, relaciones causales) y evalúa cada una por separado. Para cada afirmación indica el veredicto (confirmada, imprecisa, incorrecta o no verificable), la corrección exacta si procede y en qué te basas. No reescribas el documento.",
  },
  {
    id: "check-selection",
    label: "Verificar este fragmento",
    scope: "selection",
    instruction: () =>
      "Revisa las cifras, nombres, fechas, citas, fuentes y afirmaciones verificables de este fragmento. Señala qué es correcto, qué es impreciso y qué no puedes confirmar. No reescribas el fragmento.",
  },
  {
    id: "find-sources",
    label: "Buscar fuentes",
    scope: "document",
    instruction: () =>
      "Busca fuentes solventes y citables que respalden o refuten los puntos principales del documento. Para cada una indica de qué afirmación responde y qué aporta. Prefiere fuentes primarias, académicas o institucionales, y descarta lo que no puedas consultar.",
  },
  {
    id: "build-bibliography",
    label: "Preparar bibliografía",
    scope: "document",
    instruction: () =>
      "Reúne las obras y fuentes que el documento cita o presupone y preséntalas como una bibliografía ordenada, con los datos que puedas confirmar. Marca explícitamente cualquier referencia incompleta en vez de rellenarla a ojo.",
  },
  {
    id: "critical-questions",
    label: "Preguntas críticas",
    scope: "document",
    instruction: () =>
      "Actúa como un revisor exigente y hostil. Formula las preguntas que dejarían el documento en evidencia: supuestos sin justificar, saltos lógicos, datos que piden fuente, contraejemplos y objeciones previsibles. Ordénalas por gravedad. No reescribas nada.",
  },
  {
    id: "resolve-doubt",
    label: "Resolver una duda",
    scope: "document",
    instruction: () =>
      "Responde a la duda del usuario sobre el tema del documento con precisión y con el detalle que haga falta, distinguiendo lo que está establecido de lo que es discutido o incierto.",
  },
]

const RESEARCH_OVERLAY = `MODO INVESTIGAR. No produces documento: lo interrogas. Verificas datos, buscas fuentes, preparas bibliografía y resuelves dudas.

REGLAS INNEGOCIABLES:
1. Nunca inventes una fuente, un autor, un año, una página, un DOI ni una URL. Es preferible decir "no he podido confirmarlo" mil veces que inventar una referencia una sola vez.
2. Distingue siempre tres cosas: lo que dice el documento, lo que has verificado y lo que es inferencia tuya.
3. Cuando cites una fuente, di qué afirmación concreta respalda. Una fuente que no sostiene nada del texto sobra.
4. Calibra la certeza con palabras precisas: confirmado, probable, discutido, no verificable. No repartas seguridad que no tienes.
5. No reescribas el documento salvo que te lo pidan explícitamente. Aquí se diagnostica.

Presenta los hallazgos en una lista donde cada punto pueda comprobarse por separado.`

const RESEARCH_NO_GROUNDING_NOTICE = `AVISO: en esta petición NO tienes acceso a búsqueda web, así que trabajas solo con tu memoria y con el material aportado. Dilo abiertamente al principio de tu respuesta. Puedes señalar qué habría que comprobar y dónde, pero no presentes ninguna referencia como verificada ni des por buenos datos de memoria: márcalos como pendientes de confirmar.`

/* ------------------------------------------------------------------ *
 * Diseñar                                                             *
 * ------------------------------------------------------------------ */

const DESIGN_ACTIONS: AiAction[] = [
  {
    id: "design-audit",
    label: "Auditar diseño",
    scope: "document",
    instruction: () =>
      "Audita el diseño del documento y entrega un diagnóstico numerado: tipografía y jerarquía de títulos, espaciado y sangrías, portada, índice, encabezados y pies, numeración de páginas, tratamiento de tablas e imágenes, y accesibilidad. Para cada punto di qué está mal y qué acción concreta lo arreglaría. NO apliques nada todavía: este paso es solo el plan.",
  },
  {
    id: "apply-plan",
    label: "Aplicar el plan",
    scope: "document",
    instruction: () =>
      "Aplica ahora el plan de diseño que acabas de proponer, en el orden correcto: primero el tema y la jerarquía de estilos, después la estructura, y al final los elementos que dependen de ella. Emite las acciones nativas necesarias.",
  },
  {
    id: "polish-typography",
    label: "Tipografía y jerarquía",
    scope: "document",
    instruction: () =>
      "Elige el tema de estilos que mejor encaje con el propósito del documento y arregla la jerarquía de títulos: niveles coherentes, sin saltos, y con el espaciado adecuado antes y después.",
  },
  {
    id: "front-matter",
    label: "Portada e índice",
    scope: "document",
    instruction: () =>
      "Prepara los preliminares del documento: portada con los datos que ya aparecen en el texto, salto de página, índice automático y el salto de sección necesario para que la numeración empiece donde debe.",
  },
  {
    id: "headers-numbering",
    label: "Encabezados y numeración",
    scope: "document",
    instruction: () =>
      "Configura encabezado, pie y numeración de páginas de forma coherente con el tipo de documento, incluida la sección de preliminares si existe.",
  },
  {
    id: "fix-accessibility",
    label: "Arreglar accesibilidad",
    scope: "document",
    instruction: () =>
      "Resuelve los problemas de accesibilidad detectados: textos alternativos que faltan, contraste insuficiente, jerarquía de títulos rota e idioma de corrección mal fijado.",
  },
]

const DESIGN_OVERLAY = `MODO DISEÑAR. Eres el maquetador del documento. El usuario quiere un documento impecable sin tener que aprenderse la aplicación: tú conoces todas sus capacidades y las usas por él.

CÓMO TRABAJAS:
1. Sé proactivo. No esperes a que te pidan un cambio concreto: mira el estado real del documento, detecta lo que está descuidado y propón el arreglo. Justifica cada decisión en una línea.
2. Diagnostica antes de tocar. Ante una petición amplia ("mejora el diseño", "déjalo profesional"), primero entrega el plan numerado y espera confirmación. Aplica directamente solo lo que te pidan de forma concreta.
3. Prefiere una acción global a veinte locales: aplicar un tema de estilos ordena todo el documento de una vez y es más fácil de deshacer que cien formatos sueltos.
4. Ordena las acciones por dependencia: tema y estilos primero, luego estructura y saltos, y al final índice, referencias cruzadas y numeración, que necesitan que lo anterior ya exista.
5. Ajusta el resultado al género. Un informe, un trabajo académico, una carta y un currículum no se maquetan igual.
6. No inventes contenido para rellenar el diseño. Si una portada necesita un dato que no está en el documento, pídelo.`

/* ------------------------------------------------------------------ *
 * Registro                                                            *
 * ------------------------------------------------------------------ */

export const ASSISTANT_PROFILES: AssistantProfile[] = [
  {
    id: "write",
    label: "Escribir",
    tagline: "Reescribe y desarrolla",
    description:
      "Reescribe, amplía, acorta, conecta y parafrasea. Trabaja sobre el fragmento que tengas seleccionado.",
    overlay: WRITE_OVERLAY,
    editorContext: "slim",
    documentScope: "full",
    outputMode: "edit",
    needsGrounding: false,
    preferredProvider: "gemini",
    actions: WRITE_ACTIONS,
  },
  {
    id: "research",
    label: "Investigar",
    tagline: "Verifica y documenta",
    description:
      "Comprueba datos, busca fuentes citables, prepara bibliografía y responde dudas sobre el texto.",
    overlay: RESEARCH_OVERLAY,
    editorContext: "bibliography",
    documentScope: "full",
    outputMode: "conversation",
    needsGrounding: true,
    preferredProvider: "gemini",
    actions: RESEARCH_ACTIONS,
  },
  {
    id: "design",
    label: "Diseñar",
    tagline: "Maqueta y pule",
    description:
      "Usa las capacidades reales del editor para dejar el documento con un formato profesional.",
    overlay: DESIGN_OVERLAY,
    editorContext: "full",
    documentScope: "outline",
    outputMode: "conversation",
    needsGrounding: false,
    preferredProvider: "openrouter",
    actions: DESIGN_ACTIONS,
  },
]

export const DEFAULT_ASSISTANT_PROFILE: AssistantProfileId = "write"

export function getAssistantProfile(id: AssistantProfileId): AssistantProfile {
  return (
    ASSISTANT_PROFILES.find((profile) => profile.id === id) ??
    ASSISTANT_PROFILES[0]
  )
}

export interface ProviderAvailability {
  gemini: boolean
  openrouter: boolean
  /** Proveedor elegido en Ajustes; decide los empates. */
  global: AiProvider
}

export interface ResolvedProfileProvider {
  provider: AiProvider
  /** Solo Gemini ofrece búsqueda web; el tier gratis de OpenRouter no la incluye. */
  grounding: boolean
  /** Explicación cuando el perfil no puede trabajar en sus mejores condiciones. */
  notice?: string
}

/**
 * Decide con qué proveedor corre un perfil. La disponibilidad manda sobre la
 * preferencia: quien solo tenga OpenRouter debe poder usar los tres perfiles,
 * aunque Investigar pierda las fuentes y haya que avisarle de ello.
 */
export function resolveProfileProvider(
  profile: AssistantProfile,
  availability: ProviderAvailability,
  override?: AiProvider
): ResolvedProfileProvider {
  const usable = (candidate: AiProvider) =>
    candidate === "gemini" ? availability.gemini : availability.openrouter

  const preferred: AiProvider =
    profile.preferredProvider === "follow-global"
      ? availability.global
      : profile.preferredProvider

  const provider: AiProvider =
    override && usable(override)
      ? override
      : usable(preferred)
        ? preferred
        : usable(availability.global)
          ? availability.global
          : availability.gemini
            ? "gemini"
            : availability.openrouter
              ? "openrouter"
              : availability.global

  const grounding = profile.needsGrounding && provider === "gemini"

  if (profile.needsGrounding && !grounding) {
    return {
      provider,
      grounding,
      notice:
        "Sin búsqueda web: OpenRouter no la incluye en su tier gratuito. La verificación se hará de memoria y las fuentes quedarán marcadas como pendientes de confirmar. Añade una clave de Gemini en Ajustes para verificar con fuentes reales.",
    }
  }

  return { provider, grounding }
}

/** Instrucciones extra que dependen de las condiciones reales de la petición. */
export function buildProfileOverlay(
  profile: AssistantProfile,
  resolved: ResolvedProfileProvider
): string {
  if (profile.needsGrounding && !resolved.grounding) {
    return `${profile.overlay}\n\n${RESEARCH_NO_GROUNDING_NOTICE}`
  }
  return profile.overlay
}
