import { Document, Model, Schema, model, models, Types } from "mongoose";

export interface INotification extends Document {
  user: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, maxlength: 60 },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    link: { type: String, maxlength: 300 },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ user: 1, createdAt: -1 });
export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) || model<INotification>("Notification", notificationSchema);
