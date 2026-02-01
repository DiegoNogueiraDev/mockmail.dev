import mongoose, { Schema, Document } from "mongoose";

// Permissions that can be assigned to API keys
export enum ApiKeyPermission {
  READ_EMAILS = "read_emails",
  WRITE_EMAILS = "write_emails",
  MANAGE_BOXES = "manage_boxes",
  WEBHOOKS = "webhooks",
}

export interface IApiKey extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  keyHash: string;
  keyPrefix: string; // First 8 chars for identification (e.g., "mm_live_")
  permissions: ApiKeyPermission[];
  scopes?: string[]; // Optional: specific box IDs
  rateLimit: number; // Requests per hour
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema(
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
    keyHash: {
      type: String,
      required: true,
      unique: true,
    },
    keyPrefix: {
      type: String,
      required: true,
      index: true,
    },
    permissions: {
      type: [String],
      enum: Object.values(ApiKeyPermission),
      default: [ApiKeyPermission.READ_EMAILS],
    },
    scopes: {
      type: [String],
      default: [],
    },
    rateLimit: {
      type: Number,
      default: 1000, // Requests per hour
      min: 10,
      max: 10000,
    },
    expiresAt: {
      type: Date,
    },
    lastUsedAt: {
      type: Date,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient lookups
ApiKeySchema.index({ userId: 1, isActive: 1 });

export default mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
