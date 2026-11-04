import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { apiRow, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";
import { notFound } from "../utils/errors";
import { pageInfo, paginationFrom } from "../utils/pagination";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  let listQuery = supabase.from("notifications").select("*", { count: "exact" }).eq("user_id", user.id);
  if (req.query.unread === "true") listQuery = listQuery.is("read_at", null);
  const [list, unread] = await Promise.all([
    listQuery.order("created_at", { ascending: false }).range(skip, skip + limit - 1),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);
  if (list.error) throwDatabaseError(list.error);
  if (unread.error) throwDatabaseError(unread.error);
  res.json({
    notifications: ((list.data ?? []) as DbRow[]).map((notification) => apiRow(notification)),
    unreadCount: unread.count ?? 0,
    pagination: pageInfo(list.count ?? 0, page, limit),
  });
}));

router.patch("/:id/read", authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("id", req.params.id).eq("user_id", requireAuth(req).id).select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw notFound("Notification not found");
  res.json({ notification: apiRow(data as DbRow) });
}));

router.post("/read-all", authenticate, validateBody(z.object({}).strict()), asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", requireAuth(req).id).is("read_at", null).select("id");
  if (error) throwDatabaseError(error);
  res.json({ updated: data?.length ?? 0 });
}));

export default router;
