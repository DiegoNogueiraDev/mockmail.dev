import { HttpClient } from '../client';
import { Email, PaginatedResponse, SingleResponse, WaitForOptions } from '../types';

export class Emails {
  constructor(private http: HttpClient) {}

  async list(options?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<Email>> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.search) params.set('search', options.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<PaginatedResponse<Email>>(`/mail/emails${qs}`);
  }

  async get(emailId: string): Promise<Email> {
    const res = await this.http.get<SingleResponse<Email>>(`/mail/emails/${emailId}`);
    return res.data;
  }

  async latest(boxAddress: string): Promise<Email> {
    const res = await this.http.get<SingleResponse<Email>>(`/mail/latest/${encodeURIComponent(boxAddress)}`);
    return res.data;
  }

  async latestBySubject(boxAddress: string, subject: string): Promise<Email> {
    const res = await this.http.get<SingleResponse<Email>>(
      `/mail/latest/${encodeURIComponent(boxAddress)}/subject/${encodeURIComponent(subject)}`
    );
    return res.data;
  }

  async delete(emailId: string): Promise<void> {
    await this.http.delete(`/mail/emails/${emailId}`);
  }

  async forward(emailId: string, forwardTo: string): Promise<void> {
    await this.http.post(`/mail/emails/${emailId}/forward`, { forwardTo });
  }

  async toggleRead(emailId: string): Promise<{ read: boolean }> {
    const res = await this.http.patch<SingleResponse<{ read: boolean }>>(`/mail/emails/${emailId}/read`);
    return res.data;
  }

  /**
   * Poll for an email matching criteria. Returns the first match.
   */
  async waitFor(boxAddress: string, options?: WaitForOptions): Promise<Email> {
    const timeout = options?.timeout || 30000;
    const interval = options?.interval || 2000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const email = await this.latest(boxAddress);
        if (!email) {
          await sleep(interval);
          continue;
        }

        if (options?.subject) {
          const subjectMatch = options.subject instanceof RegExp
            ? options.subject.test(email.subject)
            : email.subject.includes(options.subject);
          if (!subjectMatch) {
            await sleep(interval);
            continue;
          }
        }

        if (options?.from && !email.from.includes(options.from)) {
          await sleep(interval);
          continue;
        }

        return email;
      } catch {
        await sleep(interval);
      }
    }

    throw new Error(`Timeout waiting for email at ${boxAddress} after ${timeout}ms`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
