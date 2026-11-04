import { Document, Model, Schema, model, models, Types } from "mongoose";

export interface IExchangeRequest extends Document {
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  skill: Types.ObjectId;
  message: string;
  paymentAmount: number;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const exchangeRequestSchema = new Schema<IExchangeRequest>(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: "Skill", required: true },
    message: { type: String, maxlength: 1000, default: "" },
    paymentAmount: { type: Number, min: 0, max: 100000, default: 0, validate: Number.isSafeInteger },
    status: { type: String, enum: ["pending", "accepted", "rejected", "cancelled", "completed"], default: "pending", index: true },
  },
  { timestamps: true },
);

exchangeRequestSchema.index({ requester: 1, skill: 1, status: 1 });
export const ExchangeRequest: Model<IExchangeRequest> =
  (models.ExchangeRequest as Model<IExchangeRequest>) ||
  model<IExchangeRequest>("ExchangeRequest", exchangeRequestSchema);
