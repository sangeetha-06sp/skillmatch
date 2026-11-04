import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { hashPassword, comparePassword, signAccessToken } from "../utils/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { conflict, notFound, unauthorized } from "../utils/errors";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";

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

router.post("/register", validateBody(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password: rawPassword, location, bio, college, department, year, availability } = req.body as z.infer<typeof registerSchema>;
  if (await User.exists({ email: email.toLowerCase() })) throw conflict("An account with this email already exists");
  const user = await User.create({ name, email, passwordHash: await hashPassword(rawPassword), location, bio, college, department, year, availability });
  res.status(201).json({ user, token: signAccessToken(user) });
}));

router.post("/login", validateBody(z.object({ email: z.string().email(), password: z.string().min(1).max(128) })), asyncHandler(async (req, res) => {
  const { email, password: rawPassword } = req.body as { email: string; password: string };
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash +tokenVersion");
  if (!user || !user.isActive || !(await comparePassword(rawPassword, user.passwordHash))) throw unauthorized("Email or password is incorrect");
  res.json({ user, token: signAccessToken(user) });
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  res.json({ user });
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
  const user = await User.findByIdAndUpdate(requireAuth(req)._id, { $set: req.body }, { new: true, runValidators: true });
  if (!user) throw notFound("User not found");
  res.json({ user });
}));

router.patch("/password", authenticate, validateBody(z.object({ currentPassword: z.string().min(1), newPassword: password })), asyncHandler(async (req, res) => {
  const user = await User.findById(requireAuth(req)._id).select("+passwordHash");
  if (!user) throw notFound("User not found");
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!(await comparePassword(currentPassword, user.passwordHash))) throw unauthorized("Current password is incorrect");
  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  res.json({ message: "Password updated", token: signAccessToken(user) });
}));

router.get("/users/:id", authenticate, asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, isActive: true })
    .select("name bio location avatarUrl skillsOffered skillsWanted ratingAverage ratingCount createdAt")
    .populate("skillsOffered skillsWanted", "title category type active");
  if (!user) throw notFound("User not found");
  res.json({ user });
}));

export default router;
