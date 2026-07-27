import {
  buildSafetySettings,
  supportsSamplingControls,
  supportsThinkingControls,
  thinkingLevelForGenerateContent,
} from "@/lib/gemini"
import type { StableChatParams } from "@/lib/gemini-stable"
import type { GroundingSource } from "@/types/desktop"

/**
 * Chat con búsqueda de Google para el perfil Investigar.
 *
 * Vive fuera de `gemini-stable.ts` a propósito: ese módulo alberga el flujo de
 * borradores y un test de guarda (`draft-generation.guard.test.ts`) le prohíbe
 * contener `googleSearch`, precisamente para que una mejora del asistente no
 * pueda alterar la generación de borradores. Manteniéndolo aquí, esa frontera
 * sigue intacta.
 */
export interface ResearchChatParams extends StableChatParams {
  apiKey: string
}

export interface ResearchChatResult {
  text: string
  sources: GroundingSource[]
  finishReason?: string
}

async function createResearchClient(apiKey: string) {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "editor:" &&
    !window.editorDesktop
  ) {
    throw new Error(
      "El puente de Electron no se ha cargado. Cierra esta versión y abre de nuevo el ejecutable actualizado."
    )
  }
  const browserProxyBaseUrl =
    typeof window !== "undefined" && !window.editorDesktop
      ? `${window.location.origin}/__gemini`
      : undefined
  const { GoogleGenAI } = await import("@google/genai")
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      retryOptions: { attempts: 1 },
      ...(browserProxyBaseUrl ? { baseUrl: browserProxyBaseUrl } : {}),
    },
  })
}

export function buildResearchUserMessage(params: {
  userMessage: string
  quotedFragment?: string
}): string {
  return params.quotedFragment
    ? `Fragmento seleccionado:\n"""\n${params.quotedFragment}\n"""\n\n${params.userMessage}`
    : params.userMessage
}

export function buildResearchSystemInstruction(params: {
  systemPrompt: string
  documentText: string
  attachmentsContext?: string
}): string {
  const referenceBlock = params.attachmentsContext?.trim()
    ? `\n\nMATERIAL DE REFERENCIA ADJUNTO:\n"""\n${params.attachmentsContext.trim()}\n"""`
    : ""
  return `${params.systemPrompt.trim()}

DOCUMENTO SOBRE EL QUE TRABAJAS:
"""
${params.documentText}
"""${referenceBlock}`
}

/** Acumula las fuentes de grounding sin repetir URLs. */
export function collectGroundingSources(
  candidate:
    | {
        groundingMetadata?: {
          groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
        }
      }
    | undefined,
  into: Map<string, GroundingSource>
) {
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const web = chunk.web
    if (web?.uri) {
      into.set(web.uri, { title: web.title ?? web.uri, url: web.uri })
    }
  }
}

export async function researchChatStream(
  params: ResearchChatParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<ResearchChatResult> {
  const systemInstruction = buildResearchSystemInstruction({
    systemPrompt: params.systemPrompt,
    documentText: params.documentText,
    attachmentsContext: params.attachmentsContext,
  })
  const userMessage = buildResearchUserMessage(params)

  if (typeof window !== "undefined" && window.editorDesktop) {
    const result = await window.editorDesktop.ai.generate(
      {
        apiKey: params.apiKey,
        mode: "chat",
        model: params.model,
        systemPrompt: systemInstruction,
        thinkingLevel: params.thinkingLevel,
        temperature: params.temperature,
        topP: params.topP,
        unrestrictedMode: params.unrestrictedMode,
        prompt: userMessage,
        history: params.history,
        research: true,
      },
      (event) => {
        if (event.type === "chunk") onChunk(event.accumulatedText)
      }
    )
    return {
      text: result.text,
      sources: result.sources ?? [],
      finishReason: result.finishReason,
    }
  }

  const ai = await createResearchClient(params.apiKey)
  const stream = await ai.models.generateContentStream({
    model: params.model,
    contents: [
      ...params.history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.content }],
      })),
      { role: "user" as const, parts: [{ text: userMessage }] },
    ],
    config: {
      systemInstruction,
      abortSignal: signal,
      ...(supportsThinkingControls(params.model)
        ? {
            thinkingConfig: {
              thinkingLevel: thinkingLevelForGenerateContent(
                params.thinkingLevel,
                params.model
              ),
            },
          }
        : {}),
      ...(supportsSamplingControls(params.model)
        ? { temperature: params.temperature, topP: params.topP }
        : {}),
      safetySettings: buildSafetySettings(params.unrestrictedMode),
      tools: [{ googleSearch: {} }],
    },
  })

  let accumulated = ""
  const sources = new Map<string, GroundingSource>()
  let finishReason: string | undefined
  for await (const chunk of stream) {
    if (signal?.aborted) break
    accumulated += chunk.text ?? ""
    onChunk(accumulated)
    const candidate = chunk.candidates?.[0]
    finishReason = candidate?.finishReason ?? finishReason
    collectGroundingSources(candidate, sources)
  }
  return { text: accumulated, sources: [...sources.values()], finishReason }
}
