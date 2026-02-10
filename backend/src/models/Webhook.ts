import mongoose, { Schema, Document } from "mongoose";

// Webhook events that can trigger notifications
export enum WebhookEvent {
  EMAIL_RECEIVED = "email_received",
  EMAIL_OPENED = "email_opened",
  EMAIL_CLICKED = "email_clicked",
  BOX_CREATED = "box_created",
  BOX_DELETED = "box_deleted",
}

// Webhook status
export enum WebhookStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  FAILED = "failed",
}

export interface IWebhook extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  headers?: Record<string, string>;
  retryCount: number;
  lastError?: string;
  lastTriggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v: string) => {
          try {
            const url = new URL(v);
            if (url.protocol !== "https:" && url.protocol !== "http:") return false;
            // Require HTTPS in production
            if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return false;
            const hostname = url.hostname.toLowerCase();
            // Bloquear IPs privados, localhost e cloud metadata
            const blocked = [
              /^localhost$/,
              /^127\./,
              /^10\./,
              /^172\.(1[6-9]|2\d|3[01])\./,
              /^192\.168\./,
              /^169\.254\./,
              /^0\./,
              /^\[::1\]$/,
              /^fc00:/,
              /^fe80:/,
              /^\[?::ffff:(?:127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/,
              /^\[?::ffff:(7f|0a|ac1[0-9a-f]|c0a8|a9fe)/,
              /^0000:/,
              /^\[?0+:0+:0+:0+:0+:(0+|ffff):/,
            ];
            return !blocked.some(pattern => pattern.test(hostname));
          } catch {
            return false;
          }
        },
        message: "URL inválida ou aponta para endereço interno bloqueado",
      },
    },
    secret: {
      type: String,
      required: true,
    },
    events: {
      type: [String],
      enum: Object.values(WebhookEvent),
      default: [WebhookEvent.EMAIL_RECEIVED],
    },
    status: {
      type: String,
      enum: Object.values(WebhookStatus),
      default: WebhookStatus.ACTIVE,
      index: true,
    },
    headers: {
      type: Schema.Types.Mixed,
      default: {},
    },
    retryCount: {
      type: Number,
      default: 3,
      min: 0,
      max: 10,
    },
    lastError: {
      type: String,
    },
    lastTriggeredAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound index for efficient user queries
WebhookSchema.index({ userId: 1, status: 1 });

export default mongoose.model<IWebhook>("Webhook", WebhookSchema);
