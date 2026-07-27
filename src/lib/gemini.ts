import type {
  Part,
  SafetySetting,
  ThinkingLevel as GeminiThinkingLevel,
} from "@google/genai";
import { z } from "zod";

import type {
  AiAttachmentInput,
  ExerciseAnalysis,
  ProfessionalGenerationSettings,
  SafetyPreset,
} from "@/types/academic";
import type { AiLengthPreset, GroundingSource } from "@/types/desktop";

export const AVAILABLE_MODELS = [
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (máxima calidad)",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash (rápido y eficiente)",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite (económico)",
  },
] as const;

export type GeminiModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_MODEL: GeminiModelId = "gemini-3.1-pro-preview";

export const DEFAULT_SYSTEM_PROMPT = `Eres un redactor y editor profesional de primer nivel integrado en un procesador de textos completo. Tu objetivo es crear documentos excelentes y ayudar a mejorarlos sin alterar la intención del usuario.

REGLAS DE TRABAJO:
1. ADAPTA EL DOCUMENTO: Identifica el propósito, los destinatarios, el género y el tono solicitado. Una carta, un informe, un currículum, un contrato, una narración y un trabajo académico no deben sonar ni organizarse igual.
2. ESCRIBE COMO PERSONA: Usa una voz natural, directa y precisa. Evita muletillas de IA, introducciones vacías, repeticiones, conclusiones mecánicas y negritas decorativas.
3. ESTRUCTURA CON CRITERIO: Usa párrafos, títulos, listas y tablas solo cuando ayuden a leer o actuar. Conserva literalmente etiquetas, preguntas, campos y requisitos que el usuario deba responder.
4. FIDELIDAD Y SEGURIDAD: No inventes cifras, citas, fuentes, nombres, cláusulas ni hechos. Señala la incertidumbre y distingue lo aportado por el usuario de cualquier inferencia.
5. DOCUMENTOS EDITABLES: Produce contenido limpio, jerárquico y fácil de mantener con estilos. Evita trucos frágiles de espaciado, tabulaciones o caracteres manuales para simular diseño.
6. CAMBIOS CONTROLADOS: No afirmes que una modificación está aplicada si solo la has propuesto. Cuando el editor ofrezca acciones nativas, utiliza únicamente las capacidades declaradas y deja los cambios listos para revisión salvo que el usuario active expresamente la edición directa.
7. COBERTURA: Antes de terminar, comprueba que no has omitido ningún requisito, pregunta, sección o restricción del material aportado.`;

/**
 * Reglas de prosa que se AÑADEN al prompt base, nunca lo sustituyen. Nombrar las
 * construcciones concretas funciona mejor que pedir que "evite muletillas de IA",
 * pero es una preferencia de estilo: se activa a propósito (preajuste de borrador
 * o perfil Escribir del asistente), jamás por defecto, para que la generación de
 * borradores mantenga exactamente el comportamiento que ya funciona.
 */
export const PROSE_STYLE_RULES = `CUIDADO DE LA PROSA: prefiere el detalle concreto y verificable a la generalidad emotiva, y varía la longitud de las frases. Evita estas construcciones: la antítesis inflada («no es X, sino Y», «más que X, es Y»); la negación en lista, que describe lo ausente en vez de lo presente («sin X, sin Y: solo Z»); la moraleja o la epifanía final que el texto no ha ganado, porque el lector infiere solo; el tricolon decorativo y los pares de adjetivos sinónimos; y cualquier metacomentario sobre la propia tarea. Estas preferencias ceden siempre ante los requisitos del encargo: si el material exige una fórmula concreta, mándala ella.`;

/** Google recomienda mantener 1.0 en Gemini 3; bajarla puede degradar la salida. */
export const RECOMMENDED_TEMPERATURE = 1;
export const DEFAULT_TEMPERATURE = 1;
export const DEFAULT_TOP_P = 0.95;

