import { Document, Model, Schema, model, models, Types } from "mongoose";

export interface IWalletTransaction extends Document {
  user: Types.ObjectId;
  counterparty?: Types.ObjectId;
  amount: number;
  direction: "credit" | "debit";
  reason: "session_payment" | "seed" | "admin_adjustment" | "refund";
  idempotencyKey: string;
  session?: Types.ObjectId;
  description: string;
  createdAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    counterparty: { type: Schema.Types.ObjectId, ref: "User" },
    amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    reason: { type: String, enum: ["session_payment", "seed", "admin_adjustment", "refund"], required: true },
    idempotencyKey: { type: String, required: true },
    session: { type: Schema.Types.ObjectId, ref: "Session" },
    description: { type: String, maxlength: 200, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

walletTransactionSchema.index({ idempotencyKey: 1, direction: 1 }, { unique: true });
export const WalletTransaction: Model<IWalletTransaction> =
  (models.WalletTransaction as Model<IWalletTransaction>) ||
  model<IWalletTransaction>("WalletTransaction", walletTransactionSchema);
