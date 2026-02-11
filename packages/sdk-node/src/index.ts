import { HttpClient, MockMailError } from './client';
import { Boxes } from './resources/boxes';
import { Emails } from './resources/emails';
import { Webhooks } from './resources/webhooks';
import { MockMailConfig } from './types';

export class MockMail {
  public boxes: Boxes;
  public emails: Emails;
  public webhooks: Webhooks;

  constructor(config: MockMailConfig) {
    if (!config.apiKey) {
      throw new Error('MockMail: apiKey is required');
    }
    const http = new HttpClient(config);
    this.boxes = new Boxes(http);
    this.emails = new Emails(http);
    this.webhooks = new Webhooks(http);
  }
}

export { MockMailError } from './client';
export type {
  MockMailConfig,
  EmailBox,
  Email,
  Webhook,
  PaginatedResponse,
  SingleResponse,
  WaitForOptions,
} from './types';
