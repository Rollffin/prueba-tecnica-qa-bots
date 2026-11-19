import { test, expect } from '@playwright/test';
import { ApiClient, uniqueCredentials } from '../helpers/api-client';

/**
 * Edge cases de la Goal Tracker API.
 * Status codes y mensajes verificados contra la API real
 * (https://goal-tracker-api.onrender.com).
 */

test.describe.configure({ mode: 'serial' });

test.describe('Edge cases — Auth', () => {
  const creds = uniqueCredentials('edgeauth');
  let api: ApiClient;

  test.beforeAll(async () => {
    api = await ApiClient.create();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('register con email duplicado devuelve 400', async () => {
    const first = await api.register(creds.name, creds.email, creds.password);
    expect(first.status()).toBe(201);

    const dup = await api.register(creds.name, creds.email, creds.password);
    expect(dup.status()).toBe(400);
    const body = await dup.json();
    expect(body.msg).toBe('Email address already exists');
  });

  test('login con email inexistente devuelve 401', async () => {
    const res = await api.login('noexiste@test.com', 'whatever123');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.msg).toBe('Invalid Credentials');
  });

  test('login sin campo password devuelve 400', async () => {
    const res = await api.requestContext.post('/api/v1/auth/login', {
      data: { email: creds.email },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.msg).toBe('Please provide an email address and password');
  });
});

test.describe('Edge cases — Goals', () => {
  const creds = uniqueCredentials('edgegoals');
  const FAKE_ID = '507f1f77bcf86cd799439011'; // ObjectId válido pero inexistente
  let api: ApiClient;
  let token: string;

  test.beforeAll(async () => {
    api = await ApiClient.create();
    const reg = await api.register(creds.name, creds.email, creds.password);
    expect(reg.status()).toBe(201);
    const login = await api.login(creds.email, creds.password);
    expect(login.status()).toBe(200);
    token = (await login.json()).token;
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('GET /goals sin token devuelve 401', async () => {
    const res = await api.requestContext.get('/api/v1/goals');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.msg).toBe('Authentication invalid');
  });

  test('GET /goals con token inválido devuelve 401', async () => {
    const res = await api.requestContext.get('/api/v1/goals', {
      headers: { Authorization: 'Bearer token-invalido' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.msg).toBe('Not authorised to access this route');
  });

  test('POST /goals sin token devuelve 401', async () => {
    const res = await api.requestContext.post('/api/v1/goals', {
      data: { title: 'Sin auth' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.msg).toBe('Authentication invalid');
  });

  test('POST /goals sin title devuelve 400', async () => {
    const res = await api.requestContext.post('/api/v1/goals', {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: 'Falta el título' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.msg).toBe('Please add a title');
  });

  test('GET /goals/:id inexistente devuelve 404', async () => {
    const res = await api.getGoal(token, FAKE_ID);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.msg).toBe(`No goal with id: ${FAKE_ID}`);
  });

  test('DELETE /goals/:id inexistente devuelve 404', async () => {
    const res = await api.deleteGoal(token, FAKE_ID);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.msg).toBe(`No goal with id: ${FAKE_ID}`);
  });
});
