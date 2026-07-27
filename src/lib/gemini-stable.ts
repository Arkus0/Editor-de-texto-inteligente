import type { SafetySetting } from "@google/genai"

import {
  supportsSamplingControls,
  supportsThinkingControls,
  thinkingLevelForGenerateContent,
} from "@/lib/gemini"
import { streamOpenRouterChat } from "@/lib/openrouter"
import type { ThinkingLevel } from "@/types/academic"

export interface StableGenerateParams {
  provider?: "gemini" | "openrouter"
  apiKey: string
  model: string
  systemPrompt: string
  thinkingLevel: ThinkingLevel
  temperature: number
  topP: number
  unrestrictedMode: boolean
  prompt: string
  contextText?: string
  lengthInstruction?: string
}

export interface StableChatTurn {
  role: "user" | "model"
  content: string
}

export interface StableChatParams {
  provider?: "gemini" | "openrouter"
  apiKey: string
  model: string
  systemPrompt: string
  thinkingLevel: ThinkingLevel
  temperature: number
  topP: number
  unrestrictedMode: boolean
  documentText: string
  history: StableChatTurn[]
  userMessage: string
  quotedFragment?: string
  attachmentsContext?: string
  editTarget?: "chat" | "selection" | "document"
}

const UNRESTRICTED_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
] as const

function buildSafetySettings(
  unrestrictedMode: boolean
): SafetySetting[] | undefined {
  if (!unrestrictedMode) return undefined
  return UNRESTRICTED_CATEGORIES.map((category) => ({
    category: category as SafetySetting["category"],
    threshold: "BLOCK_NONE" as SafetySetting["threshold"],
  }))
}

async function createStableClient(apiKey: string) {
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

const NO_PROMPT_INSTRUCTION =
  "No se han escrito instrucciones directamente. Analiza el material adjunto, identifica el tipo de documento y el resultado útil que espera el usuario, y créalo sin inventar información ausente."

export const STRUCTURED_EXERCISE_INSTRUCTION = `Comprueba si las instrucciones o el material adjunto contienen requisitos, preguntas, campos o apartados identificados mediante números, letras, números romanos u otras etiquetas. Si existen, conserva literalmente sus etiquetas y su orden, y atiende cada punto por separado. No combines, omitas, reformules ni inventes apartados. Antes de terminar, verifica que cada requisito original está cubierto una vez. Si no hay una estructura exigida, elige la más adecuada para el tipo de documento.`

function buildContents(
  prompt: string,
  contextText?: string,
  lengthInstruction?: string
): string {
  const instruction = [
    prompt.trim() || NO_PROMPT_INSTRUCTION,
    STRUCTURED_EXERCISE_INSTRUCTION,
    lengthInstruction?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n")
  const context = contextText?.trim()
  if (!context) return instruction
  return `${instruction}\n\n--- MATERIAL ADJUNTO (puede contener instrucciones, datos, ejemplos o fuentes) ---\n${context}`
}

const chatSystemInstruction = (
  documentText: string,
  attachmentsContext?: string
) => {
  const referenceBlock = attachmentsContext?.trim()
    ? `\n\nMATERIAL DE REFERENCIA ADJUNTO (documentos que el usuario ha adjuntado; utilízalos como fuente cuando el usuario pregunte por ellos o pida basarse en ellos):\n"""\n${attachmentsContext.trim()}\n"""`
    : ""

  return `Eres un redactor y editor profesional integrado en la aplicación. Conversas con el autor para revisar, transformar y dar formato al siguiente documento.

TEXTO ACTUAL:
"""
${documentText}
"""${referenceBlock}

Cuando el usuario cite un fragmento y pida reescribirlo, ampliarlo, acortarlo, cambiar su tono o corregirlo, responde ÚNICAMENTE con el texto de reemplazo, respetando el género, la voz y el propósito del documento, sin comillas ni explicaciones adicionales.

Cuando el usuario pida modificar el documento completo, devuelve ÚNICAMENTE el documento completo ya modificado, sin comentarios previos ni posteriores, para que pueda sustituirse de forma segura.

Al modificar un texto con requisitos, campos, preguntas o apartados etiquetados, conserva todas sus etiquetas y su orden salvo que el usuario pida expresamente cambiar esa estructura.

Cuando el usuario pida una opinión, una explicación o haga una pregunta general sobre el texto o el material de referencia (sin pedir explícitamente una reescritura), responde de forma conversacional, rigurosa y con toda la extensión que resulte útil. No impongas brevedad artificial.`
}

function stableGenerationConfig(params: {
  model: string
  thinkingLevel: ThinkingLevel
  temperature: number
  topP: number
}) {
  return {
    ...(supportsSamplingControls(params.model)
      ? { temperature: params.temperature, topP: params.topP }
      : {}),
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
  }
}

export async function generateStableAnswerStream(
  params: StableGenerateParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const contents = buildContents(
    params.prompt,
    params.contextText,
    params.lengthInstruction
  )

  if (params.provider === "openrouter") {
    const result = await streamOpenRouterChat(
      {
        apiKey: params.apiKey,
        model: params.model,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: contents },
        ],
        temperature: params.temperature,
        topP: params.topP,
      },
      onChunk,
      signal
    )
    return result.text
  }

  if (typeof window !== "undefined" && window.editorDesktop) {
    const result = await window.editorDesktop.ai.generate(
      {
        apiKey: params.apiKey,
        mode: "draft",
        stable: true,
        model: params.model,
        systemPrompt: params.systemPrompt,
        thinkingLevel: params.thinkingLevel,
        temperature: params.temperature,
        topP: params.topP,
        unrestrictedMode: params.unrestrictedMode,
        prompt: contents,
      },
      (event) => {
        if (event.type === "chunk") onChunk(event.accumulatedText)
      }
    )
    return result.text
  }

  const ai = await createStableClient(params.apiKey)
  const stream = await ai.models.generateContentStream({
    model: params.model,
    contents,
    config: {
      systemInstruction: params.systemPrompt,
      ...stableGenerationConfig(params),
      safetySettings: buildSafetySettings(params.unrestrictedMode),
      abortSignal: signal,
    },
  })

  let accumulated = ""
  for await (const chunk of stream) {
    if (signal?.aborted) break
    accumulated += chunk.text ?? ""
    onChunk(accumulated)
  }
  return accumulated
}