async function createGeminiClient(apiKey: string) {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "editor:" &&
    !window.editorDesktop
  ) {
    throw new Error(
      "El puente de Electron no se ha cargado. Cierra esta versión y abre de nuevo el ejecutable actualizado."
    );
  }
  const browserProxyBaseUrl =
    typeof window !== "undefined" && !window.editorDesktop
      ? `${window.location.origin}/__gemini`
      : undefined;
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      retryOptions: { attempts: 1 },
      ...(browserProxyBaseUrl ? { baseUrl: browserProxyBaseUrl } : {}),
    },
  });
}

export function friendlyGeminiErrorMessage(error: unknown): string {
  const value = error as {
    message?: string;
    status?: number;
    cause?: { message?: string; status?: number };
  };
  const status = value?.status ?? value?.cause?.status;
  const message = String(value?.message ?? value?.cause?.message ?? error ?? "");
  if (status === 401 || status === 403) {
    return "Google rechazó la API Key o sus permisos. Comprueba la clave en Ajustes.";
  }
  if (status === 429) {
    return "Gemini ha limitado la solicitud por cuota o frecuencia. No se ha reintentado automáticamente.";
  }
  if (status === 404) {
    return "El modelo seleccionado no está disponible para esta API Key.";
  }
  if (/MAX_TOKENS|límite de tokens/i.test(message)) {
    return "Gemini agotó el espacio de respuesta antes de terminar. El texto parcial no se ha presentado como una solución completa.";
  }
  if (/failed to fetch|fetch failed|unable to make request/i.test(message)) {
    return "No se pudo recuperar la respuesta de Gemini. La aplicación no ha reintentado la solicitud para evitar cargos duplicados.";
  }
  if (/puente de Electron/i.test(message)) {
    return message;
  }
  return message || "No se pudo completar la solicitud a Gemini.";
}

export function supportsThinkingControls(model: string): boolean {
  return AVAILABLE_MODELS.some((candidate) => candidate.id === model);
}

export function supportedThinkingLevels(
  model: string
): ProfessionalGenerationSettings["thinkingLevel"][] {
  if (!supportsThinkingControls(model)) return [];
  return model === "gemini-3.1-pro-preview"
    ? ["low", "medium", "high"]
    : ["minimal", "low", "medium", "high"];
}

export function normalizeThinkingLevel(
  model: string,
  level: ProfessionalGenerationSettings["thinkingLevel"]
): ProfessionalGenerationSettings["thinkingLevel"] {
  const supported = supportedThinkingLevels(model);
  if (supported.includes(level)) return level;
  return supported.includes("low") ? "low" : supported[0] ?? "high";
}

export function thinkingLevelForGenerateContent(
  level: ProfessionalGenerationSettings["thinkingLevel"],
  model: string
): GeminiThinkingLevel {
  const compatibleLevel = normalizeThinkingLevel(model, level);
  return {
    minimal: "MINIMAL",
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
  }[compatibleLevel] as GeminiThinkingLevel;
}

const UNRESTRICTED_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
] as const;

