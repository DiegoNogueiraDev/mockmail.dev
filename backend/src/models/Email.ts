import mongoose, { Schema, Document } from "mongoose";

export interface IEmail extends Document {
  from: string;
  to: string;
  subject: string;
  body: {
    rawHtml: string; // HTML bruto, incluindo CSS, scripts, e metadados.
    plainText: string; // Texto limpo extraído do HTML.
    metadata: {
      links: string[]; // Links extraídos do HTML.
      images: string[]; // URLs de imagens extraídas.
    };
  };
  date: Date;
  token: string;
  messageId: string; // Message-ID do email (RFC 2822) - usado para deduplicação
  contentType: string;
  processedAt: Date;
  emailBox: mongoose.Types.ObjectId;
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

    emailBox: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailBox",
      required: true,
    },
  },
  { timestamps: true }
);

// Índice único sparse no messageId para deduplicação
// sparse: ignora documentos onde messageId é null/undefined
EmailSchema.index({ messageId: 1 }, { unique: true, sparse: true });

// Índice para busca de emails por caixa
EmailSchema.index({ to: 1, date: -1 });

// Índice para ordenação por data de criação (dashboard, admin, listagens)
EmailSchema.index({ createdAt: -1 });

export default mongoose.model<IEmail>("Email", EmailSchema);
