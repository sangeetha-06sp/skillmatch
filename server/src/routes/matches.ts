import { Router } from "express";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { apiSkill, fetchUsers, throwDatabaseError, type DbRow } from "../services/database";
import { scoreMatch } from "../services/matching";
import { asyncHandler } from "../utils/asyncHandler";
import { notFound } from "../utils/errors";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const query = (typeof req.query.q === "string" ? req.query.q : "").trim().slice(0, 150);
  let queryText = query;
  if (!queryText && typeof req.query.skillId === "string") {
    const { data: wanted, error } = await supabase.from("skills")
      .select("title").eq("id", req.query.skillId).eq("owner_id", user.id).eq("active", true).maybeSingle();
    if (error) throwDatabaseError(error);
    if (!wanted) throw notFound("Active owned skill listing not found");
    queryText = wanted.title;
  }
  if (!queryText) {
    res.json({ matches: [], message: "Provide q or an owned skillId to get skill matches" });
    return;
  }

  const { data, error } = await supabase.from("skills").select("*")
    .eq("active", true).eq("type", "offer").neq("owner_id", user.id)
    .order("created_at", { ascending: false }).limit(500);
  if (error) throwDatabaseError(error);
  const skills = (data ?? []) as DbRow[];
  const owners = await fetchUsers(skills.map((skill) => String(skill.owner_id)));
  const matches = skills.flatMap((skill) => {
    const owner = owners.get(String(skill.owner_id));
    if (!owner || !owner.is_active) return [];
    const { score, factors } = scoreMatch(queryText, {
      title: String(skill.title),
      description: String(skill.description),
      category: String(skill.category),
      tags: Array.isArray(skill.tags) ? skill.tags as string[] : [],
      location: String(skill.location ?? ""),
    }, {
      location: String(user.location ?? ""),
      ratingAverage: Number(owner.rating_average ?? 0),
    });
    return [{
      skill: apiSkill(skill, owner),
      owner: {
        id: owner.id,
        name: String(owner.name),
        location: String(owner.location ?? ""),
        ratingAverage: Number(owner.rating_average ?? 0),
        ratingCount: Number(owner.rating_count ?? 0),
      },
      score,
      explanation: factors,
    }];
  }).sort((a, b) => b.score - a.score || String(a.skill.title).localeCompare(String(b.skill.title))).slice(0, 50);
  res.json({ matches, methodology: "Score is a weighted sum of search-term relevance (60), location (15), provider rating (15), and listing detail (10); each match explains its points." });
}));

export default router;
