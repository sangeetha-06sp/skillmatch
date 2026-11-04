import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { apiSkill, fetchUsers, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";
import { forbidden, notFound } from "../utils/errors";
import { pageInfo, paginationFrom } from "../utils/pagination";

const router = Router();
const skillSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(80),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  type: z.enum(["offer", "request"]).optional(),
  mode: z.enum(["online", "in-person", "either"]).optional(),
  location: z.string().trim().max(120).optional(),
  availability: z.enum(["Flexible", "Weekday evenings", "Weekends"]).optional(),
  credits: z.number().int().min(1).max(100).optional(),
});
const fields = {
  title: "title", description: "description", category: "category", tags: "tags", level: "level",
  type: "type", mode: "mode", location: "location", availability: "availability", credits: "credits",
};

router.get("/", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  let query = supabase.from("skills").select("*", { count: "exact" }).eq("active", true);
  if (typeof req.query.category === "string" && req.query.category.trim()) query = query.ilike("category", req.query.category.trim());
  if (["offer", "request"].includes(String(req.query.type))) query = query.eq("type", String(req.query.type));
  if (["online", "in-person", "either"].includes(String(req.query.mode))) query = query.eq("mode", String(req.query.mode));
  if (["beginner", "intermediate", "advanced", "expert"].includes(String(req.query.level))) query = query.eq("level", String(req.query.level));
  if (["Flexible", "Weekday evenings", "Weekends"].includes(String(req.query.availability))) query = query.eq("availability", String(req.query.availability));
  const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (search) query = query.textSearch("search_document", search, { type: "websearch", config: "simple" });
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  const skills = (data ?? []) as DbRow[];
  const owners = await fetchUsers(skills.map((skill) => String(skill.owner_id)));
  res.json({ skills: skills.map((skill) => apiSkill(skill, owners.get(String(skill.owner_id)))), pagination: pageInfo(count ?? 0, page, limit) });
}));

router.get("/mine", authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("skills").select("*").eq("owner_id", requireAuth(req).id).order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  res.json({ skills: (data ?? []).map((skill) => apiSkill(skill as DbRow)) });
}));

router.post("/", authenticate, validateBody(skillSchema), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const body = req.body as z.infer<typeof skillSchema>;
  const { data, error } = await supabase.from("skills").insert({
    owner_id: user.id,
    title: body.title,
    description: body.description,
    category: body.category,
    tags: body.tags?.map((tag) => tag.toLowerCase()) ?? [],
    level: body.level ?? "intermediate",
    type: body.type ?? "offer",
    mode: body.mode ?? "either",
    location: body.location ?? user.location,
    availability: body.availability ?? "Flexible",
    credits: body.credits ?? 2,
  }).select("*").single();
  if (error) throwDatabaseError(error);
  res.status(201).json({ skill: apiSkill(data as DbRow, user as unknown as DbRow) });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("skills").select("*").eq("id", req.params.id).eq("active", true).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw notFound("Skill listing not found");
  const owners = await fetchUsers([String(data.owner_id)]);
  res.json({ skill: apiSkill(data as DbRow, owners.get(String(data.owner_id))) });
}));

router.patch("/:id", authenticate, validateBody(skillSchema.partial().strict()), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data: existing, error: existingError } = await supabase.from("skills").select("*").eq("id", req.params.id).maybeSingle();
  if (existingError) throwDatabaseError(existingError);
  if (!existing) throw notFound("Skill listing not found");
  if (existing.owner_id !== user.id && user.role !== "admin") throw forbidden();
  const update = Object.fromEntries(Object.entries(req.body).map(([field, value]) => [
    fields[field as keyof typeof fields],
    field === "tags" && Array.isArray(value) ? value.map((tag: string) => tag.toLowerCase()) : value,
  ]));
  const { data, error } = await supabase.from("skills").update(update).eq("id", req.params.id).select("*").single();
  if (error) throwDatabaseError(error);
  res.json({ skill: apiSkill(data as DbRow) });
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data: existing, error: existingError } = await supabase.from("skills").select("id, owner_id").eq("id", req.params.id).maybeSingle();
  if (existingError) throwDatabaseError(existingError);
  if (!existing) throw notFound("Skill listing not found");
  if (existing.owner_id !== user.id && user.role !== "admin") throw forbidden();
  const { error } = await supabase.from("skills").update({ active: false }).eq("id", req.params.id);
  if (error) throwDatabaseError(error);
  res.json({ message: "Skill listing deactivated" });
}));

export default router;
