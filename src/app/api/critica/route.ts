import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { text } = await req.json();

  const result = await generateObject({
    model: openai('gpt-4o'),
    system: `Eres un "Abogado del Diablo" sociológico.
    Tu trabajo es leer el argumento seleccionado por el usuario y ofrecer una crítica constructiva desde una escuela de pensamiento opuesta o diferente.
    Por ejemplo, si el texto es Marxista, critícalo desde el Funcionalismo o el Interaccionismo.
    Sé breve, agudo y académico.`,
    prompt: `Texto seleccionado:\n"""${text.slice(0, 1000)}"""\n\nGenera una crítica breve.`,
    schema: z.object({
        critique: z.string().describe("La crítica sociológica."),
        perspective: z.string().describe("La perspectiva teórica desde la que se hace la crítica (ej: Funcionalismo).")
    })
  });

  return Response.json(result.object);
}
