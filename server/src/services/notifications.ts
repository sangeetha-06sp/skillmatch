import { Types } from "mongoose";
import { Notification } from "../models/Notification";

export async function notify(user: Types.ObjectId | string, type: string, title: string, message: string, link?: string) {
  return Notification.create({ user, type, title, message, link });
}
