import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return new Response('Texto es requerido', { status: 400 });
    }

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        academica: z.string().describe('Opción con mayor corrección académica, formalidad y precisión terminológica.'),
        universitario: z.string().describe('Opción de buen nivel académico pero accesible y claro.'),
        escritor: z.string().describe('Opción con gran calidad literaria, narrativa envolvente y estilo fluido.'),
      }),
      system: 'Eres un editor experto en sociología y escritura académica. Tu objetivo es mejorar textos de estudiantes ofreciendo variaciones de estilo sin cambiar el significado original.',
      prompt: `Reescribe el siguiente fragmento de texto en 3 estilos (Académica, Universitario, Escritor):\n\n"${text}"`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error en API formalizar:', error);
    // Return a mock response if API key is missing for demo purposes, or just error.
    // For this environment, if I don't have a key, it will fail.
    // I'll return a 500.
    return new Response(JSON.stringify({ error: 'Error procesando la solicitud' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
