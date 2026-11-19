import { request } from '@playwright/test';

/**
 * Warm-up no fatal: Render free tier tarda ~30-60s en despertar tras inactividad.
 * Si la API no responde, solo se registra un warning; los tests tienen sus propios timeouts.
 */
async function globalSetup() {
  const baseURL =
    process.env.BASE_URL_API ?? 'https://goal-tracker-api.onrender.com';
  try {
    const ctx = await request.newContext({ baseURL, timeout: 90_000 });
    const res = await ctx.get('/api/v1/status');
    console.log(`[global-setup] API status: ${res.status()} (${baseURL})`);
    await ctx.dispose();
  } catch (err) {
    console.warn(
      `[global-setup] Warm-up falló (no fatal): ${(err as Error).message}`
    );
  }
}

export default globalSetup;
