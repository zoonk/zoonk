import { describe, expect, it } from "vitest";
import { getAreaPreparations } from "./area-preparation";
import { type PreparationSkill } from "./preparation-math";

const NOW = new Date("2026-09-20T12:00:00Z");
const WEEK_AGO = new Date("2026-09-13T12:00:00Z");

function skill(
  overrides: Partial<PreparationSkill> & { areaId: string; skillId: string },
): PreparationSkill {
  return { fading: false, retrievability: null, state: "new", studiedAt: null, ...overrides };
}

const AREAS = [
  { areaId: "algebra", title: "Algebra" },
  { areaId: "geometry", title: "Geometry" },
  { areaId: "statistics", title: "Statistics" },
];

const SKILLS = [
  skill({
    areaId: "algebra",
    retrievability: 0.98,
    skillId: "a1",
    state: "solid",
    studiedAt: new Date("2026-09-01"),
  }),
  skill({
    areaId: "algebra",
    retrievability: 0.97,
    skillId: "a2",
    state: "mastered",
    studiedAt: new Date("2026-09-15"),
  }),
  skill({
    areaId: "geometry",
    fading: true,
    retrievability: 0.6,
    skillId: "g1",
    state: "learning",
    studiedAt: new Date("2026-09-02"),
  }),
  skill({ areaId: "geometry", skillId: "g2" }),
  skill({ areaId: "statistics", skillId: "s1" }),
];

describe(getAreaPreparations, () => {
  const result = getAreaPreparations({
    answers: [],
    areas: AREAS,
    now: NOW,
    skills: SKILLS,
    weekAgo: WEEK_AGO,
  });

  it("measures each area with its skill states", () => {
    const algebra = result.areas.find((area) => area.areaId === "algebra");

    expect(algebra).toMatchObject({ needsPractice: false, title: "Algebra" });
    expect(algebra?.preparation).toBeCloseTo(0.975);
    expect(algebra?.skills).toMatchObject({ mastered: 1, solid: 1, total: 2 });
    expect(algebra?.weekGain).toBeCloseTo(0.975 / 2);
  });

  it("flags an area with fading skills as needing practice", () => {
    expect(result.areas.find((area) => area.areaId === "geometry")?.needsPractice).toBe(true);
  });

  it("names the weakest studied area, never one not reached yet", () => {
    expect(result.weakestAreaId).toBe("geometry");
  });
});
