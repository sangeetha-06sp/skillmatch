import { Document, Model, Schema, model, models, Types } from "mongoose";

export interface ISession extends Document {
  request: Types.ObjectId;
  participants: Types.ObjectId[];
  scheduledAt: Date;
  durationMinutes: number;
  mode: "online" | "in-person";
  meetingUrl?: string;
  notes: string;
  status: "scheduled" | "in_progress" | "completed" | "disputed" | "cancelled";
  confirmations: { user: Types.ObjectId; confirmedAt: Date }[];
  paymentAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    request: { type: Schema.Types.ObjectId, ref: "ExchangeRequest", required: true, unique: true },
    participants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], required: true, validate: [(v: unknown[]) => v.length === 2, "A session has exactly two participants"] },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    mode: { type: String, enum: ["online", "in-person"], default: "online" },
    meetingUrl: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 2000, default: "" },
    status: { type: String, enum: ["scheduled", "in_progress", "completed", "disputed", "cancelled"], default: "scheduled", index: true },
    confirmations: [{ user: { type: Schema.Types.ObjectId, ref: "User", required: true }, confirmedAt: { type: Date, required: true } }],
    paymentAmount: { type: Number, min: 0, default: 0, validate: Number.isSafeInteger },
  },
  { timestamps: true },
);

export const Session: Model<ISession> = (models.Session as Model<ISession>) || model<ISession>("Session", sessionSchema);
