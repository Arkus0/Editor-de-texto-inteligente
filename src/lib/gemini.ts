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

export async function generateModelAnswerStream(
  { apiKey, model, systemPrompt, temperature, topP, unrestrictedMode, prompt, contextText }: GenerateModelAnswerParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = contextText?.trim()
    ? `${prompt}\n\n--- LECTURAS Y CONTEXTO ADJUNTO ---\n${contextText}`
    : prompt;

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
