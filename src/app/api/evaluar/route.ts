import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60; // Puede tardar un poco más en analizar textos largos

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Limite más estricto para evaluación completa (5 cada 10 min)
    if (!rateLimit(ip, 5, 600000)) {
      return new Response(JSON.stringify({ error: 'Límite de evaluaciones alcanzado. Espera unos minutos.' }), { status: 429 });
    }

    const { text } = await req.json();

    if (!text || text.length < 50) {
      return new Response(JSON.stringify({ error: 'El texto es demasiado corto para evaluar.' }), { status: 400 });
    }

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        nota: z.number().min(0).max(10).describe('Nota numérica del 0 al 10 con un decimal.'),
        comentario_general: z.string().describe('Resumen general de la calidad del texto.'),
        puntos_fuertes: z.array(z.string()).describe('Lista de 3 aspectos positivos.'),
        puntos_mejora: z.array(z.string()).describe('Lista de 3 aspectos a mejorar.'),
        analisis_critico: z.string().describe('Breve análisis sobre la profundidad académica y argumentativa del texto.'),
      }),
      system: 'Eres un profesor universitario estricto pero justo. Evalúas trabajos académicos de cualquier disciplina buscando rigor conceptual, claridad expositiva, uso correcto de terminología, estructura lógica y fundamentación sólida. Adapta tus criterios al campo académico del texto.',
      prompt: `Evalúa el siguiente texto académico:\n\n"${text}"`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error en API evaluar:', error);
    return new Response(JSON.stringify({ error: 'Error al evaluar el texto.' }), { status: 500 });
  }
}
