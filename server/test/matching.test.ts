import { describe, expect, it } from "vitest";
import { scoreMatch } from "../src/services/matching";

const user = { location: "Toronto", ratingAverage: 4.5 };

describe("explainable skill matching", () => {
  it("rewards relevance, location, provider rating, and detailed listings", () => {
    const result = scoreMatch("figma interface design", {
      title: "Figma interface design",
      description: "A detailed workshop covering interface design and prototyping in Figma.",
      category: "Design",
      tags: ["figma", "ui"],
      location: "Toronto",
    }, user);

    expect(result.score).toBe(94);
    expect(result.factors.map((factor) => factor.factor)).toEqual([
      "skill_relevance", "location", "community_rating", "listing_detail",
    ]);
    expect(result.factors.reduce((total, factor) => total + factor.points, 0)).toBe(result.score);
  });

  it("scores unrelated remote listings lower and includes only earned factors", () => {
    const result = scoreMatch("pottery", {
      title: "Python for beginners",
      description: "Short lessons.",
      category: "Programming",
      tags: ["python"],
      location: "Vancouver",
    }, { location: "Toronto", ratingAverage: 0 });

    expect(result.score).toBe(0);
    expect(result.factors).toEqual([]);
  });

  it("caps score at 100 and treats an empty query as neutral", () => {
    const result = scoreMatch("", {
      title: "Expert coaching",
      description: "A".repeat(150),
      category: "Learning",
      tags: ["expert"],
      location: "Toronto",
    }, user);

    expect(result.score).toBe(39);
    expect(result.factors.some((factor) => factor.factor === "skill_relevance")).toBe(false);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