export function buildSafetySettings(unrestrictedMode: boolean): SafetySetting[] | undefined {
  if (!unrestrictedMode) return undefined;
  return UNRESTRICTED_CATEGORIES.map((category) => ({
    category: category as SafetySetting["category"],
    threshold: "BLOCK_NONE" as SafetySetting["threshold"],
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
  lengthPreset?: AiLengthPreset;
  research?: boolean;
}

export function supportsSamplingControls(model: string): boolean {
  return model === "gemini-3.1-pro-preview";
}

export function buildSafetySettingsForPreset(
  preset: SafetyPreset
): SafetySetting[] | undefined {
  if (preset === "standard") return undefined;
  const threshold =
    preset === "academic"
      ? "BLOCK_NONE"
      : "BLOCK_MEDIUM_AND_ABOVE";
  return UNRESTRICTED_CATEGORIES.map((category) => ({
    category: category as SafetySetting["category"],
    threshold: threshold as SafetySetting["threshold"],
  }));
}

export interface GenerationMetadata {
  sources: GroundingSource[];
  finishReason?: string;
}

export const AI_LENGTH_OPTIONS: Array<{
  id: AiLengthPreset;
  label: string;
  description: string;
}> = [
  { id: "auto", label: "Automática", description: "Gemini decide según la petición" },
  { id: "short", label: "Breve", description: "200–400 palabras" },
  { id: "medium", label: "Media", description: "600–1.000 palabras" },
  { id: "long", label: "Larga", description: "1.500–3.000 palabras" },
  { id: "very-long", label: "Muy larga", description: "3.000–6.000 palabras" },
];

const NO_PROMPT_INSTRUCTION =
  "No se han escrito instrucciones directamente. Analiza el material adjunto, identifica qué documento útil espera el usuario y créalo sin inventar información ausente.";

function buildContents(prompt: string, contextText?: string): string {
  const trimmedPrompt = prompt.trim();
  const trimmedContext = contextText?.trim();

  const instruction = trimmedPrompt || NO_PROMPT_INSTRUCTION;

  if (!trimmedContext) return instruction;

  return `${instruction}\n\n--- MATERIAL ADJUNTO (puede contener instrucciones, datos, ejemplos o fuentes) ---\n${trimmedContext}`;
}

export async function generateModelAnswerStream(
  {
    apiKey,
    model,
    systemPrompt,
    temperature,
    topP,
    unrestrictedMode,
    prompt,
    contextText,
    lengthPreset = "auto",
    research = false,
  }: GenerateModelAnswerParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal,
  onMetadata?: (metadata: GenerationMetadata) => void
): Promise<string> {
  if (typeof window !== "undefined" && window.editorDesktop) {
    const result = await window.editorDesktop.ai.generate(
      {
        apiKey,
        mode: "draft",
        model,
        systemPrompt,
        temperature,
        topP,
        unrestrictedMode,
        prompt: buildContents(prompt, contextText),
        lengthPreset,
        research,
      },
      (event) => {
        if (event.type === "chunk") onChunk(event.accumulatedText);
        if (event.type === "done") {
          onMetadata?.({ sources: event.sources, finishReason: event.finishReason });
        }
      }
    );
    return result.text;
  }

  const ai = await createGeminiClient(apiKey);

  const contents = buildContents(prompt, contextText);

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      abortSignal: signal,
      ...(supportsSamplingControls(model) ? { temperature, topP } : {}),
      safetySettings: buildSafetySettings(unrestrictedMode),
      tools: research ? [{ googleSearch: {} }] : undefined,
    },
  });

  let accumulated = "";
  const sources = new Map<string, GroundingSource>();
  let finishReason: string | undefined;
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const chunkText = chunk.text ?? "";
    accumulated += chunkText;
    onChunk(accumulated);
    const candidate = chunk.candidates?.[0];
    finishReason = candidate?.finishReason ?? finishReason;
    for (const groundingChunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
      const web = groundingChunk.web;
      if (web?.uri) sources.set(web.uri, { title: web.title ?? web.uri, url: web.uri });
    }
  }
  onMetadata?.({ sources: [...sources.values()], finishReason });
  return accumulated;
}

const exerciseAnalysisSchema = z.object({
  type: z.enum(["essay", "text-analysis", "structured-questions", "other"]),
  title: z.string().default(""),
  language: z.string().default("es"),
  summary: z.string().default(""),
  questions: z
    .array(
      z.object({
        label: z.string(),
        instruction: z.string(),
      })
    )
    .default([]),
  requirements: z.array(z.string()).default([]),
  requestedWordCount: z.number().int().positive().nullable().default(null),
  citationsRequired: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0),
  warnings: z.array(z.string()).default([]),
});

const EXERCISE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "type",
    "title",
    "language",
    "summary",
    "questions",
    "requirements",
    "requestedWordCount",
    "citationsRequired",
    "confidence",
    "warnings",
  ],
  properties: {
    type: {
      type: "string",
      enum: ["essay", "text-analysis", "structured-questions", "other"],
    },
    title: { type: "string" },
    language: { type: "string" },
    summary: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "instruction"],
        properties: {
          label: { type: "string" },
          instruction: { type: "string" },
        },
      },
    },
    requirements: { type: "array", items: { type: "string" } },
    requestedWordCount: { anyOf: [{ type: "integer" }, { type: "null" }] },
    citationsRequired: { type: "boolean" },
    confidence: { type: "number" },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

