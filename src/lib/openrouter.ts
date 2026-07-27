export const OPENROUTER_FREE_MODEL_ID = "openrouter/free"

export const OPENROUTER_MODELS = [
  {
    id: OPENROUTER_FREE_MODEL_ID,
    label: "OpenRouter Gratis · selección fiable",
    description:
      "Elige el modelo instructivo gratuito más popular y compatible, excluyendo clasificadores y modelos no conversacionales.",
  },
] as const

interface OpenRouterCatalogModel {
  id?: unknown
  name?: unknown
  description?: unknown
  context_length?: unknown
  architecture?: {
    output_modalities?: unknown
    instruct_type?: unknown
  }
  pricing?: {
    prompt?: unknown
    completion?: unknown
    request?: unknown
  }
  supported_parameters?: unknown
}

const UNSUITABLE_FREE_MODEL_PATTERN =
  /(?:content[-\s]?safety|moderation|guard(?:ian)?|classifier|embedding|rerank|ocr|translat(?:e|ion)[-\s]?only)/i

let cachedReliableFreeModel:
  | { id: string; expiresAt: number }
  | undefined

export function resolveOpenRouterFreeModel(model: string) {
  const candidate = model.trim()
  return candidate === OPENROUTER_FREE_MODEL_ID || candidate.endsWith(":free")
    ? candidate
    : OPENROUTER_FREE_MODEL_ID
}

function isZeroPrice(value: unknown) {
  return Number(value ?? Number.NaN) === 0
}

export function selectReliableFreeOpenRouterModel(
  entries: OpenRouterCatalogModel[]
): string | undefined {
  return entries.find((entry) => {
    const id = typeof entry.id === "string" ? entry.id : ""
    const name = typeof entry.name === "string" ? entry.name : ""
    const description =
      typeof entry.description === "string" ? entry.description : ""
    const outputModalities = Array.isArray(
      entry.architecture?.output_modalities
    )
      ? entry.architecture.output_modalities
      : []
    const supportedParameters = Array.isArray(entry.supported_parameters)
      ? entry.supported_parameters
      : []
    const contextLength = Number(entry.context_length ?? 0)

    return (
      id.endsWith(":free") &&
      !UNSUITABLE_FREE_MODEL_PATTERN.test(`${id} ${name} ${description}`) &&
      isZeroPrice(entry.pricing?.prompt) &&
      isZeroPrice(entry.pricing?.completion) &&
      (entry.pricing?.request == null ||
        isZeroPrice(entry.pricing.request)) &&
      outputModalities.includes("text") &&
      contextLength >= 32_000 &&
      supportedParameters.includes("max_tokens") &&
      supportedParameters.includes("temperature")
    )
  })?.id as string | undefined
}

