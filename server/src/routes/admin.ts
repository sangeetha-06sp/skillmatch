import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/database";
import { authenticate, requireAuth, requireAdmin } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { notify } from "../services/notifications";
import { apiRow, apiUser, fetchUsers, fetchWalletBalance, safeUser, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, notFound } from "../utils/errors";
import { pageInfo, paginationFrom } from "../utils/pagination";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/stats", asyncHandler(async (_req, res) => {
  const { data, error } = await supabase.rpc("admin_platform_stats");
  if (error) throwDatabaseError(error);
  res.json({ stats: data });
}));

router.get("/users", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  let query = supabase.from("users").select("*", { count: "exact" });
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    const term = req.query.q.trim().slice(0, 100).replace(/[,%()]/g, "");
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  const rows = (data ?? []) as DbRow[];
  const { data: wallets, error: walletsError } = await supabase.from("wallets").select("user_id,balance").in("user_id", rows.map((row) => row.id));
  if (walletsError) throwDatabaseError(walletsError);
  const balances = new Map((wallets ?? []).map((wallet) => [wallet.user_id, wallet.balance]));
  if (rows.some((row) => !balances.has(row.id))) throw new Error("A wallet record is missing for a platform user");
  res.json({
    users: rows.map((row) => safeUser(apiUser(row, Number(balances.get(row.id) ?? 0)))),
    pagination: pageInfo(count ?? 0, page, limit),
  });
}));

router.patch("/users/:id/status", validateBody(z.object({ isActive: z.boolean() })), asyncHandler(async (req, res) => {
  const currentUser = requireAuth(req);
  if (req.params.id === currentUser.id && req.body.isActive === false) throw badRequest("You cannot deactivate your own account");
  const { data: existing, error: existingError } = await supabase.from("users").select("id,token_version").eq("id", req.params.id).maybeSingle();
  if (existingError) throwDatabaseError(existingError);
  if (!existing) throw notFound("User not found");
  const { data, error } = await supabase.from("users").update({
    is_active: req.body.isActive,
    token_version: req.body.isActive ? existing.token_version : existing.token_version + 1,
  }).eq("id", req.params.id).select("*").single();
  if (error) throwDatabaseError(error);
  res.json({ user: safeUser(apiUser(data as DbRow, await fetchWalletBalance(data.id))) });
}));

router.get("/disputes", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  let query = supabase.from("disputes").select("*", { count: "exact" });
  if (typeof req.query.status === "string" && ["open", "under_review", "resolved", "dismissed"].includes(req.query.status)) {
    query = query.eq("status", req.query.status);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  const rows = (data ?? []) as DbRow[];
  const sessionIds = rows.map((row) => String(row.session_id));
  const { data: sessions, error: sessionsError } = sessionIds.length
    ? await supabase.from("sessions").select("id,participants,scheduled_at,status").in("id", sessionIds)
    : { data: [], error: null };
  if (sessionsError) throwDatabaseError(sessionsError);
  const sessionMap = new Map(((sessions ?? []) as DbRow[]).map((session) => [session.id, session]));
  const userIds = rows.flatMap((row) => [String(row.opened_by), ...(typeof row.resolved_by === "string" ? [row.resolved_by] : [])]);
  const users = await fetchUsers(userIds);
  res.json({
    disputes: rows.map((row) => {
      const session = sessionMap.get(String(row.session_id));
      const reporter = users.get(String(row.opened_by));
      return {
        ...apiRow(row),
        session: session ? { _id: session.id, participants: session.participants, scheduledAt: session.scheduled_at, status: session.status } : null,
        openedBy: reporter ? { _id: reporter.id, name: reporter.name, email: reporter.email } : row.opened_by,
      };
    }),
    pagination: pageInfo(count ?? 0, page, limit),
  });
}));

router.patch("/disputes/:id", validateBody(z.object({
  status: z.enum(["under_review", "resolved", "dismissed"]),
  resolution: z.string().trim().min(3).max(2000).optional(),
})), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data: current, error: currentError } = await supabase.from("disputes").select("*").eq("id", req.params.id).maybeSingle();
  if (currentError) throwDatabaseError(currentError);
  if (!current) throw notFound("Dispute not found");
  if (["resolved", "dismissed"].includes(current.status)) throw badRequest("This dispute has already been closed");
  if (req.body.status !== "under_review" && !req.body.resolution) throw badRequest("A resolution note is required to close a dispute");
  const closes = req.body.status !== "under_review";
  const { data, error } = await supabase.from("disputes").update({
    status: req.body.status,
    resolution: req.body.resolution ?? null,
    resolved_by: closes ? user.id : null,
    resolved_at: closes ? new Date().toISOString() : null,
  }).eq("id", req.params.id).in("status", ["open", "under_review"]).select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw badRequest("Dispute state changed; please retry");
  if (closes) {
    const { error: sessionError } = await supabase.from("sessions").update({ status: "in_progress" })
      .eq("id", data.session_id).eq("status", "disputed");
    if (sessionError) throwDatabaseError(sessionError);
  }
  const { data: session, error: sessionError } = await supabase.from("sessions").select("participants").eq("id", data.session_id).maybeSingle();
  if (sessionError) throwDatabaseError(sessionError);
  for (const participant of (session?.participants ?? []) as string[]) {
    await notify(participant, "dispute_updated", "Dispute updated", `An administrator updated your dispute: ${data.status}.`, `/disputes/${data.id}`);
  }
  res.json({ dispute: apiRow(data as DbRow) });
}));

router.get("/waitlist", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  let query = supabase.from("waitlists").select("*", { count: "exact" });
  if (typeof req.query.status === "string" && ["pending", "invited", "joined"].includes(req.query.status)) query = query.eq("status", req.query.status);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  res.json({ entries: ((data ?? []) as DbRow[]).map((entry) => apiRow(entry)), pagination: pageInfo(count ?? 0, page, limit) });
}));

router.patch("/waitlist/:id", validateBody(z.object({ status: z.enum(["pending", "invited", "joined"]) })), asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("waitlists").update({ status: req.body.status }).eq("id", req.params.id).select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw notFound("Waitlist entry not found");
  res.json({ entry: apiRow(data as DbRow) });
}));

router.get("/wallet-transactions", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  const { data, error, count } = await supabase.from("wallet_transactions").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  const rows = (data ?? []) as DbRow[];
  const users = await fetchUsers(rows.flatMap((row) => [String(row.user_id), ...(typeof row.counterparty_id === "string" ? [row.counterparty_id] : [])]));
  res.json({
    transactions: rows.map((row) => ({
      ...apiRow(row),
      user: users.get(String(row.user_id)) ? { _id: row.user_id, name: users.get(String(row.user_id))?.name, email: users.get(String(row.user_id))?.email } : row.user_id,
      counterparty: users.get(String(row.counterparty_id)) ? { _id: row.counterparty_id, name: users.get(String(row.counterparty_id))?.name, email: users.get(String(row.counterparty_id))?.email } : row.counterparty_id,
    })),
    pagination: pageInfo(count ?? 0, page, limit),
  });
}));

export default router;
