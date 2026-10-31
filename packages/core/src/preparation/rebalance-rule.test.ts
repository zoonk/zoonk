import { describe, expect, it } from "vitest";
import { type RebalanceArea, pickRebalance } from "./rebalance-rule";

const NOW = new Date("2026-10-07T12:00:00Z");
const DAY_MS = 86_400_000;

function counts(attrs: Partial<RebalanceArea["skills"]> = {}): RebalanceArea["skills"] {
  return { fading: 0, learning: 0, mastered: 0, new: 0, solid: 0, total: 0, ...attrs };
}

const strong: RebalanceArea = {
  areaId: "humanities",
  needsPractice: false,
  planAreas: ["Humanities"],
  skills: counts({ learning: 1, mastered: 1, solid: 2, total: 4 }),
  weekGain: 0.05,
};

const weak: RebalanceArea = {
  areaId: "science",
  needsPractice: true,
  planAreas: ["Science"],
  skills: counts({ fading: 2, learning: 3, total: 3 }),
  weekGain: 0,
};

function pick(overrides: Partial<Parameters<typeof pickRebalance>[0]> = {}) {
  return pickRebalance({
    areas: [strong, weak],
    focusAreas: [],
    lastRebalanceAt: null,
    now: NOW,
    weakestAreaId: "science",
    ...overrides,
  });
}

describe(pickRebalance, () => {
  it("moves time to the weakest area when another is going well", () => {
    expect(pick()).toStrictEqual(["Science"]);
  });

  it("waits a week between rebalances", () => {
    expect(pick({ lastRebalanceAt: new Date(NOW.getTime() - 2 * DAY_MS) })).toBeNull();

    expect(pick({ lastRebalanceAt: new Date(NOW.getTime() - 8 * DAY_MS) })).toStrictEqual([
      "Science",
    ]);
  });

  it("leaves a plan alone when the learner chose their own focus", () => {
    expect(pick({ focusAreas: ["Humanities"] })).toBeNull();
  });

  it("needs an area that's really going well: mostly Solid and still gaining", () => {
    const stalled = { ...strong, weekGain: 0 };
    const shaky = { ...strong, skills: counts({ learning: 3, solid: 1, total: 4 }) };

    expect(pick({ areas: [stalled, weak] })).toBeNull();
    expect(pick({ areas: [shaky, weak] })).toBeNull();
  });

  it("does nothing when the weakest area needs no practice or shares the plan's areas", () => {
    expect(pick({ areas: [strong, { ...weak, needsPractice: false }] })).toBeNull();
    expect(pick({ areas: [strong, { ...weak, planAreas: ["Humanities"] }] })).toBeNull();
    expect(pick({ weakestAreaId: null })).toBeNull();
  });
});
