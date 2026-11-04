import { Router } from "express";
import { z } from "zod";
import { Skill } from "../models/Skill";
import { User } from "../models/User";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { forbidden, notFound } from "../utils/errors";
import { paginationFrom, pageInfo } from "../utils/pagination";

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

router.get("/", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  const filter: Record<string, unknown> = { active: true };
  if (typeof req.query.category === "string") filter.category = new RegExp(`^${req.query.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (["offer", "request"].includes(String(req.query.type))) filter.type = req.query.type;
  if (["online", "in-person", "either"].includes(String(req.query.mode))) filter.mode = req.query.mode;
  if (["beginner", "intermediate", "advanced", "expert"].includes(String(req.query.level))) filter.level = req.query.level;
  if (["Flexible", "Weekday evenings", "Weekends"].includes(String(req.query.availability))) filter.availability = req.query.availability;
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query) {
    const terms = query.split(/\s+/).slice(0, 8).map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    filter.$and = terms.map((term) => ({ $or: [{ title: term }, { description: term }, { category: term }, { tags: term }] }));
  }
  const [skills, total] = await Promise.all([
    Skill.find(filter).populate("owner", "name location college avatarUrl ratingAverage ratingCount").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Skill.countDocuments(filter),
  ]);
  res.json({ skills, pagination: pageInfo(total, page, limit) });
}));

router.get("/mine", authenticate, asyncHandler(async (req, res) => {
  const skills = await Skill.find({ owner: requireAuth(req)._id }).sort({ createdAt: -1 });
  res.json({ skills });
}));

router.post("/", authenticate, validateBody(skillSchema), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const skill = await Skill.create({ ...req.body, location: req.body.location ?? user.location, owner: user._id });
  const field = skill.type === "offer" ? "skillsOffered" : "skillsWanted";
  await User.updateOne({ _id: user._id }, { $addToSet: { [field]: skill._id } });
  res.status(201).json({ skill });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.params.id, active: true }).populate("owner", "name bio location college avatarUrl ratingAverage ratingCount");
  if (!skill) throw notFound("Skill listing not found");
  res.json({ skill });
}));

router.patch("/:id", authenticate, validateBody(skillSchema.partial().strict()), asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) throw notFound("Skill listing not found");
  if (!skill.owner.equals(requireAuth(req)._id) && requireAuth(req).role !== "admin") throw forbidden();
  const previousType = skill.type;
  Object.assign(skill, req.body);
  await skill.save();
  if (previousType !== skill.type) {
    const oldField = previousType === "offer" ? "skillsOffered" : "skillsWanted";
    const newField = skill.type === "offer" ? "skillsOffered" : "skillsWanted";
    await User.updateOne({ _id: skill.owner }, { $pull: { [oldField]: skill._id }, $addToSet: { [newField]: skill._id } });
  }
  res.json({ skill });
}));

router.delete("/:id", authenticate, asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) throw notFound("Skill listing not found");
  if (!skill.owner.equals(requireAuth(req)._id) && requireAuth(req).role !== "admin") throw forbidden();
  skill.active = false;
  await skill.save();
  const field = skill.type === "offer" ? "skillsOffered" : "skillsWanted";
  await User.updateOne({ _id: skill.owner }, { $pull: { [field]: skill._id } });
  res.json({ message: "Skill listing deactivated" });
}));

export default router;
