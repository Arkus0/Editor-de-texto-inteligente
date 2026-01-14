import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!rateLimit(ip, 15, 60000)) {
      return new Response(JSON.stringify({ error: 'Demasiadas solicitudes.' }), { status: 429 });
    }

    const { previousParagraph, currentLine } = await req.json();

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        connectors: z.array(z.string()).describe('Lista de 3 conectores lógicos contextuales (ej: Por el contrario, Asimismo, En consecuencia).'),
      }),
      system: 'Eres un experto en redacción académica. Tu objetivo es mejorar la cohesión del texto sugiriendo conectores lógicos adecuados entre párrafos.',
      prompt: `Sugiere 3 conectores lógicos para enlazar el siguiente párrafo anterior con el actual:\n\nPárrafo Anterior: "${previousParagraph}"\n\nInicio actual: "${currentLine}"\n\nSi no hay párrafo anterior, sugiere inicios de introducción.`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error en API conectores:', error);
    return new Response(JSON.stringify({ error: 'Error procesando la solicitud' }), { status: 500 });
  }
}
