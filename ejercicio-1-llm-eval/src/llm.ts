import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
  Part,
} from '@google/generative-ai';
import { Message } from './types';

/**
 * Cliente compartido de Gemini con retry + backoff para rate limits (429)
 * y timeouts. Usado por el asistente bajo prueba, el usuario simulado
 * y el motor de evaluación (LLM-as-judge).
 */

export const MODEL_NAME = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
export const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash-lite';

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 5000;

let genAI: GoogleGenerativeAI | null = null;
const models = new Map<string, GenerativeModel>();
let lastCallAt = 0;
const MIN_INTERVAL_MS = 3500; // free tier ~15 RPM

function getModel(name?: string): GenerativeModel {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY no está definida. Copia .env.example a .env y configura tu key.'
      );
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  const key = name ?? MODEL_NAME;
  let m = models.get(key);
  if (!m) {
    m = genAI.getGenerativeModel({ model: key });
    models.set(key, m);
  }
  return m;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toGeminiContents(history: Message[]): Content[] {
  const contents = history
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content } as Part],
    }));
  // La API exige contents no vacío: kickoff sintético para el turno 1
  if (contents.length === 0) {
    contents.push({
      role: 'user' as const,
      parts: [{ text: '(Inicio de la conversación)' } as Part],
    });
  }
  // Los modelos nuevos (3.5-flash-lite) rechazan requests que terminan
  // en un turno del modelo: añadir turno de usuario sintético
  const last = contents[contents.length - 1];
  if (last.role === 'model') {
    contents.push({
      role: 'user' as const,
      parts: [{ text: '(Genera tu siguiente mensaje)' } as Part],
    });
  }
  return contents;
}

export interface GenerateOptions {
  systemPrompt?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  label?: string;
  model?: string;
  disableThinking?: boolean;
}

/**
 * Genera una respuesta de texto a partir del historial de mensajes.
 * Lanza error tras agotar reintentos.
 */
export async function generateText(
  history: Message[],
  options: GenerateOptions = {}
): Promise<string> {
  const m = getModel(options.model);
  const contents = toGeminiContents(history);
  const config: Record<string, unknown> = {
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxOutputTokens ?? 2048,
    // gemini-2.5/3.1-flash son modelos "thinking": sin esto el razonamiento
    // consume todo el budget y devuelve texto vacío o JSON truncado.
    // Algunos modelos (p.ej. 3.5-flash-lite) rechazan esta opción.
    ...(options.disableThinking
      ? {}
      : { thinkingConfig: { thinkingBudget: 0 } }),
  };
  if (options.jsonMode) {
    config.responseMimeType = 'application/json';
  }

  const request: Record<string, unknown> = { contents, generationConfig: config };
  if (options.systemPrompt) {
    request.systemInstruction = options.systemPrompt;
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Fallback: si thinkingBudget:0 produce respuestas vacías de forma
    // sistemática, a partir del intento 3 se reintenta sin esa opción
    if (attempt >= 3) {
      delete (config as Record<string, unknown>).thinkingConfig;
    }
    // Throttle: espaciar llamadas para no superar el RPM del free tier
    const elapsed = Date.now() - lastCallAt;
    if (lastCallAt > 0 && elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }
    lastCallAt = Date.now();
    try {
      const result = await m.generateContent(request as never);
      const text = result.response.text().trim();
      if (!text) {
        const cand = result.response.candidates?.[0];
        const finish = cand?.finishReason ?? 'unknown';
        const block = result.response.promptFeedback?.blockReason ?? 'none';
        throw new Error(
          `El modelo devolvió una respuesta vacía [${options.label ?? 'llm'}] (finishReason=${finish}, blockReason=${block})`
        );
      }
      return text;
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message ?? '';
      const isRateLimit = /429|quota|rate/i.test(msg);
      const isEmpty = /vacía/i.test(msg);
      if ((!isRateLimit && !isEmpty) || attempt === MAX_RETRIES - 1) break;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(`[gemini] ${isRateLimit ? 'Rate limit' : 'Empty response'}: ${msg.slice(0, 120)} — reintento en ${delay}ms`);
      await sleep(delay);
    }
  }
  // Fallback final: si el modelo principal devuelve vacío de forma
  // sistemática (quirk del lite), intentar una vez con el modelo alterno
  const lastMsg = (lastErr as Error)?.message ?? '';
  if (/vacía/i.test(lastMsg) && genAI) {
    for (let fbTry = 0; fbTry < 2; fbTry++) {
      try {
        const fb = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
        const cfg2: Record<string, unknown> = { ...config };
        delete cfg2.thinkingConfig;
        const req2 = { ...request, generationConfig: cfg2 };
        const r2 = await fb.generateContent(req2 as never);
        const t2 = r2.response.text().trim();
        if (t2) {
          console.warn(`[gemini] Fallback a ${FALLBACK_MODEL} exitoso`);
          return t2;
        }
      } catch (fbErr) {
        console.warn(`[gemini] Fallback falló: ${(fbErr as Error).message.slice(0, 100)}`);
        await sleep(5000);
      }
    }
  }
  throw lastErr;
}

/** Genera y parsea JSON. Lanza error si la respuesta no es JSON válido. */
export async function generateJson<T>(
  history: Message[],
  options: GenerateOptions = {}
): Promise<T> {
  const raw = await generateText(history, { ...options, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A veces el modelo envuelve el JSON en markdown pese al mime type
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Respuesta no es JSON válido: ${raw.slice(0, 200)}`);
  }
}
