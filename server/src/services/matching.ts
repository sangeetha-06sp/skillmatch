import { IUser } from "../models/User";
import { ISkill } from "../models/Skill";

export interface MatchResult {
  skill: ISkill;
  owner: { id: string; name: string; location: string; ratingAverage: number; ratingCount: number };
  score: number;
  explanation: { factor: string; points: number; reason: string }[];
}

const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 1));

export function scoreMatch(query: string, skill: Pick<ISkill, "title" | "description" | "category" | "tags" | "location">, user: Pick<IUser, "location" | "ratingAverage">) {
  const q = words(query);
  const terms = new Set([...words(skill.title), ...words(skill.description), ...words(skill.category), ...skill.tags.map((t) => t.toLowerCase())]);
  const overlap = q.size ? [...q].filter((word) => terms.has(word)).length / q.size : 0;
  const factors: MatchResult["explanation"] = [];
  const relevance = Math.round(overlap * 60);
  if (relevance) factors.push({ factor: "skill_relevance", points: relevance, reason: `${Math.round(overlap * 100)}% of search terms match the skill listing` });
  const sameLocation = Boolean(user.location && skill.location && user.location.toLowerCase() === skill.location.toLowerCase());
  if (sameLocation) factors.push({ factor: "location", points: 15, reason: "Skill listing is in your location" });
  const ratingPoints = Math.round((user.ratingAverage / 5) * 15);
  if (ratingPoints) factors.push({ factor: "community_rating", points: ratingPoints, reason: `Provider rating is ${user.ratingAverage.toFixed(1)} out of 5` });
  const quality = skill.description.length >= 100 ? 10 : skill.description.length >= 40 ? 5 : 0;
  if (quality) factors.push({ factor: "listing_detail", points: quality, reason: "Detailed skill description" });
  const score = Math.min(100, relevance + (sameLocation ? 15 : 0) + ratingPoints + quality);
  return { score, factors };
}

export function rankSkillMatches(query: string, listings: (ISkill & { owner: IUser })[], user: IUser): MatchResult[] {
  return listings
    .map((skill) => {
      const { score, factors } = scoreMatch(query, skill, user);
      return {
        skill,
        owner: {
          id: String(skill.owner._id),
          name: skill.owner.name,
          location: skill.owner.location,
          ratingAverage: skill.owner.ratingAverage,
          ratingCount: skill.owner.ratingCount,
        },
        score,
        explanation: factors,
      };
    })
    .sort((a, b) => b.score - a.score || a.skill.title.localeCompare(b.skill.title));
}
