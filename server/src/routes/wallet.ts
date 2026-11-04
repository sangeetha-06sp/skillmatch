import { Router } from "express";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { WalletTransaction } from "../models/WalletTransaction";
import { asyncHandler } from "../utils/asyncHandler";
import { paginationFrom, pageInfo } from "../utils/pagination";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const [transactions, total] = await Promise.all([
    WalletTransaction.find({ user: user._id }).populate("counterparty", "name").populate("session", "scheduledAt status").sort({ createdAt: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments({ user: user._id }),
  ]);
  res.json({ balance: user.walletBalance, transactions, pagination: pageInfo(total, page, limit) });
}));

export default router;
