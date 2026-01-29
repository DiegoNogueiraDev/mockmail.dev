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
    token: { type: String, optional: true },
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

export default mongoose.model<IEmail>("Email", EmailSchema);
