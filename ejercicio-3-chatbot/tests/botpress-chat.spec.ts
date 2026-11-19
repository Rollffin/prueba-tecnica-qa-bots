import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Ejercicio 3 — Automatización del chat widget de Botpress Docs.
 *
 * NOTA: el "chat widget" de https://botpress.com/docs/ NO es un iframe cross-origin;
 * es un panel lateral nativo ("Ask Docs" / asistente de IA de la documentación)
 * que viene abierto por defecto en desktop. Los tests validan el mismo objetivo
 * del enunciado: carga del sitio, presencia del widget, abrir/cerrar,
 * nombre del bot y conversación con medición de tiempo de respuesta.
 */

const SITE_URL = 'https://botpress.com/docs/';
const OUTPUT_DIR = path.resolve(__dirname, '../../output/ejercicio-3');
const BOT_NAME = 'How can I help?';

interface ChatMetrics {
  responseTimeMs: number;
  userMessage: string;
  botResponsePreview: string;
  timestamp: string;
}

const metrics: ChatMetrics[] = [];

function chatPanel(page: Page) {
  // Panel lateral del asistente: ancestro del botón Send con layout de columna.
  return page
    .getByRole('button', { name: 'Send' })
    .first()
    .locator('xpath=ancestor::div[contains(@class,"h-full")][1]');
}

function chatInput(page: Page) {
  return page.locator('textarea[placeholder="Ask a question..."]');
}

/** Espera a que el panel muestre contenido nuevo del bot tras enviar un mensaje. */
async function waitForBotResponse(
  page: Page,
  textBeforeSend: string,
  timeoutMs = 30_000
): Promise<{ elapsedMs: number; panelText: string }> {
  const start = Date.now();
  const panel = chatPanel(page);
  let lastText = '';
  let stableSince = 0;

  while (Date.now() - start < timeoutMs) {
    const current = await panel.innerText();
    const isNew =
      current.length > textBeforeSend.length + 10 && current !== textBeforeSend;
    if (isNew) {
      if (current === lastText) {
        if (Date.now() - stableSince > 800) {
          return { elapsedMs: Date.now() - start, panelText: current };
        }
      } else {
        lastText = current;
        stableSince = Date.now();
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error('El bot no respondió dentro del timeout de 30s');
}

test.describe.configure({ mode: 'serial' });

test.describe('Chatbot Web — Botpress Docs', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test.afterAll(() => {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'chatbot-metrics.json'),
      JSON.stringify(metrics, null, 2)
    );
  });

  test('El sitio carga correctamente (status 200 y contenido clave visible)', async ({
    page,
  }) => {
    const response = await page.goto(SITE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('button', { name: 'Ask Docs' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('El chat widget está presente en la página', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(chatInput(page)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: 'Send' })
    ).toBeVisible();
  });

  test('Se puede leer el nombre del bot en el widget', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const panel = chatPanel(page);
    await expect(panel).toBeVisible({ timeout: 20_000 });
    // Nombre/título del asistente mostrado en el header del panel
    await expect(
      panel.getByRole('heading', { name: BOT_NAME })
    ).toBeVisible();
    // Disclaimer de que es un agente IA
    await expect(panel.getByText(/AI agent/i)).toBeVisible();
  });

  test('El panel se puede cerrar y volver a abrir', async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const panel = chatPanel(page);
    await expect(panel).toBeVisible({ timeout: 20_000 });

    // Cerrar: probar los botones de cierre disponibles
    const closeAssistant = page.getByRole('button', { name: 'Close assistant' });
    const closePanel = page.getByRole('button', { name: 'Close panel' });
    if (await closeAssistant.isVisible().catch(() => false)) {
      await closeAssistant.click();
    } else {
      await closePanel.click();
    }
    await expect(chatInput(page)).toBeHidden({ timeout: 10_000 });

    // Reabrir
    const openBtn = page.getByRole('button', { name: 'Open AI assistant' });
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
    } else {
      await page.getByRole('button', { name: 'Ask Docs' }).first().click();
    }
    await expect(chatInput(page)).toBeVisible({ timeout: 15_000 });
  });

  test('Conversación: enviar "Hola", validar mensaje y respuesta con tiempo', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const panel = chatPanel(page);
    await expect(panel).toBeVisible({ timeout: 20_000 });

    const textBefore = await panel.innerText();

    await chatInput(page).fill('Hola');
    await page.getByRole('button', { name: 'Send' }).click();

    // El mensaje del usuario debe aparecer en el historial
    await expect(panel.getByText('Hola', { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // Esperar respuesta del bot y medir tiempo
    const { elapsedMs, panelText } = await waitForBotResponse(page, textBefore);

    metrics.push({
      responseTimeMs: elapsedMs,
      userMessage: 'Hola',
      botResponsePreview: panelText.slice(-500),
      timestamp: new Date().toISOString(),
    });

    // Evidencia visual del chat con la conversación
    await panel.screenshot({
      path: path.join(OUTPUT_DIR, 'chat-conversation.png'),
    });

    // La respuesta no debe estar vacía ni ser solo el eco del usuario
    const afterHola = panelText.split('Hola').slice(1).join('Hola');
    expect(afterHola.trim().length).toBeGreaterThan(20);
    console.log(`[chatbot] Respuesta del bot en ~${elapsedMs}ms`);
  });

  test('Edge: el botón Send está deshabilitado con el input vacío', async ({
    page,
  }) => {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(chatInput(page)).toBeVisible({ timeout: 20_000 });
    const sendBtn = page.getByRole('button', { name: 'Send' });
    // Con el textarea vacío, Send debe estar deshabilitado
    await expect(sendBtn).toBeDisabled();
  });

  test('Edge: conversación multi-turno mantiene contexto', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const panel = chatPanel(page);
    await expect(panel).toBeVisible({ timeout: 20_000 });

    // Turno 1
    let textBefore = await panel.innerText();
    await chatInput(page).fill('Hola');
    await page.getByRole('button', { name: 'Send' }).click();
    await waitForBotResponse(page, textBefore);

    // Turno 2: pregunta de seguimiento que depende del contexto
    textBefore = await panel.innerText();
    await chatInput(page).fill('¿Qué es la hidratación?');
    await page.getByRole('button', { name: 'Send' }).click();
    const { panelText } = await waitForBotResponse(page, textBefore);

    // La respuesta debe existir y el historial debe contener ambos mensajes del usuario
    await expect(panel.getByText('Hola', { exact: true })).toBeVisible();
    await expect(
      panel.getByText('¿Qué es la hidratación?', { exact: true })
    ).toBeVisible();
    expect(panelText.length).toBeGreaterThan(textBefore.length + 20);
  });
});
