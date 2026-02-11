import mongoose, { Schema, Document } from "mongoose";

export interface IForwardRule extends Document {
  userId: mongoose.Types.ObjectId;
  emailBoxId: mongoose.Types.ObjectId;
  forwardTo: string;
  active: boolean;
  filterFrom?: string;
  filterSubject?: string;
  forwardCount: number;
  lastForwardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ForwardRuleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emailBoxId: { type: Schema.Types.ObjectId, ref: "EmailBox", required: true },
    forwardTo: { type: String, required: true },
    active: { type: Boolean, default: true },
    filterFrom: { type: String },
    filterSubject: { type: String },
    forwardCount: { type: Number, default: 0 },
    lastForwardedAt: { type: Date },
  },
  { timestamps: true }
);

ForwardRuleSchema.index({ emailBoxId: 1, active: 1 });
ForwardRuleSchema.index({ userId: 1 });

export default mongoose.model<IForwardRule>("ForwardRule", ForwardRuleSchema);
