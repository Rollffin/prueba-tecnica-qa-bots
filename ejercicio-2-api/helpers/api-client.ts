import { APIRequestContext, request } from '@playwright/test';

/**
 * Cliente tipado para la Goal Tracker API.
 * Contrato verificado contra https://goal-tracker-api.onrender.com
 */

export const BASE_URL =
  process.env.BASE_URL_API ?? 'https://goal-tracker-api.onrender.com';

export interface User {
  name: string;
  email: string;
}

export interface Goal {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  createdBy: string;
  createdAt: string;
}

export interface LoginResponse {
  msg: string;
  token: string;
}

export class ApiClient {
  private ctx: APIRequestContext;

  private constructor(ctx: APIRequestContext) {
    this.ctx = ctx;
  }

  static async create(): Promise<ApiClient> {
    const ctx = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
    return new ApiClient(ctx);
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }

  // ---------- Health ----------
  async getStatus() {
    return this.ctx.get('/api/v1/status');
  }

  // ---------- Auth ----------
  async register(name: string, email: string, password: string) {
    return this.ctx.post('/api/v1/auth/register', {
      data: { name, email, password },
    });
  }

  async login(email: string, password: string) {
    return this.ctx.post('/api/v1/auth/login', {
      data: { email, password },
    });
  }

  // ---------- Goals (requieren Bearer token) ----------
  private authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async createGoal(token: string, title: string, description?: string) {
    return this.ctx.post('/api/v1/goals', {
      headers: this.authHeaders(token),
      data: { title, description },
    });
  }

  async listGoals(token: string) {
    return this.ctx.get('/api/v1/goals', { headers: this.authHeaders(token) });
  }

  async getGoal(token: string, id: string) {
    return this.ctx.get(`/api/v1/goals/${id}`, {
      headers: this.authHeaders(token),
    });
  }

  async deleteGoal(token: string, id: string) {
    return this.ctx.delete(`/api/v1/goals/${id}`, {
      headers: this.authHeaders(token),
    });
  }
}

/** Genera credenciales únicas por ejecución para evitar colisiones 409. */
export function uniqueCredentials(prefix = 'qa') {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `QA ${prefix}`,
    email: `${prefix}_${id}@test.com`,
    password: 'Test1234!',
  };
}
