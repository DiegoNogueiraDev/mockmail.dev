export interface MockMailConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface EmailBox {
  id: string;
  address: string;
  emailCount: number;
  isCustom: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: {
    rawHtml: string;
    plainText: string;
    metadata: { links: string[]; images: string[] };
  };
  date: string;
  contentType: string;
  processedAt: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
  headers?: Record<string, string>;
  readAt?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface WaitForOptions {
  subject?: string | RegExp;
  from?: string;
  timeout?: number;
  interval?: number;
}
