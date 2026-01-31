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
            return url.protocol === "https:" || url.protocol === "http:";
          } catch {
            return false;
          }
        },
        message: "URL inválida",
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
