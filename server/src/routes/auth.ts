import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { apiSkill, apiUser, fetchWalletBalance, publicUser, safeUser, throwDatabaseError, type DbRow } from "../services/database";
import { comparePassword, hashPassword, signAccessToken } from "../utils/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { notFound, unauthorized } from "../utils/errors";

const router = Router();
const password = z.string().min(10).max(128).regex(/[a-z]/, "Must include a lowercase letter").regex(/[A-Z]/, "Must include an uppercase letter").regex(/[0-9]/, "Must include a number");
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password,
  location: z.string().trim().max(120).optional(),
  college: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  year: z.string().trim().max(40).optional(),
  availability: z.enum(["Flexible", "Weekday evenings", "Weekends"]).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  skillsOfferedText: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  skillsWantedText: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  bio: z.string().trim().max(1000).optional(),
});
const userFields = {
  name: "name", bio: "bio", location: "location", avatarUrl: "avatar_url", college: "college",
  department: "department", year: "year", availability: "availability", interests: "interests",
  skillsOfferedText: "skills_offered_text", skillsWantedText: "skills_wanted_text",
};

router.post("/register", validateBody(registerSchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof registerSchema>;
  const { data: row, error } = await supabase.from("users").insert({
    name: body.name,
    email: body.email.toLowerCase(),
    password_hash: await hashPassword(body.password),
    location: body.location ?? body.college ?? "",
    college: body.college ?? "",
    department: body.department ?? "",
    year: body.year ?? "",
    availability: body.availability ?? "Flexible",
    interests: body.interests ?? [],
    skills_offered_text: body.skillsOfferedText ?? [],
    skills_wanted_text: body.skillsWantedText ?? [],
    bio: body.bio ?? "",
  }).select("*").single();
  if (error) throwDatabaseError(error);
  const internalUser = apiUser(row as DbRow, await fetchWalletBalance(row.id));
  res.status(201).json({ user: safeUser(internalUser), token: signAccessToken(internalUser) });
}));

router.post("/login", validateBody(z.object({ email: z.string().email(), password: z.string().min(1).max(128) })), asyncHandler(async (req, res) => {
  const { email, password: rawPassword } = req.body as { email: string; password: string };
  const { data: row, error } = await supabase.from("users").select("*").eq("email", email.toLowerCase()).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!row || !row.is_active || !(await comparePassword(rawPassword, String(row.password_hash)))) {
    throw unauthorized("Email or password is incorrect");
  }
  const user = apiUser(row as DbRow, await fetchWalletBalance(row.id));
  res.json({ user: safeUser(user), token: signAccessToken(user) });
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  res.json({ user: safeUser({ ...user, walletBalance: await fetchWalletBalance(user.id) }) });
}));

router.patch("/me", authenticate, validateBody(z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(120).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  college: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  year: z.string().trim().max(40).optional(),
  availability: z.enum(["Flexible", "Weekday evenings", "Weekends"]).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  skillsOfferedText: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  skillsWantedText: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
}).strict()), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const update = Object.fromEntries(Object.entries(req.body).map(([field, value]) => [userFields[field as keyof typeof userFields], value]));
  const { data: row, error } = await supabase.from("users").update(update).eq("id", user.id).select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!row) throw notFound("User not found");
  const refreshed = apiUser(row as DbRow, await fetchWalletBalance(user.id));
  res.json({ user: safeUser(refreshed) });
}));

router.patch("/password", authenticate, validateBody(z.object({ currentPassword: z.string().min(1), newPassword: password })), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  if (!(await comparePassword(req.body.currentPassword as string, user.passwordHash))) throw unauthorized("Current password is incorrect");
  const { data: row, error } = await supabase.from("users")
    .update({ password_hash: await hashPassword(req.body.newPassword as string), token_version: user.tokenVersion + 1 })
    .eq("id", user.id).select("*").single();
  if (error) throwDatabaseError(error);
  const refreshed = apiUser(row as DbRow, await fetchWalletBalance(user.id));
  res.json({ message: "Password updated", token: signAccessToken(refreshed) });
}));

router.get("/users/:id", authenticate, asyncHandler(async (req, res) => {
  const { data: row, error } = await supabase.from("users").select("*").eq("id", req.params.id).eq("is_active", true).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!row) throw notFound("User not found");
  const { data: skills, error: skillsError } = await supabase.from("skills").select("*").eq("owner_id", req.params.id).eq("active", true);
  if (skillsError) throwDatabaseError(skillsError);
  const profile = publicUser(row as DbRow);
  res.json({ user: {
    ...profile,
    skillsOffered: (skills ?? []).filter((skill) => skill.type === "offer").map((skill) => apiSkill(skill as DbRow)),
    skillsWanted: (skills ?? []).filter((skill) => skill.type === "request").map((skill) => apiSkill(skill as DbRow)),
  } });
}));

export default router;
