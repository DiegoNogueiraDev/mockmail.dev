import mongoose, { Schema, Document } from "mongoose";

export interface IEmail extends Document {
  from: string;
  to: string;
  subject: string;
  body: {
    rawHtml: string;
    plainText: string;
    metadata: {
      links: string[];
      images: string[];
    };
  };
  date: Date;
  token: string;
  messageId: string;
  contentType: string;
  processedAt: Date;
  emailBox: mongoose.Types.ObjectId;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content?: Buffer;
  }>;
  readAt?: Date;
  // Tracking fields
  openedAt?: Date;
  openCount: number;
  clickCount: number;
  clicks: Array<{
    url: string;
    clickedAt: Date;
  }>;
  headers?: Record<string, string>;
  // Threading fields
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
}

const EmailSchema: Schema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    body: {
      rawHtml: { type: String, required: true },
      plainText: { type: String, required: true },
      metadata: {
        links: { type: [String], default: [] },
        images: { type: [String], default: [] },
      },
    },
    date: { type: Date, required: true },
    token: { type: String },
    messageId: { type: String },
    contentType: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },

    attachments: [{
      filename: { type: String },
      contentType: { type: String },
      size: { type: Number },
      content: { type: Buffer },
    }],

    emailBox: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailBox",
      required: true,
    },

    readAt: { type: Date, default: null },

    // Tracking fields
    openedAt: { type: Date, default: null },
    openCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    clicks: [{
      url: { type: String },
      clickedAt: { type: Date },
    }],

    // SMTP headers
    headers: { type: Map, of: String },

    // Threading fields
    inReplyTo: { type: String },
    references: [{ type: String }],
    threadId: { type: String, index: true },
  },
  { timestamps: true }
);;;;;;;

// Índice único sparse no messageId para deduplicação
// sparse: ignora documentos onde messageId é null/undefined
EmailSchema.index({ messageId: 1 }, { unique: true, sparse: true });

// Índice para busca de emails por caixa
EmailSchema.index({ to: 1, date: -1 });

// Índice para ordenação por data de criação (dashboard, admin, listagens)
EmailSchema.index({ createdAt: -1 });

export default mongoose.model<IEmail>("Email", EmailSchema);
