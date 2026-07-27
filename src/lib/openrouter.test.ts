import { afterEach, describe, expect, it, vi } from "vitest"

import {
  friendlyOpenRouterErrorMessage,
  OPENROUTER_FREE_MODEL_ID,
  selectReliableFreeOpenRouterModel,
  resolveOpenRouterFreeModel,
  streamOpenRouterChat,
  testOpenRouterApiKey,
} from "@/lib/openrouter"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("transporte de OpenRouter", () => {
  it("procesa streaming SSE, ignora comentarios y conserva el modelo real", async () => {
    const body = [
      ": OPENROUTER PROCESSING\n\n",
      'data: {"model":"qwen/model:free","choices":[{"delta":{"content":"Hola"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" mundo"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ].join("")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "qwen/model:free",
                name: "Qwen Instruct",
                description: "Modelo instructivo general",
                context_length: 131072,
                architecture: {
                  output_modalities: ["text"],
                  instruct_type: "chatml",
                },
                pricing: { prompt: "0", completion: "0", request: "0" },
                supported_parameters: ["max_tokens", "temperature"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    vi.stubGlobal("fetch", fetchMock)
    const chunks: string[] = []

    const result = await streamOpenRouterChat(
      {
        apiKey: "sk-or-v1-test",
        model: OPENROUTER_FREE_MODEL_ID,
        messages: [{ role: "user", content: "Saluda" }],
      },
      (text) => chunks.push(text)
    )

    expect(result).toEqual({
      text: "Hola mundo",
      model: "qwen/model:free",
      finishReason: "stop",
    })
    expect(chunks).toEqual(["Hola", "Hola mundo"])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      JSON.parse(
        String((fetchMock.mock.calls[1][1] as RequestInit).body)
      )
    ).toMatchObject({
      model: "qwen/model:free",
      stream: true,
    })
  })

  it("valida la clave sin gastar una generación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { label: "Editor", is_free_tier: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(testOpenRouterApiKey("sk-or-v1-test")).resolves.toMatchObject({
      label: "Editor",
      is_free_tier: true,
    })
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://openrouter.ai/api/v1/key"
    )
  })

  it("explica los límites gratuitos sin reintentar automáticamente", () => {
    expect(
      friendlyOpenRouterErrorMessage({
        status: 429,
        message: "Rate limit exceeded",
      })
    ).toContain("No se ha reintentado")
  })

  it("impide seleccionar por accidente un modelo de pago", () => {
    expect(resolveOpenRouterFreeModel("anthropic/claude-sonnet")).toBe(
      OPENROUTER_FREE_MODEL_ID
    )
    expect(resolveOpenRouterFreeModel("qwen/qwen-model:free")).toBe(
      "qwen/qwen-model:free"
    )
  })

  it("excluye clasificadores de seguridad del selector gratuito", () => {
    expect(
      selectReliableFreeOpenRouterModel([
        {
          id: "nvidia/content-safety:free",
          name: "Content Safety",
          description: "Clasificador de seguridad",
          context_length: 128000,
          architecture: { output_modalities: ["text"] },
          pricing: { prompt: "0", completion: "0", request: "0" },
          supported_parameters: ["max_tokens", "temperature"],
        },
        {
          id: "nvidia/nemotron-instruct:free",
          name: "Nemotron Instruct",
          description: "Modelo general para seguir instrucciones",
          context_length: 262144,
          architecture: { output_modalities: ["text"] },
          pricing: { prompt: "0", completion: "0", request: "0" },
          supported_parameters: ["max_tokens", "temperature"],
        },
      ])
    ).toBe("nvidia/nemotron-instruct:free")
  })
})
