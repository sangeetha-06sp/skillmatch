import { Router } from "express";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { apiRow, fetchUsers, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";
import { forbidden, notFound } from "../utils/errors";
import { pageInfo, paginationFrom } from "../utils/pagination";

const router = Router();

async function populatedDispute(row: DbRow) {
  const [sessionResult, users] = await Promise.all([
    supabase.from("sessions").select("id,participants,scheduled_at,status").eq("id", row.session_id).maybeSingle(),
    fetchUsers([String(row.opened_by), ...(typeof row.resolved_by === "string" ? [row.resolved_by] : [])]),
  ]);
  if (sessionResult.error) throwDatabaseError(sessionResult.error);
  const session = sessionResult.data as DbRow | null;
  const participants = Array.isArray(session?.participants) ? session.participants as string[] : [];
  return {
    ...apiRow(row),
    session: session ? {
      _id: session.id,
      participants,
      scheduledAt: session.scheduled_at,
      status: session.status,
    } : null,
    openedBy: users.get(String(row.opened_by)) ? { _id: row.opened_by, name: users.get(String(row.opened_by))?.name } : row.opened_by,
    resolvedBy: row.resolved_by ? users.get(String(row.resolved_by))?.name : undefined,
  };
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  let query = supabase.from("disputes").select("*", { count: "exact" });
  if (user.role !== "admin") query = query.eq("opened_by", user.id);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  res.json({ disputes: await Promise.all(((data ?? []) as DbRow[]).map(populatedDispute)), pagination: pageInfo(count ?? 0, page, limit) });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("disputes").select("*").eq("id", req.params.id).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw notFound("Dispute not found");
  const dispute = await populatedDispute(data as DbRow);
  const user = requireAuth(req);
  const participants = (dispute.session as { participants?: string[] } | null)?.participants ?? [];
  if (user.role !== "admin" && !participants.includes(user.id)) throw forbidden();
  res.json({ dispute });
}));

export default router;
