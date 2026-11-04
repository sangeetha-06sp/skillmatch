import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/database";
import { validateBody } from "../middleware/validate";
import { apiRow, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/", validateBody(z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(80).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
})), asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("waitlists").insert({
    email: (req.body.email as string).toLowerCase(),
    name: req.body.name ?? "",
    interests: req.body.interests ?? [],
  }).select("*").single();
  if (error) throwDatabaseError(error);
  const entry = apiRow(data as DbRow);
  res.status(201).json({ message: "You have joined the SkillBridge waitlist", entry: { id: entry.id, status: entry.status } });
}));

export default router;
