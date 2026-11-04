import mongoose, { Types } from "mongoose";
import { User } from "../models/User";
import { WalletTransaction } from "../models/WalletTransaction";
import { badRequest, conflict } from "../utils/errors";

const localLocks = new Map<string, Promise<void>>();

async function withLocalLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = localLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const chain = previous.then(() => current);
  localLocks.set(key, chain);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (localLocks.get(key) === chain) localLocks.delete(key);
  }
}

export async function transferForSession(input: {
  from: Types.ObjectId;
  to: Types.ObjectId;
  amount: number;
  sessionId: Types.ObjectId;
  idempotencyKey: string;
}): Promise<void> {
  if (input.amount <= 0) return;
  if (!Number.isSafeInteger(input.amount)) throw badRequest("Wallet transfers use whole credits");
  const { from, to, amount, sessionId, idempotencyKey } = input;
  const existing = await WalletTransaction.findOne({ idempotencyKey, direction: "debit" });
  if (existing) return;

  const dbSession = await mongoose.startSession();
  try {
    try {
      await dbSession.withTransaction(async () => {
        const duplicate = await WalletTransaction.findOne({ idempotencyKey, direction: "debit" }).session(dbSession);
        if (duplicate) return;
        const payer = await User.findOneAndUpdate(
          { _id: from, walletBalance: { $gte: amount }, isActive: true },
          { $inc: { walletBalance: -amount } },
          { new: true, session: dbSession },
        );
        if (!payer) throw conflict("Insufficient wallet balance");
        const recipient = await User.findOneAndUpdate(
          { _id: to, isActive: true },
          { $inc: { walletBalance: amount } },
          { new: true, session: dbSession },
        );
        if (!recipient) throw conflict("Recipient account is unavailable");
        await WalletTransaction.create(
          [
            { user: from, counterparty: to, amount, direction: "debit", reason: "session_payment", idempotencyKey, session: sessionId, description: "Peer session payment" },
            { user: to, counterparty: from, amount, direction: "credit", reason: "session_payment", idempotencyKey, session: sessionId, description: "Peer session payment" },
          ],
          { session: dbSession },
        );
      });
      return;
    } catch (error) {
      const mongoError = error as { code?: number; message?: string; hasErrorLabel?: (label: string) => boolean };
      const unsupported = mongoError.code === 20 || mongoError.message?.includes("replica set") || mongoError.message?.includes("Transaction numbers are only allowed");
      if (!unsupported) throw error;
    }
  } finally {
    await dbSession.endSession();
  }

  await withLocalLock(idempotencyKey, async () => {
    if (await WalletTransaction.exists({ idempotencyKey, direction: "debit" })) return;
    let debit;
    try {
      debit = await WalletTransaction.create({
        user: from, counterparty: to, amount, direction: "debit", reason: "session_payment",
        idempotencyKey, session: sessionId, description: "Peer session payment",
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return;
      throw error;
    }
    const payer = await User.updateOne({ _id: from, walletBalance: { $gte: amount }, isActive: true }, { $inc: { walletBalance: -amount } });
    if (!payer.modifiedCount) {
      await debit.deleteOne();
      throw conflict("Insufficient wallet balance");
    }
    const recipient = await User.updateOne({ _id: to, isActive: true }, { $inc: { walletBalance: amount } });
    if (!recipient.modifiedCount) {
      await User.updateOne({ _id: from }, { $inc: { walletBalance: amount } });
      await debit.deleteOne();
      throw conflict("Recipient account is unavailable");
    }
    try {
      await WalletTransaction.create({
        user: to, counterparty: from, amount, direction: "credit", reason: "session_payment",
        idempotencyKey, session: sessionId, description: "Peer session payment",
      });
    } catch (error) {
      await User.updateOne({ _id: to }, { $inc: { walletBalance: -amount } });
      await User.updateOne({ _id: from }, { $inc: { walletBalance: amount } });
      await debit.deleteOne();
      throw error;
    }
  });
}
