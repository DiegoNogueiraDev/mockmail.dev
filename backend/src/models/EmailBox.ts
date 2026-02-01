import mongoose, { Schema, Document } from "mongoose";

export interface IEmailBox extends Document {
  address: string;
  userId: string;
  isCustom: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmailBoxSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
      unique: true, // Garantir unicidade global do endereço
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isCustom: {
      type: Boolean,
      default: false, // false = randômica, true = personalizada
    },
    expiresAt: {
      type: Date,
      required: true,
      // índice TTL definido abaixo com expireAfterSeconds
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
    },
  },
  { timestamps: true }
);

// Índice TTL para expiração automática das caixas após 24 horas
// O MongoDB irá deletar automaticamente documentos quando expiresAt < now
EmailBoxSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IEmailBox>("EmailBox", EmailBoxSchema);
