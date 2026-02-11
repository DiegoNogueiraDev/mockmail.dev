import { HttpClient } from '../client';
import { EmailBox, PaginatedResponse, SingleResponse } from '../types';

export class Boxes {
  constructor(private http: HttpClient) {}

  async create(options?: { customName?: string }): Promise<EmailBox> {
    const res = await this.http.post<SingleResponse<EmailBox>>('/boxes', options);
    return res.data;
  }

  async list(options?: { page?: number; limit?: number }): Promise<PaginatedResponse<EmailBox>> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<PaginatedResponse<EmailBox>>(`/boxes${qs}`);
  }

  async get(boxId: string): Promise<EmailBox> {
    const res = await this.http.get<SingleResponse<EmailBox>>(`/boxes/${boxId}`);
    return res.data;
  }

  async delete(boxId: string): Promise<void> {
    await this.http.delete(`/boxes/${boxId}`);
  }

  async clear(boxId: string): Promise<void> {
    await this.http.post(`/boxes/${boxId}/clear`);
  }
}