const ANALYSIS_SYSTEM_PROMPT = `Eres un analista de ejercicios universitarios de Filosofía. Localiza el enunciado incluso si está mezclado con lecturas, rúbricas o ejemplos. Distingue entre ensayo, análisis de texto, preguntas estructuradas u otro ejercicio.

Extrae todas las preguntas conservando literalmente sus números y letras. Detecta idioma, extensión, citas y requisitos explícitos. No resuelvas el ejercicio. Si el documento contiene varios ejercicios, incluye todos sus apartados en questions. Devuelve exclusivamente el JSON solicitado.`;

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

function buildGenerateContentParts(
  prompt: string,
  attachments: AiAttachmentInput[]
) {
  const parts: Part[] = [
    {
      text:
        prompt.trim() ||
        "El enunciado completo está en los archivos adjuntos. Localízalo y analízalo.",
    },
  ];
  for (const attachment of attachments) {
    parts.push({
      text: `ARCHIVO: ${attachment.name}\nFUNCIÓN: ${attachment.role}`,
    });
    const extractedPdfText =
      attachment.kind === "pdf" &&
      (attachment.text?.replace(/\s/g, "").length ?? 0) >= 200;
    if (extractedPdfText) {
      parts.push({
        text: `TEXTO EXTRAÍDO DEL PDF:\n${(attachment.text ?? "").trim()}`,
      });
    } else if (
      (attachment.kind === "image" || attachment.kind === "pdf") &&
      attachment.dataBase64
    ) {
      parts.push({
        inlineData: {
          mimeType:
            attachment.kind === "pdf"
              ? "application/pdf"
              : attachment.mimeType,
          data: attachment.dataBase64,
        },
      });
    } else if (attachment.text?.trim()) {
      parts.push({ text: attachment.text.trim() });
    }
  }
  return parts;
}

function lengthInstruction(settings: ProfessionalGenerationSettings): string {
  if (settings.lengthPreset === "custom") {
    return `Redacta aproximadamente ${settings.customWordCount} palabras y respeta esa extensión con una tolerancia máxima del 10 %.`;
  }
  return {
    auto: "Adapta la extensión exactamente a lo que exige el ejercicio.",
    short: "Responde de forma breve, aproximadamente entre 200 y 400 palabras.",
    medium: "Desarrolla la respuesta aproximadamente entre 600 y 1.000 palabras.",
    long: "Elabora una respuesta larga y profunda, aproximadamente entre 1.500 y 3.000 palabras.",
    "very-long":
      "Elabora una respuesta muy extensa y rigurosa, aproximadamente entre 3.000 y 6.000 palabras.",
  }[settings.lengthPreset];
}

function sourceInstruction(settings: ProfessionalGenerationSettings): string {
  if (settings.sourcePolicy === "material-only") {
    return "Usa exclusivamente el enunciado y los materiales aportados. Si falta información imprescindible, indícalo sin inventarla.";
  }
  if (settings.sourcePolicy === "research") {
    return "Usa los materiales aportados, tu conocimiento y la búsqueda de Google para verificar las afirmaciones. No inventes fuentes.";
  }
  return "Prioriza el enunciado y los materiales aportados y complétalos con conocimiento filosófico sólido. No inventes citas, páginas ni bibliografía.";
}

