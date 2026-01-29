import mongoose, { Schema, Document } from "mongoose";

export interface IEmailBox extends Document {
  address: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailBoxSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IEmailBox>("EmailBox", EmailBoxSchema);
