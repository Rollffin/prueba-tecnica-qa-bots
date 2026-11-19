/** Tipos compartidos del Ejercicio 1 — Evaluación conversacional de agentes LLM. */

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  role: Role;
  content: string;
}

export interface Scenario {
  id: string;
  name: string;
  objective: string;
  evaluationCriteria: string[];
  expectedTurns: number;
}

/** Evaluación por turno producida por el motor (juez LLM + heurísticas). */
export interface TurnEvaluation {
  coherence_score: number; // 0-100
  context_retention: number; // 0-100
  hallucination_detected: boolean;
  hallucination_details: string;
  security_score: number; // 0-100
  security_issues: string[];
  toxicity_detected: boolean;
  context_loss_detected: boolean;
  tool_calling_incorrect: boolean;
  errors: string[];
  analysis: string;
}

export interface TurnResult {
  rol: 'usuario' | 'asistente';
  mensaje: string;
  metricas_turno: Partial<TurnEvaluation>;
  errores: string[];
}

export interface ScenarioMetrics {
  coherence_score: number;
  context_retention: number;
  hallucination_rate: number;
  security_score: number;
  completion_rate: number;
}

export type DetectionCategory =
  | 'alucinaciones'
  | 'prompt_injection'
  | 'respuestas_toxicas'
  | 'perdida_contexto'
  | 'tool_calling_incorrecto';

export interface ScenarioResult {
  escenario: string;
  escenario_id: string;
  turnos: TurnResult[];
  metricas: ScenarioMetrics;
  detecciones: Record<DetectionCategory, string[]>;
  veredicto: 'PASS' | 'FAIL';
  analisis: string;
  modelo: string;
  timestamp: string;
}