export async function resolveReliableOpenRouterModel(model: string) {
  const resolved = resolveOpenRouterFreeModel(model)
  if (resolved !== OPENROUTER_FREE_MODEL_ID) return resolved
  if (
    cachedReliableFreeModel &&
    cachedReliableFreeModel.expiresAt > Date.now()
  ) {
    return cachedReliableFreeModel.id
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/models?output_modalities=text&sort=most-popular",
    {
      headers: { "X-OpenRouter-Title": "Editor Inteligente IA" },
    }
  )
  if (!response.ok) {
    throw new OpenRouterApiError(
      "No se pudo consultar el catálogo gratuito de OpenRouter.",
      { status: response.status }
    )
  }
  const payload = (await response.json()) as {
    data?: OpenRouterCatalogModel[]
  }
  const selected = selectReliableFreeOpenRouterModel(payload.data ?? [])
  if (!selected) {
    throw new OpenRouterApiError(
      "OpenRouter no ofrece ahora mismo un modelo gratuito de texto adecuado para editar documentos."
    )
  }
  cachedReliableFreeModel = {
    id: selected,
    expiresAt: Date.now() + 10 * 60 * 1000,
  }
  return selected
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface OpenRouterStreamParams {
  apiKey: string
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  topP?: number
}

interface OpenRouterErrorPayload {
  error?: {
    code?: number | string
    message?: string
  }
}

export interface OpenRouterStreamResult {
  text: string
  model?: string
  finishReason?: string
}

export class OpenRouterApiError extends Error {
  status?: number
  code?: number | string

  constructor(
    message: string,
    details: { status?: number; code?: number | string } = {}
  ) {
    super(message)
    this.name = "OpenRouterApiError"
    this.status = details.status
    this.code = details.code
  }
}

async function readOpenRouterError(response: Response) {
  let payload: OpenRouterErrorPayload | undefined
  try {
    payload = (await response.json()) as OpenRouterErrorPayload
  } catch {
    // Algunas respuestas de infraestructura no contienen JSON.
  }
  return new OpenRouterApiError(
    payload?.error?.message ||
      `OpenRouter devolvió un error HTTP ${response.status}.`,
    {
      status: response.status,
      code: payload?.error?.code,
    }
  )
}

function readDeltaContent(value: unknown): string {
  if (typeof value === "string") return value
  if (!Array.isArray(value)) return ""
  return value
    .map((part) => {
      if (!part || typeof part !== "object") return ""
      const text = (part as { text?: unknown }).text
      return typeof text === "string" ? text : ""
    })
    .join("")
}

export async function streamOpenRouterChat(
  params: OpenRouterStreamParams,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<OpenRouterStreamResult> {
  const selectedModel = await resolveReliableOpenRouterModel(params.model)
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Editor Inteligente IA",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: params.messages,
        stream: true,
        ...(typeof params.temperature === "number"
          ? { temperature: params.temperature }
          : {}),
        ...(typeof params.topP === "number" ? { top_p: params.topP } : {}),
      }),
      signal,
    }
  )

  if (!response.ok) throw await readOpenRouterError(response)
  if (!response.body) {
    throw new OpenRouterApiError(
      "OpenRouter no devolvió un flujo de respuesta."
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  let accumulatedText = ""
  let actualModel: string | undefined
  let finishReason: string | undefined

  const processEvent = (event: string) => {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (!data || data === "[DONE]") continue
      let payload: {
        model?: unknown
        error?: { code?: number | string; message?: string }
        choices?: Array<{
          delta?: { content?: unknown }
          finish_reason?: unknown
        }>
      }
      try {
        payload = JSON.parse(data) as typeof payload
      } catch {
        continue
      }
      if (payload.error) {
        throw new OpenRouterApiError(
          payload.error.message || "OpenRouter interrumpió la respuesta.",
          { code: payload.error.code }
        )
      }
      if (typeof payload.model === "string") actualModel = payload.model
      const choice = payload.choices?.[0]
      const delta = readDeltaContent(choice?.delta?.content)
      if (delta) {
        accumulatedText += delta
        onChunk(accumulatedText)
      }
      if (typeof choice?.finish_reason === "string") {
        finishReason = choice.finish_reason
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    pending += decoder.decode(value, { stream: !done })
    const events = pending.split(/\r?\n\r?\n/)
    pending = events.pop() ?? ""
    for (const event of events) processEvent(event)
    if (done) break
  }
  if (pending.trim()) processEvent(pending)

  return { text: accumulatedText, model: actualModel, finishReason }
}

export async function testOpenRouterApiKey(apiKey: string) {
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-OpenRouter-Title": "Editor Inteligente IA",
    },
  })
  if (!response.ok) throw await readOpenRouterError(response)
  const payload = (await response.json()) as {
    data?: {
      label?: string
      is_free_tier?: boolean
      limit_remaining?: number | null
    }
  }
  return payload.data ?? {}
}

export function friendlyOpenRouterErrorMessage(error: unknown): string {
  const value = error as {
    message?: string
    status?: number
    code?: number | string
  }
  const status = value?.status
  const message = String(value?.message ?? error ?? "")
  if (status === 401 || status === 403) {
    return "OpenRouter rechazó la API Key. Comprueba la clave en Ajustes."
  }
  if (status === 402) {
    return "La cuenta de OpenRouter no tiene crédito para este modelo. Selecciona el enrutador gratuito o revisa la cuenta."
  }
  if (status === 429 || value?.code === 429) {
    return "OpenRouter ha alcanzado el límite temporal o diario de los modelos gratuitos. No se ha reintentado automáticamente."
  }
  if (status === 404) {
    return "El modelo de OpenRouter ya no está disponible. Vuelve al selector gratuito automático."
  }
  if (/failed to fetch|fetch failed|network/i.test(message)) {
    return "No se pudo conectar con OpenRouter. Comprueba la conexión; la solicitud no se ha reintentado."
  }
  return message || "No se pudo completar la solicitud con OpenRouter."
}