function taskInstruction(analysis: ExerciseAnalysis): string {
  const shared =
    "Responde al nivel de una excelente solución universitaria. Sigue todas las instrucciones, conserva el idioma del ejercicio y devuelve únicamente el texto final listo para editar.";
  if (analysis.type === "structured-questions") {
    const labels = analysis.questions
      .map((question) => question.label.trim())
      .filter(Boolean)
      .join(", ");
    return `${shared} FORMATO OBLIGATORIO PARA PREGUNTAS ESTRUCTURADAS: conserva exactamente la numeración, las letras y el orden detectados. Responde cada apartado por separado y no omitas ninguno. Cada bloque de respuesta debe comenzar visiblemente con su etiqueta literal. Etiquetas que deben aparecer en la solución: ${labels || "las indicadas en el enunciado"}. Antes de terminar, comprueba que todas esas etiquetas aparecen una vez y en el orden original. Esta numeración ha sido solicitada por el ejercicio y prevalece sobre cualquier preferencia general de prosa continua.`;
  }
  if (analysis.type === "text-analysis") {
    return `${shared} Sigue primero la estructura pedida. Si no existe una estructura explícita, integra de forma natural el problema, la tesis, la secuencia argumentativa, los conceptos decisivos, el contexto y una valoración razonada.`;
  }
  if (analysis.type === "essay") {
    return `${shared} Construye una tesis clara y una argumentación profunda en prosa continua, con objeciones y matices cuando sean pertinentes.`;
  }
  return shared;
}

function structuredOutputReminder(
  analysis: ExerciseAnalysis
): string | undefined {
  if (analysis.type !== "structured-questions") return undefined;
  const labels = analysis.questions
    .map((question) => question.label.trim())
    .filter(Boolean);
  if (labels.length === 0) return undefined;
  return `FORMATO DE SALIDA OBLIGATORIO. Debes producir ${labels.length} bloques separados y cada bloque debe comenzar literalmente por su etiqueta, en este orden:
${labels.map((label) => `${label} [respuesta del apartado]`).join("\n")}
No unas los apartados ni suprimas, reformules o escondas estas etiquetas.`;
}

function buildAcademicSystemInstruction(
  settings: ProfessionalGenerationSettings,
  analysis: ExerciseAnalysis,
  phase: "draft" | "review"
): string {
  const analysisBlock = JSON.stringify(analysis, null, 2);
  const reviewInstruction =
    phase === "review"
      ? `Esta es una revisión final. Reescribe por completo el borrador corrigiendo cualquier fallo de cobertura, rigor filosófico, atribución, fidelidad al material, estructura, longitud o estilo. Elimina muletillas y metacomentarios. Devuelve únicamente la solución final revisada, nunca una crítica ni una explicación de tus cambios.`
      : "Redacta la solución completa.";
  return `${settings.systemPrompt}

${taskInstruction(analysis)}
${lengthInstruction(settings)}
${sourceInstruction(settings)}
${reviewInstruction}

ANÁLISIS ESTRUCTURADO DEL EJERCICIO:
${analysisBlock}`;
}

export interface AnalyzeExerciseParams {
  apiKey: string;
  prompt: string;
  attachments: AiAttachmentInput[];
}

export async function analyzeExercise(
  { apiKey, prompt, attachments }: AnalyzeExerciseParams,
  signal?: AbortSignal
): Promise<ExerciseAnalysis> {
  if (typeof window !== "undefined" && window.editorDesktop) {
    const result = await window.editorDesktop.ai.generate(
      {
        apiKey,
        mode: "analyze",
        model: "gemini-3.5-flash-lite",
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        temperature: 1,
        topP: 0.95,
        unrestrictedMode: true,
        prompt,
        attachments,
        thinkingLevel: "minimal",
        safetyPreset: "academic",
      },
      () => {}
    );
    return exerciseAnalysisSchema.parse(JSON.parse(stripJsonFence(result.text)));
  }

  const ai = await createGeminiClient(apiKey);
  const result = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [
      {
        role: "user",
        parts: buildGenerateContentParts(prompt, attachments),
      },
    ],
    config: {
      systemInstruction: ANALYSIS_SYSTEM_PROMPT,
      abortSignal: signal,
      thinkingConfig: {
        thinkingLevel: "MINIMAL" as GeminiThinkingLevel,
      },
      safetySettings: buildSafetySettingsForPreset("academic"),
      responseMimeType: "application/json",
      responseJsonSchema: EXERCISE_ANALYSIS_JSON_SCHEMA,
    },
  });
  if (signal?.aborted) throw new DOMException("Operación cancelada", "AbortError");
  return exerciseAnalysisSchema.parse(
    JSON.parse(stripJsonFence(result.text ?? "{}"))
  );
}

