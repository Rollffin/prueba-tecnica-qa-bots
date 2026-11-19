import { test, expect } from '@playwright/test';
import { ApiClient, uniqueCredentials, Goal } from '../helpers/api-client';

test.describe.configure({ mode: 'serial' });

/**
 * Ciclo de vida completo: register → login → crear 2 goals → consultar → listar → eliminar.
 */
test.describe('Goals CRUD', () => {
  const creds = uniqueCredentials('goals');
  let api: ApiClient;
  let token: string;
  let goal1: Goal;
  let goal2: Goal;

  test.beforeAll(async () => {
    api = await ApiClient.create();

    // Registrar y login para obtener token
    const reg = await api.register(creds.name, creds.email, creds.password);
    expect(reg.status()).toBe(201);

    const login = await api.login(creds.email, creds.password);
    expect(login.status()).toBe(200);
    token = (await login.json()).token;
    expect(token).toBeTruthy();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('Crear goal 1 devuelve 201 con campos obligatorios', async () => {
    const res = await api.createGoal(token, 'Correr 5k', 'Meta de carrera');
    expect(res.status()).toBe(201);
    const body = await res.json();
    goal1 = body.goal;

    expect(goal1._id).toBeTruthy();
    expect(goal1.title).toBe('Correr 5k');
    expect(goal1.description).toBe('Meta de carrera');
    expect(goal1.status).toBeDefined();
    expect(goal1.priority).toBeDefined();
    expect(goal1.createdBy).toBeTruthy();
    expect(goal1.createdAt).toBeTruthy();
    expect(new Date(goal1.createdAt).getTime()).not.toBeNaN();
  });

  test('Crear goal 2 devuelve 201', async () => {
    const res = await api.createGoal(token, 'Leer 12 libros', 'Un libro por mes');
    expect(res.status()).toBe(201);
    const body = await res.json();
    goal2 = body.goal;
    expect(goal2._id).toBeTruthy();
    expect(goal2.title).toBe('Leer 12 libros');
  });

  test('GET /goals/:id devuelve la información íntegra del goal', async () => {
    const res = await api.getGoal(token, goal1._id);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.goal._id).toBe(goal1._id);
    expect(body.goal.title).toBe(goal1.title);
    expect(body.goal.description).toBe(goal1.description);
    expect(body.goal.createdAt).toBe(goal1.createdAt);
  });

  test('GET /goals lista los goals creados', async () => {
    const res = await api.listGoals(token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.goals)).toBe(true);
    expect(body.goals.length).toBeGreaterThanOrEqual(2);

    const ids = body.goals.map((g: Goal) => g._id);
    expect(ids).toContain(goal1._id);
    expect(ids).toContain(goal2._id);
  });

  test('DELETE /goals/:id elimina el goal y luego devuelve 404', async () => {
    const del = await api.deleteGoal(token, goal1._id);
    expect(del.status()).toBe(200);

    const after = await api.getGoal(token, goal1._id);
    expect(after.status()).toBe(404);
  });

  test('GET /goals ya no incluye el goal eliminado', async () => {
    const res = await api.listGoals(token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = body.goals.map((g: Goal) => g._id);
    expect(ids).not.toContain(goal1._id);
    expect(ids).toContain(goal2._id);
  });
});
