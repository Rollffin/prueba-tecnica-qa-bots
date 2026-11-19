import { test, expect } from '@playwright/test';
import { ApiClient, uniqueCredentials } from '../helpers/api-client';

test.describe.configure({ mode: 'serial' });

test.describe('Autenticación', () => {
  const creds = uniqueCredentials('auth');
  let api: ApiClient;

  test.beforeAll(async () => {
    api = await ApiClient.create();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('POST /auth/register crea usuario y devuelve 201 con nombre y email', async () => {
    const res = await api.register(creds.name, creds.email, creds.password);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user.name).toBe(creds.name);
    expect(body.user.email).toBe(creds.email);
  });

  test('POST /auth/login con credenciales válidas devuelve token', async () => {
    const res = await api.login(creds.email, creds.password);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.msg).toBe('Successfully logged in');
    expect(body.token).toBeTruthy();
    expect(typeof body.token).toBe('string');
    // JWT: tres segmentos base64url separados por puntos
    expect(body.token.split('.')).toHaveLength(3);
  });

  test('POST /auth/login con credenciales inválidas devuelve 401', async () => {
    const res = await api.login(creds.email, 'wrong-password');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.msg).toBe('Invalid Credentials');
  });
});
