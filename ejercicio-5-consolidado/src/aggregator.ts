import * as fs from 'fs';
import * as path from 'path';
import {
  ScenarioResult,
  DetectionCategory,
} from '../../ejercicio-1-llm-eval/src/types';

/**
 * Ejercicio 5 — Agregador del reporte consolidado.
 * Lee los outputs de los Ejercicios 1, 2 y 3 y genera un reporte global
 * en output/consolidado/ (Markdown + JSON).
 */

const ROOT = path.resolve(__dirname, '../..');
const OUT_EJ1 = path.join(ROOT, 'output/ejercicio-1');
const OUT_EJ2 = path.join(ROOT, 'output/ejercicio-2');
const OUT_EJ3 = path.join(ROOT, 'output/ejercicio-3');
const OUT_DIR = path.join(ROOT, 'output/consolidado');

// ---------- Tipos de los reportes de Playwright (results.json) ----------
interface PwTestResult {
  status: string;
  duration: number;
}
interface PwSpec {
  title: string;
  file: string;
  tests: { results: PwTestResult[] }[];
}
interface PwSuite {
  title: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  stats?: { expected: number; unexpected: number; duration: number };
  suites?: PwSuite[];
}

interface ExerciseSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  avgDurationMs?: number;
}

function readJsonSafe<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function flattenSpecs(suites: PwSuite[] = []): PwSpec[] {
  const out: PwSpec[] = [];
  for (const s of suites) {
    if (s.specs) out.push(...s.specs);
    if (s.suites) out.push(...flattenSpecs(s.suites));
  }
  return out;
}

function summarizePlaywright(dir: string): {
  summary: ExerciseSummary;
  specs: { title: string; file: string; status: string; durationMs: number }[];
  avgResponseTimeMs?: number;
} {
  const report = readJsonSafe<PwReport>(path.join(dir, 'results.json'));
  if (!report) {
    return {
      summary: { total: 0, passed: 0, failed: 0, passRate: 0 },
      specs: [],
    };
  }
  const specs = flattenSpecs(report.suites);
  const flat = specs.map((s) => {
    const last = s.tests[s.tests.length - 1];
    const result = last?.results[last.results.length - 1];
    return {
      title: s.title,
      file: s.file,
      status: result?.status ?? 'unknown',
      durationMs: result?.duration ?? 0,
    };
  });
  const passed = flat.filter((s) => s.status === 'passed').length;
  const failed = flat.filter((s) => s.status !== 'passed').length;
  const total = flat.length;
  return {
    summary: {
      total,
      passed,
      failed,
      passRate: total ? passed / total : 0,
      avgDurationMs: total
        ? Math.round(flat.reduce((a, s) => a + s.durationMs, 0) / total)
        : undefined,
    },
    specs: flat,
  };
}

// ---------- Ejercicio 1 ----------
function loadEj1(): {
  results: ScenarioResult[];
  summary: ExerciseSummary;
  detections: Record<DetectionCategory, number>;
  avgMetrics: Record<string, number>;
} {
  const files = fs.existsSync(OUT_EJ1)
    ? fs.readdirSync(OUT_EJ1).filter((f) => f.endsWith('.json'))
    : [];
  const results = files
    .map((f) => readJsonSafe<ScenarioResult>(path.join(OUT_EJ1, f)))
    .filter((r): r is ScenarioResult => r !== null);

  const passed = results.filter((r) => r.veredicto === 'PASS').length;
  const total = results.length;

  const detections: Record<DetectionCategory, number> = {
    alucinaciones: 0,
    prompt_injection: 0,
    respuestas_toxicas: 0,
    perdida_contexto: 0,
    tool_calling_incorrecto: 0,
  };
  const metricSum: Record<string, number> = {
    coherence_score: 0,
    context_retention: 0,
    hallucination_rate: 0,
    security_score: 0,
    completion_rate: 0,
  };

  for (const r of results) {
    for (const cat of Object.keys(detections) as DetectionCategory[]) {
      detections[cat] += r.detecciones?.[cat]?.length ?? 0;
    }
    for (const k of Object.keys(metricSum)) {
      metricSum[k] += (r.metricas as unknown as Record<string, number>)[k] ?? 0;
    }
  }
  const avgMetrics = Object.fromEntries(
    Object.entries(metricSum).map(([k, v]) => [k, total ? +(v / total).toFixed(3) : 0])
  );

  return {
    results,
    summary: {
      total,
      passed,
      failed: total - passed,
      passRate: total ? passed / total : 0,
    },
    detections,
    avgMetrics,
  };
}

// ---------- Ejercicio 3: tiempo de respuesta del bot ----------
function loadBotResponseTime(): number | undefined {
  const metrics = readJsonSafe<{ responseTimeMs: number }[]>(
    path.join(OUT_EJ3, 'chatbot-metrics.json')
  );
  if (!metrics || metrics.length === 0) return undefined;
  return Math.round(
    metrics.reduce((a, m) => a + m.responseTimeMs, 0) / metrics.length
  );
}

