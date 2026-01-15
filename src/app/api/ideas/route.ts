import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { context } = await req.json();

  const result = await generateObject({
    model: openai('gpt-4o'),
    system: `Eres un asistente sociológico experto en ayudar a superar el bloqueo del escritor.
    Analiza el texto proporcionado y sugiere 3 posibles caminos para continuar la argumentación o narrativa, basándote en teorías sociológicas relevantes.
    Sé breve y directo.`,
    prompt: `Contexto del documento:\n"""${context.slice(0, 3000)}"""\n\nSugiere 3 ideas para continuar.`,
    schema: z.object({
        ideas: z.array(z.string()).describe("Lista de 3 sugerencias breves para continuar el texto.")
    })
  });

  return Response.json(result.object);
}
