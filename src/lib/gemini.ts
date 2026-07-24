import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { SafetySetting } from "@google/genai";

export const AVAILABLE_MODELS = [
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (mejor prosa y razonamiento)",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash (rápido)",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite (económico)",
  },
] as const;

export type GeminiModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_MODEL: GeminiModelId = "gemini-3.1-pro-preview";

export const DEFAULT_SYSTEM_PROMPT = `Eres un ensayista y académico de primer nivel. Tu objetivo es redactar respuestas modélicas para enunciados y preguntas de nivel universitario.

REGLAS DE ESTILO Y REDACCIÓN:
1. PROSA CONTINUA: Escribe en prosa fluida ensayística. Organiza el texto en párrafos bien estructurados con cohesión sintáctica y elegancia narrativa.
2. PROHIBIDO EL FORMATO DE ASISTENTE:
   - NO utilices listas de viñetas ni numeradas (a menos que el enunciado pida explícitamente una lista).
   - NO abuses de negritas dentro de los párrafos para destacar palabras clave.
   - NO dividas el texto con subtítulos innecesarios o breves en cada párrafo.
3. PROHIBIDAS LAS MULETILLAS DE IA: Elimina por completo muletillas como "En resumen", "En conclusión", "Es importante destacar", "Por un lado / Por otro lado", "En el complejo entramado de...", o aperturas condescendientes.
4. RIGOR Y TONO: Utiliza un vocabulario académico preciso, una sólida articulación argumentativa y una voz propia, directa y madura. El texto debe leerse como un fragmento de una monografía o ensayo de alta calidad.
5. ESTRUCTURA: Inicia directamente con la argumentación o respuesta, desarrolla los conceptos clave en profundidad y concluye integrando las implicaciones del análisis de forma natural en el último párrafo.`;

export const DEFAULT_TEMPERATURE = 0.85;
export const DEFAULT_TOP_P = 0.95;

const UNRESTRICTED_CATEGORIES = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
];

export function buildSafetySettings(unrestrictedMode: boolean): SafetySetting[] | undefined {
  if (!unrestrictedMode) return undefined;
  return UNRESTRICTED_CATEGORIES.map((category) => ({
    category,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  }));
}

export interface GenerateModelAnswerParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  unrestrictedMode: boolean;
  prompt: string;
  contextText?: string;
}

const NO_PROMPT_INSTRUCTION =
  "No se ha escrito ningún enunciado directamente. El enunciado, la pregunta o la consigna del trabajo se encuentra dentro del material adjunto a continuación: localízalo tú mismo y redacta la respuesta modélica correspondiente.";

function buildContents(prompt: string, contextText?: string): string {
  const trimmedPrompt = prompt.trim();
  const trimmedContext = contextText?.trim();

  const instruction = trimmedPrompt || NO_PROMPT_INSTRUCTION;

  if (!trimmedContext) return instruction;

  return `${instruction}\n\n--- MATERIAL ADJUNTO (puede contener el enunciado y/o lecturas de apoyo) ---\n${trimmedContext}`;
}

export async function generateModelAnswerStream(
  { apiKey, model, systemPrompt, temperature, topP, unrestrictedMode, prompt, contextText }: GenerateModelAnswerParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = buildContents(prompt, contextText);

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      topP,
      safetySettings: buildSafetySettings(unrestrictedMode),
    },
  });

  let accumulated = "";
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const chunkText = chunk.text ?? "";
    accumulated += chunkText;
    onChunk(accumulated);
  }
  return accumulated;
}

export interface ChatTurn {
  role: "user" | "model";
  content: string;
}

export interface ChatAboutDocumentParams {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  unrestrictedMode: boolean;
  documentText: string;
  history: ChatTurn[];
  userMessage: string;
  quotedFragment?: string;
  /** Texto extraído de los documentos adjuntos (PDF/DOCX/TXT) usados como referencia. */
  attachmentsContext?: string;
}

const CHAT_SYSTEM_INSTRUCTION = (documentText: string, attachmentsContext?: string) => {
  const referenceBlock = attachmentsContext?.trim()
    ? `\n\nMATERIAL DE REFERENCIA ADJUNTO (documentos que el usuario ha adjuntado; utilízalos como fuente cuando el usuario pregunte por ellos o pida basarse en ellos):\n"""\n${attachmentsContext.trim()}\n"""`
    : "";

  return `Eres el mismo ensayista académico que redactó el siguiente texto y ahora conversas con el autor para revisarlo y mejorarlo.

TEXTO ACTUAL:
"""
${documentText}
"""${referenceBlock}

Cuando el usuario cite un fragmento y pida reescribirlo, ampliarlo, acortarlo, cambiar su tono o corregirlo, responde ÚNICAMENTE con el texto de reemplazo del fragmento, en prosa académica continua, sin comillas, sin comentarios ni explicaciones adicionales, listo para sustituir el fragmento original tal cual.

Cuando el usuario pida una opinión, una explicación o haga una pregunta general sobre el texto o el material de referencia (sin pedir explícitamente una reescritura), responde de forma conversacional, breve y precisa, sin reescribir nada.`;
};

export async function chatAboutDocumentStream(
  {
    apiKey,
    model,
    temperature,
    topP,
    unrestrictedMode,
    documentText,
    history,
    userMessage,
    quotedFragment,
    attachmentsContext,
  }: ChatAboutDocumentParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const wrappedUserMessage = quotedFragment
    ? `Fragmento seleccionado:\n"""\n${quotedFragment}\n"""\n\n${userMessage}`
    : userMessage;

  const contents = [
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
    { role: "user" as const, parts: [{ text: wrappedUserMessage }] },
  ];

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION(documentText, attachmentsContext),
      temperature,
      topP,
      safetySettings: buildSafetySettings(unrestrictedMode),
    },
  });

  let accumulated = "";
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const chunkText = chunk.text ?? "";
    accumulated += chunkText;
    onChunk(accumulated);
  }
  return accumulated;
}
