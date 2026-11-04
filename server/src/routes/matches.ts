import { Router } from "express";
import { Skill } from "../models/Skill";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { rankSkillMatches } from "../services/matching";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const query = (typeof req.query.q === "string" ? req.query.q : "").trim().slice(0, 150);
  const wanted = typeof req.query.skillId === "string" ? await Skill.findOne({ _id: req.query.skillId, owner: user._id, active: true }) : null;
  const queryText = query || wanted?.title || "";
  if (!queryText) {
    res.json({ matches: [], message: "Provide q or an owned skillId to get skill matches" });
    return;
  }
  const skills = await Skill.find({ active: true, type: "offer", owner: { $ne: user._id } })
    .populate({ path: "owner", match: { isActive: true }, select: "name location ratingAverage ratingCount" })
    .limit(500);
  const candidates = skills.filter((skill) => Boolean(skill.owner)).map((skill) => ({
    ...skill.toObject(),
    owner: skill.owner,
  }));
  const matches = rankSkillMatches(queryText, candidates as never, user).slice(0, 50);
  res.json({ matches, methodology: "Score is a weighted sum of search-term relevance (60), location (15), provider rating (15), and listing detail (10); each match explains its points." });
}));

export default router;