export async function chatStableStream(
  params: StableChatParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const wrappedUserMessage =
    params.editTarget === "document"
      ? `Edita el TEXTO ACTUAL siguiendo esta petición. Devuelve el documento completo resultante, listo para reemplazar el actual:\n\n${params.userMessage}`
      : params.quotedFragment
        ? `Fragmento seleccionado:\n"""\n${params.quotedFragment}\n"""\n\n${params.userMessage}`
        : params.userMessage
  const systemPrompt = `${params.systemPrompt.trim()}

${chatSystemInstruction(params.documentText, params.attachmentsContext)}`

  if (params.provider === "openrouter") {
    const result = await streamOpenRouterChat(
      {
        apiKey: params.apiKey,
        model: params.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...params.history.map((turn) => ({
            role: turn.role === "model" ? ("assistant" as const) : ("user" as const),
            content: turn.content,
          })),
          { role: "user", content: wrappedUserMessage },
        ],
        temperature: params.temperature,
        topP: params.topP,
      },
      onChunk,
      signal
    )
    return result.text
  }

  if (typeof window !== "undefined" && window.editorDesktop) {
    const result = await window.editorDesktop.ai.generate(
      {
        apiKey: params.apiKey,
        mode: "chat",
        stable: true,
        model: params.model,
        systemPrompt,
        thinkingLevel: params.thinkingLevel,
        temperature: params.temperature,
        topP: params.topP,
        unrestrictedMode: params.unrestrictedMode,
        prompt: wrappedUserMessage,
        history: params.history,
      },
      (event) => {
        if (event.type === "chunk") onChunk(event.accumulatedText)
      }
    )
    return result.text
  }

  const ai = await createStableClient(params.apiKey)
  const contents = [
    ...params.history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.content }],
    })),
    { role: "user" as const, parts: [{ text: wrappedUserMessage }] },
  ]
  const stream = await ai.models.generateContentStream({
    model: params.model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      ...stableGenerationConfig(params),
      safetySettings: buildSafetySettings(params.unrestrictedMode),
      abortSignal: signal,
    },
  })

  let accumulated = ""
  for await (const chunk of stream) {
    if (signal?.aborted) break
    accumulated += chunk.text ?? ""
    onChunk(accumulated)
  }
  return accumulated
}