export interface AcademicGenerationParams {
  apiKey: string;
  prompt: string;
  attachments: AiAttachmentInput[];
  analysis: ExerciseAnalysis;
  settings: ProfessionalGenerationSettings;
}

async function streamAcademicInteraction(
  {
    apiKey,
    prompt,
    attachments,
    analysis,
    settings,
  }: AcademicGenerationParams,
  phase: "draft" | "review",
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal,
  draft?: string,
  onMetadata?: (metadata: GenerationMetadata) => void
): Promise<string> {
  if (typeof window !== "undefined" && window.editorDesktop) {
    const result = await window.editorDesktop.ai.generate(
      {
        apiKey,
        mode: phase,
        model: settings.model,
        systemPrompt: buildAcademicSystemInstruction(
          settings,
          analysis,
          phase
        ),
        temperature: settings.temperature,
        topP: settings.topP,
        unrestrictedMode: settings.safetyPreset === "academic",
        safetyPreset: settings.safetyPreset,
        thinkingLevel: settings.thinkingLevel,
        prompt,
        contextText: draft,
        attachments,
        exerciseAnalysis: analysis,
        lengthPreset:
          settings.lengthPreset === "custom" ? "auto" : settings.lengthPreset,
        customWordCount:
          settings.lengthPreset === "custom"
            ? settings.customWordCount
            : undefined,
        research: settings.sourcePolicy === "research",
      },
      (event) => {
        if (event.type === "chunk") onChunk(event.accumulatedText);
        if (event.type === "done") {
          onMetadata?.({
            sources: event.sources,
            finishReason: event.finishReason,
          });
        }
      }
    );
    return result.text;
  }

  const ai = await createGeminiClient(apiKey);
  const extraText =
    phase === "review" && draft
      ? `BORRADOR QUE DEBES REVISAR Y REESCRIBIR:\n\n${draft}`
      : undefined;
  const parts = buildGenerateContentParts(prompt, attachments);
  if (extraText?.trim()) parts.push({ text: extraText.trim() });
  const outputReminder = structuredOutputReminder(analysis);
  if (outputReminder) parts.push({ text: outputReminder });
  const stream = await ai.models.generateContentStream({
    model: settings.model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: buildAcademicSystemInstruction(
        settings,
        analysis,
        phase
      ),
      abortSignal: signal,
      thinkingConfig: {
        thinkingLevel: thinkingLevelForGenerateContent(
          settings.thinkingLevel,
          settings.model
        ),
      },
      ...(supportsSamplingControls(settings.model)
        ? { temperature: settings.temperature, topP: settings.topP }
        : {}),
      safetySettings: buildSafetySettingsForPreset(settings.safetyPreset),
      tools:
        settings.sourcePolicy === "research"
          ? [{ googleSearch: {} }]
          : undefined,
    },
  });

  let accumulated = "";
  const sources = new Map<string, GroundingSource>();
  let finishReason: string | undefined;
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    accumulated += chunk.text ?? "";
    onChunk(accumulated);
    const candidate = chunk.candidates?.[0];
    finishReason = candidate?.finishReason ?? finishReason;
    for (const groundingChunk of
      candidate?.groundingMetadata?.groundingChunks ?? []) {
      const web = groundingChunk.web;
      if (web?.uri) {
        sources.set(web.uri, {
          title: web.title ?? web.uri,
          url: web.uri,
        });
      }
    }
  }
  onMetadata?.({ sources: [...sources.values()], finishReason });
  return accumulated;
}

export function generateAcademicDraftStream(
  params: AcademicGenerationParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal,
  onMetadata?: (metadata: GenerationMetadata) => void
) {
  return streamAcademicInteraction(
    params,
    "draft",
    onChunk,
    signal,
    undefined,
    onMetadata
  );
}

