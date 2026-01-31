import mongoose, { Schema, Document } from "mongoose";
import { WebhookEvent } from "./Webhook";

export interface IWebhookDelivery extends Document {
  webhookId: mongoose.Types.ObjectId;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  responseCode?: number;
  responseBody?: string;
  duration?: number;
  success: boolean;
  attempts: number;
  error?: string;
  createdAt: Date;
}

const WebhookDeliverySchema = new Schema(
  {
    webhookId: {
      type: Schema.Types.ObjectId,
      ref: "Webhook",
      required: true,
      index: true,
    },
    event: {
      type: String,
      enum: Object.values(WebhookEvent),
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    responseCode: {
      type: Number,
    },
    responseBody: {
      type: String,
      maxlength: 10000, // Limit response body storage
    },
    duration: {
      type: Number, // Response time in ms
    },
    success: {
      type: Boolean,
      default: false,
      index: true,
    },
    attempts: {
      type: Number,
      default: 1,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for querying recent deliveries
WebhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ createdAt: -1 });

// Auto-delete old deliveries after 30 days
WebhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model<IWebhookDelivery>("WebhookDelivery", WebhookDeliverySchema);