// ---------- Generación del reporte ----------
export function buildReport(): { md: string; json: unknown } {
  const ej1 = loadEj1();
  const ej2 = summarizePlaywright(OUT_EJ2);
  const ej3 = summarizePlaywright(OUT_EJ3);
  const botResponseMs = loadBotResponseTime();

  const globalTotal = ej1.summary.total + ej2.summary.total + ej3.summary.total;
  const globalPassed =
    ej1.summary.passed + ej2.summary.passed + ej3.summary.passed;
  const globalPassRate = globalTotal ? globalPassed / globalTotal : 0;

  const errorRate =
    ej1.summary.total > 0
      ? Object.values(ej1.detections).reduce((a, b) => a + b, 0) /
        (ej1.summary.total * 6)
      : 0;

  const md = `# Reporte Consolidado — Prueba Técnica QA: AI Agents, LLMs

_Generado: ${new Date().toISOString()}_

## Resumen global

| Ejercicio | Total | PASS | FAIL | % PASS |
|---|---|---|---|---|
| 1. Evaluación LLM (5 escenarios) | ${ej1.summary.total} | ${ej1.summary.passed} | ${ej1.summary.failed} | ${(ej1.summary.passRate * 100).toFixed(0)}% |
| 2. API (Goal Tracker) | ${ej2.summary.total} | ${ej2.summary.passed} | ${ej2.summary.failed} | ${(ej2.summary.passRate * 100).toFixed(0)}% |
| 3. Chatbot Web (Botpress) | ${ej3.summary.total} | ${ej3.summary.passed} | ${ej3.summary.failed} | ${(ej3.summary.passRate * 100).toFixed(0)}% |
| **TOTAL** | **${globalTotal}** | **${globalPassed}** | **${globalTotal - globalPassed}** | **${(globalPassRate * 100).toFixed(0)}%** |

## Ejercicio 1 — Escenarios LLM

| Escenario | Veredicto | Coherencia | Seguridad | Alucinación | Completitud |
|---|---|---|---|---|---|
${ej1.results
  .map(
    (r) =>
      `| ${r.escenario} | ${r.veredicto} | ${r.metricas.coherence_score} | ${r.metricas.security_score} | ${(r.metricas.hallucination_rate * 100).toFixed(0)}% | ${(r.metricas.completion_rate * 100).toFixed(0)}% |`
  )
  .join('\n')}

**Métricas promedio:** coherencia=${ej1.avgMetrics.coherence_score}, retención de contexto=${ej1.avgMetrics.context_retention}, tasa de alucinación=${ej1.avgMetrics.hallucination_rate}, seguridad=${ej1.avgMetrics.security_score}, completitud=${ej1.avgMetrics.completion_rate}

## Ejercicio 2 — API

${ej2.specs.length ? ej2.specs.map((s) => `- ${s.status === 'passed' ? '✅' : '❌'} ${s.title} (${s.file})`).join('\n') : '_Sin resultados (ejecuta npm run test:api)_' }

Duración promedio por test: ${ej2.summary.avgDurationMs ?? 'N/A'}ms

## Ejercicio 3 — Chatbot Web

${ej3.specs.length ? ej3.specs.map((s) => `- ${s.status === 'passed' ? '✅' : '❌'} ${s.title}`).join('\n') : '_Sin resultados (ejecuta npm run test:chatbot)_'}

Tiempo de respuesta promedio del bot: ${botResponseMs ? `~${botResponseMs}ms` : 'N/A'}

## Detección automática de errores (transversal)

| Categoría | Ocurrencias |
|---|---|
| Alucinaciones | ${ej1.detections.alucinaciones} |
| Prompt Injection | ${ej1.detections.prompt_injection} |
| Respuestas tóxicas | ${ej1.detections.respuestas_toxicas} |
| Pérdida de contexto | ${ej1.detections.perdida_contexto} |
| Tool calling incorrecto | ${ej1.detections.tool_calling_incorrecto} |

**Tasa de errores detectados (Ej. 1):** ${(errorRate * 100).toFixed(1)}% de turnos de asistente

## Métricas globales

- **% PASS/FAIL global:** ${(globalPassRate * 100).toFixed(1)}%
- **Tiempos promedio:** API=${ej2.summary.avgDurationMs ?? 'N/A'}ms/test · Chatbot=${botResponseMs ? `~${botResponseMs}ms` : 'N/A'} · LLM (asistente+usuario+juez por turno, ver JSONs del Ej. 1)
- **Tasa de errores detectados:** ${(errorRate * 100).toFixed(1)}%
`;

  const json = {
    generado: new Date().toISOString(),
    global: {
      total: globalTotal,
      passed: globalPassed,
      failed: globalTotal - globalPassed,
      passRate: +globalPassRate.toFixed(4),
    },
    ejercicios: {
      '1-llm-eval': {
        summary: ej1.summary,
        metricas_promedio: ej1.avgMetrics,
        detecciones: ej1.detections,
        escenarios: ej1.results.map((r) => ({
          nombre: r.escenario,
          veredicto: r.veredicto,
          metricas: r.metricas,
        })),
      },
      '2-api': { summary: ej2.summary, tests: ej2.specs },
      '3-chatbot': {
        summary: ej3.summary,
        tests: ej3.specs,
        botResponseTimeMs: botResponseMs,
      },
    },
  };

  return { md, json };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { md, json } = buildReport();
  fs.writeFileSync(path.join(OUT_DIR, 'reporte-consolidado.md'), md);
  fs.writeFileSync(
    path.join(OUT_DIR, 'reporte-consolidado.json'),
    JSON.stringify(json, null, 2)
  );
  console.log('Reporte consolidado generado en output/consolidado/');
}

// Permite importar buildReport desde tests sin ejecutar main
if (require.main === module) {
  main();
}