export function reviewAcademicDraftStream(
  params: AcademicGenerationParams,
  draft: string,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal,
  onMetadata?: (metadata: GenerationMetadata) => void
) {
  return streamAcademicInteraction(
    params,
    "review",
    onChunk,
    signal,
    draft,
    onMetadata
  );
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
  systemPrompt?: string;
  lengthPreset?: AiLengthPreset;
  research?: boolean;
  thinkingLevel?: ProfessionalGenerationSettings["thinkingLevel"];
  /** Texto extraído de los documentos adjuntos (PDF/DOCX/TXT) usados como referencia. */
  attachmentsContext?: string;
}

const CHAT_SYSTEM_INSTRUCTION = (documentText: string, attachmentsContext?: string) => {
  const referenceBlock = attachmentsContext?.trim()
    ? `\n\nMATERIAL DE REFERENCIA ADJUNTO (documentos que el usuario ha adjuntado; utilízalos como fuente cuando el usuario pregunte por ellos o pida basarse en ellos):\n"""\n${attachmentsContext.trim()}\n"""`
    : "";

  return `Eres un redactor y editor profesional integrado en la aplicación. Conversas con el autor para revisar, transformar y dar formato al siguiente documento.

TEXTO ACTUAL:
"""
${documentText}
"""${referenceBlock}

Cuando el usuario cite un fragmento y pida reescribirlo, ampliarlo, acortarlo, cambiar su tono o corregirlo, responde ÚNICAMENTE con el texto de reemplazo, respetando el género, la voz y el propósito del documento, sin comillas ni explicaciones adicionales.

Cuando el usuario pida una opinión, una explicación o haga una pregunta general sobre el texto o el material de referencia (sin pedir explícitamente una reescritura), responde de forma conversacional y precisa, pero con toda la extensión y profundidad que requiera la petición. No impongas brevedad artificial ni reescribas el documento salvo que se solicite.`;
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
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    lengthPreset = "auto",
    research = false,
    thinkingLevel = "high",
  }: ChatAboutDocumentParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal,
  onMetadata?: (metadata: GenerationMetadata) => void
): Promise<string> {
  if (typeof window !== "undefined" && window.editorDesktop) {
    const result = await window.editorDesktop.ai.generate(
      {
        apiKey,
        mode: quotedFragment ? "selection" : "chat",
        model,
        systemPrompt,
        temperature,
        topP,
        unrestrictedMode,
        prompt: userMessage,
        documentText,
        contextText: attachmentsContext,
        history,
        quotedFragment,
        lengthPreset,
        research,
        thinkingLevel,
      },
      (event) => {
        if (event.type === "chunk") onChunk(event.accumulatedText);
        if (event.type === "done") {
          onMetadata?.({ sources: event.sources, finishReason: event.finishReason });
        }
      }
    );
    return result.text;
  }

  const ai = await createGeminiClient(apiKey);

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
      abortSignal: signal,
      thinkingConfig: {
        thinkingLevel: thinkingLevelForGenerateContent(thinkingLevel, model),
      },
      ...(supportsSamplingControls(model) ? { temperature, topP } : {}),
      safetySettings: buildSafetySettings(unrestrictedMode),
      tools: research ? [{ googleSearch: {} }] : undefined,
    },
  });

  let accumulated = "";
  const sources = new Map<string, GroundingSource>();
  let finishReason: string | undefined;
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const chunkText = chunk.text ?? "";
    accumulated += chunkText;
    onChunk(accumulated);
    const candidate = chunk.candidates?.[0];
    finishReason = candidate?.finishReason ?? finishReason;
    for (const groundingChunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
      const web = groundingChunk.web;
      if (web?.uri) sources.set(web.uri, { title: web.title ?? web.uri, url: web.uri });
    }
  }
  onMetadata?.({ sources: [...sources.values()], finishReason });
  return accumulated;
}
