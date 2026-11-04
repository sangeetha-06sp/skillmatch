import { Document, Model, Schema, model, models, Types } from "mongoose";

export interface ISkill extends Document {
  owner: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  tags: string[];
  level: "beginner" | "intermediate" | "advanced" | "expert";
  type: "offer" | "request";
  mode: "online" | "in-person" | "either";
  location: string;
  availability: "Flexible" | "Weekday evenings" | "Weekends";
  credits: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<ISkill>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    level: { type: String, enum: ["beginner", "intermediate", "advanced", "expert"], default: "intermediate" },
    type: { type: String, enum: ["offer", "request"], default: "offer", index: true },
    mode: { type: String, enum: ["online", "in-person", "either"], default: "either" },
    location: { type: String, maxlength: 120, default: "" },
    availability: { type: String, enum: ["Flexible", "Weekday evenings", "Weekends"], default: "Flexible" },
    credits: { type: Number, min: 1, max: 100, default: 2, validate: Number.isSafeInteger },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

skillSchema.index({ title: "text", description: "text", category: "text", tags: "text" });
export const Skill: Model<ISkill> = (models.Skill as Model<ISkill>) || model<ISkill>("Skill", skillSchema);
