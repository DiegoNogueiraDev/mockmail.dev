import { MockMailConfig } from './types';

export class HttpClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: MockMailConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.mockmail.dev').replace(/\/$/, '');
  }

  async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };

    const options: RequestInit = { method, headers };
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new MockMailError(
        data.message || `HTTP ${response.status}`,
        response.status,
        data,
      );
    }

    return data;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  patch<T>(path: string, body?: any): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
}

export class MockMailError extends Error {
  statusCode: number;
  response: any;

  constructor(message: string, statusCode: number, response: any) {
    super(message);
    this.name = 'MockMailError';
    this.statusCode = statusCode;
    this.response = response;
  }
}
