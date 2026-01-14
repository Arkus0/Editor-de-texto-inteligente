import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!rateLimit(ip, 20, 60000)) {
      return new Response(JSON.stringify({ error: 'Demasiadas solicitudes.' }), { status: 429 });
    }

    const { word, context } = await req.json();

    if (!word) {
      return new Response('Palabra es requerida', { status: 400 });
    }

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        synonyms: z.array(z.string()).describe('Lista de 5 sinónimos académicos precisos.'),
      }),
      system: 'Eres un asistente de redacción académica.',
      prompt: `Sugiere 5 sinónimos académicos para la palabra "${word}" en el siguiente contexto: "${context || 'texto académico general'}".`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error en API sinonimos:', error);
    return new Response(JSON.stringify({ error: 'Error procesando la solicitud' }), { status: 500 });
  }
}
