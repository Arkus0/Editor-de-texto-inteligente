import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { text } = await req.json();

  const result = await generateObject({
    model: openai('gpt-4o'),
    system: `Eres un "Abogado del Diablo" académico.
    Tu trabajo es leer el argumento seleccionado por el usuario y ofrecer una crítica constructiva desde una perspectiva opuesta o diferente.
    Identifica el campo académico y la posición teórica del texto, luego critícalo desde otro enfoque válido dentro de ese campo.
    Por ejemplo: si es economía neoliberal, critícalo desde keynesianismo; si es empirismo, desde racionalismo; si es marxismo, desde funcionalismo.
    Sé breve, agudo y académico.`,
    prompt: `Texto seleccionado:\n"""${text.slice(0, 1000)}"""\n\nGenera una crítica breve desde una perspectiva opuesta.`,
    schema: z.object({
        critique: z.string().describe("La crítica académica desde una perspectiva opuesta."),
        perspective: z.string().describe("La perspectiva teórica o corriente desde la que se hace la crítica (ej: Empirismo, Funcionalismo, Keynesianismo, etc.).")
    })
  });

  return Response.json(result.object);
}
