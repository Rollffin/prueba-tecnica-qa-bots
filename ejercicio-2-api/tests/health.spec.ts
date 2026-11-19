import { test, expect } from '@playwright/test';
import { ApiClient } from '../helpers/api-client';

// Render free tier puede tener cold starts; timeout amplio solo para este spec.
test.describe.configure({ mode: 'serial' });

test.describe('Health Check', () => {
  test('GET /api/v1/status responde 200 y status OPERATIONAL', async () => {
    test.setTimeout(90_000); // cold start de Render
    const api = await ApiClient.create();
    try {
      const res = await api.getStatus();
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('OPERATIONAL');
    } finally {
      await api.dispose();
    }
  });
});
