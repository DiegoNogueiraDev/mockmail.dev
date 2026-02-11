import { HttpClient } from '../client';
import { Webhook, PaginatedResponse, SingleResponse } from '../types';

export class Webhooks {
  constructor(private http: HttpClient) {}

  async list(options?: { page?: number; limit?: number }): Promise<PaginatedResponse<Webhook>> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<PaginatedResponse<Webhook>>(`/webhooks${qs}`);
  }

  async create(data: { name: string; url: string; events: string[] }): Promise<Webhook> {
    const res = await this.http.post<SingleResponse<Webhook>>('/webhooks', data);
    return res.data;
  }

  async get(webhookId: string): Promise<Webhook> {
    const res = await this.http.get<SingleResponse<Webhook>>(`/webhooks/${webhookId}`);
    return res.data;
  }

  async update(webhookId: string, data: Partial<{ name: string; url: string; events: string[]; active: boolean }>): Promise<Webhook> {
    const res = await this.http.put<SingleResponse<Webhook>>(`/webhooks/${webhookId}`, data);
    return res.data;
  }

  async delete(webhookId: string): Promise<void> {
    await this.http.delete(`/webhooks/${webhookId}`);
  }
}
