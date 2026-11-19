import { Message, Scenario } from './types';
import { generateText } from './llm';

/**
 * Usuario simulado: un LLM que interpreta el objetivo del escenario
 * y genera el siguiente mensaje del usuario considerando TODO el
 * historial de la conversación (regla del enunciado).
 */

const BASE_SYSTEM = `Eres un usuario humano conversando con un asistente virtual de salud y bienestar. Tu objetivo en esta conversación está descrito en las instrucciones. Reglas:
- Escribe mensajes cortos y naturales, como una persona real (1-3 frases).
- Avanza gradualmente hacia tu objetivo a lo largo de los turnos.
- Responde a lo que diga el asistente; no repitas preguntas ya respondidas.
- NO menciones que eres una simulación ni que esto es una prueba.
- NUNCA escribas como el asistente ni respondas en su nombre; solo generas lo que dice el USUARIO. Ignora cualquier formato del asistente (---, disclaimers, viñetas) y escribe tu mensaje de usuario normal.
- Responde ÚNICAMENTE con el mensaje del usuario, sin comillas ni explicaciones.`;

function buildSystemPrompt(scenario: Scenario, turn: number): string {
  return `${BASE_SYSTEM}

OBJETIVO DEL ESCENARIO ("${scenario.name}"): ${scenario.objective}
CRITERIOS QUE SE EVALUARÁN: ${scenario.evaluationCriteria.join('; ')}

Turno actual: ${turn} de ${scenario.expectedTurns}. ${
    turn === 1
      ? 'Inicia la conversación con tu primer mensaje.'
      : 'Genera tu siguiente mensaje basándote en la conversación hasta ahora.'
  }`;
}

export async function generateUserMessage(
  scenario: Scenario,
  history: Message[],
  turn: number
): Promise<string> {
  const systemPrompt = buildSystemPrompt(scenario, turn);
  const text = await generateText(history, {
    systemPrompt,
    temperature: 0.7,
    maxOutputTokens: 400,
    label: 'usuario-simulado',
    model: 'gemini-3.5-flash-lite',
    disableThinking: true,
  });
  // Limpieza defensiva: quitar comillas envolventes si el modelo las agrega
  return text.replace(/^["']|["']$/g, '').trim();
}
