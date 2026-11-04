import { Router } from "express";
import { z } from "zod";
import { Waitlist } from "../models/Waitlist";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { conflict } from "../utils/errors";

const router = Router();

router.post("/", validateBody(z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(80).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
})), asyncHandler(async (req, res) => {
  const email = (req.body.email as string).toLowerCase();
  if (await Waitlist.exists({ email })) throw conflict("This email is already on the waitlist");
  const entry = await Waitlist.create({ ...req.body, email });
  res.status(201).json({ message: "You have joined the SkillBridge waitlist", entry: { id: entry.id, status: entry.status } });
}));

export default router;
