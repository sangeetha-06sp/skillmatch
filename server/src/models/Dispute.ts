import { Document, Model, Schema, model, models, Types } from "mongoose";

export interface IDispute extends Document {
  session: Types.ObjectId;
  openedBy: Types.ObjectId;
  reason: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  resolution?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const disputeSchema = new Schema<IDispute>(
  {
    session: { type: Schema.Types.ObjectId, ref: "Session", required: true, unique: true },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["open", "under_review", "resolved", "dismissed"], default: "open", index: true },
    resolution: { type: String, maxlength: 2000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Dispute: Model<IDispute> = (models.Dispute as Model<IDispute>) || model<IDispute>("Dispute", disputeSchema);
