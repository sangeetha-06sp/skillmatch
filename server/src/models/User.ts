import { Document, Model, Schema, model, models, Types } from "mongoose";

export type UserRole = "user" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  bio: string;
  location: string;
  college: string;
  department: string;
  year: string;
  availability: string;
  interests: string[];
  skillsOfferedText: string[];
  skillsWantedText: string[];
  avatarUrl?: string;
  skillsOffered: Types.ObjectId[];
  skillsWanted: Types.ObjectId[];
  walletBalance: number;
  ratingAverage: number;
  ratingCount: number;
  tokenVersion: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    bio: { type: String, maxlength: 1000, default: "" },
    location: { type: String, maxlength: 120, default: "" },
    college: { type: String, trim: true, maxlength: 120, default: "" },
    department: { type: String, trim: true, maxlength: 120, default: "" },
    year: { type: String, trim: true, maxlength: 40, default: "" },
    availability: { type: String, enum: ["Flexible", "Weekday evenings", "Weekends"], default: "Flexible" },
    interests: [{ type: String, trim: true, maxlength: 80 }],
    skillsOfferedText: [{ type: String, trim: true, maxlength: 100 }],
    skillsWantedText: [{ type: String, trim: true, maxlength: 100 }],
    avatarUrl: { type: String, maxlength: 500 },
    skillsOffered: [{ type: Schema.Types.ObjectId, ref: "Skill" }],
    skillsWanted: [{ type: Schema.Types.ObjectId, ref: "Skill" }],
    walletBalance: { type: Number, min: 0, default: 0, validate: Number.isSafeInteger },
    ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    tokenVersion: { type: Number, min: 0, default: 0, select: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, toJSON: { transform: (_doc, ret) => { delete (ret as Record<string, unknown>).passwordHash; delete (ret as Record<string, unknown>).tokenVersion; return ret; } } },
);

userSchema.index({ name: "text", bio: "text", location: "text" });
export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", userSchema);
