import { Document, Model, Schema, model, models } from "mongoose";

export interface IWaitlist extends Document {
  email: string;
  name: string;
  interests: string[];
  status: "pending" | "invited" | "joined";
  createdAt: Date;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    name: { type: String, trim: true, maxlength: 80, default: "" },
    interests: [{ type: String, trim: true, maxlength: 80 }],
    status: { type: String, enum: ["pending", "invited", "joined"], default: "pending" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Waitlist: Model<IWaitlist> = (models.Waitlist as Model<IWaitlist>) || model<IWaitlist>("Waitlist", waitlistSchema);
