import mongoose, { Schema, Document } from "mongoose";

/**
 * EmailHistory - Armazena histórico completo de caixas expiradas
 *
 * Quando uma caixa expira, seus emails são movidos para este documento
 * preservando todo o histórico para auditoria e análise pelo admin.
 */

export interface IArchivedEmail {
  originalId: mongoose.Types.ObjectId;
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
  token?: string;
  contentType: string;
  processedAt: Date;
  originalCreatedAt: Date;
}

export interface IDeletionInfo {
  deletedBy: mongoose.Types.ObjectId;
  deletedByEmail: string;
  deletedByName: string;
  deletedByRole: string;
  deletedAt: Date;
  wasExpired: boolean;
}

export interface IEmailHistory extends Document {
  // Informações da caixa
  boxId: mongoose.Types.ObjectId;
  boxAddress: string;

  // Informações do usuário (dono da caixa)
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName: string;

  // Emails arquivados
  emails: IArchivedEmail[];
  emailCount: number;

  // Metadados
  archivedAt: Date;
  expirationReason: 'expired' | 'manual' | 'admin' | 'system';

  // Período da caixa
  boxCreatedAt: Date;
  boxExpiredAt: Date;

  // Estatísticas
  totalEmailsReceived: number;
  uniqueSenders: string[];

  // Informações de exclusão (quando deletado manualmente)
  deletionInfo?: IDeletionInfo;

  createdAt: Date;
  updatedAt: Date;
}

const ArchivedEmailSchema = new Schema({
  originalId: { type: Schema.Types.ObjectId, required: true },
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
  contentType: { type: String, required: true },
  processedAt: { type: Date, required: true },
  originalCreatedAt: { type: Date, required: true },
}, { _id: false });

const EmailHistorySchema = new Schema(
  {
    // Informações da caixa
    boxId: {
      type: Schema.Types.ObjectId,
      ref: "EmailBox",
      required: true,
      index: true,
    },
    boxAddress: { type: String, required: true, index: true },

    // Informações do usuário
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },

    // Emails arquivados
    emails: [ArchivedEmailSchema],
    emailCount: { type: Number, default: 0 },

    // Metadados
    archivedAt: { type: Date, default: Date.now, index: true },
    expirationReason: {
      type: String,
      enum: ['expired', 'manual', 'admin', 'system'],
      default: 'expired',
    },

    // Informações de exclusão manual
    deletionInfo: {
      deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
      deletedByEmail: { type: String },
      deletedByName: { type: String },
      deletedByRole: { type: String },
      deletedAt: { type: Date },
      wasExpired: { type: Boolean },
    },

    // Período da caixa
    boxCreatedAt: { type: Date, required: true },
    boxExpiredAt: { type: Date, required: true },

    // Estatísticas
    totalEmailsReceived: { type: Number, default: 0 },
    uniqueSenders: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Índices compostos para buscas eficientes
EmailHistorySchema.index({ userId: 1, archivedAt: -1 });
EmailHistorySchema.index({ boxAddress: 1, archivedAt: -1 });
EmailHistorySchema.index({ archivedAt: -1 }); // Para listagem geral do admin

export default mongoose.model<IEmailHistory>("EmailHistory", EmailHistorySchema);
