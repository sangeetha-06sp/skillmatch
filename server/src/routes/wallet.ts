import { Router } from "express";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { apiRow, fetchUsers, fetchWalletBalance, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";
import { pageInfo, paginationFrom } from "../utils/pagination";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const { data, error, count } = await supabase.from("wallet_transactions").select("*", { count: "exact" })
    .eq("user_id", user.id).order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  const transactions = (data ?? []) as DbRow[];
  const users = await fetchUsers(transactions.map((transaction) => String(transaction.counterparty_id ?? "")).filter(Boolean));
  const sessions = new Map<string, DbRow>();
  const sessionIds = [...new Set(transactions.map((transaction) => transaction.session_id).filter((id): id is string => typeof id === "string"))];
  if (sessionIds.length) {
    const { data: sessionRows, error: sessionError } = await supabase.from("sessions").select("id,scheduled_at,status").in("id", sessionIds);
    if (sessionError) throwDatabaseError(sessionError);
    for (const session of (sessionRows ?? []) as DbRow[]) sessions.set(session.id, session);
  }
  const mapped = transactions.map((transaction) => {
    const counterparty = users.get(String(transaction.counterparty_id));
    const session = sessions.get(String(transaction.session_id));
    return {
      ...apiRow(transaction),
      counterparty: counterparty ? { _id: counterparty.id, name: counterparty.name } : null,
      session: session ? { ...apiRow(session) } : null,
    };
  });
  res.json({ balance: await fetchWalletBalance(user.id), transactions: mapped, pagination: pageInfo(count ?? 0, page, limit) });
}));

export default router;
