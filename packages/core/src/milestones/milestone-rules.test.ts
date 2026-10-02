import { describe, expect, it } from "vitest";
import {
  getCrossedMilestones,
  getEarnedGlasses,
  getGlassesProgress,
  pickCeremony,
} from "./milestone-rules";

const counts = {
  bigChallenges: 0,
  bossesWon: 1,
  capsulesOpened: 38,
  finalBossesWon: 0,
  fullMeals: 7,
};

describe(getGlassesProgress, () => {
  it("shows how far each pair of glasses is, round coming with the buddy", () => {
    expect(getGlassesProgress(counts)).toStrictEqual([
      { current: 0, earned: true, glasses: "round", target: 0 },
      { current: 1, earned: true, glasses: "star", target: 1 },
      { current: 0, earned: false, glasses: "aviator", target: 1 },
      { current: 7, earned: true, glasses: "catEye", target: 7 },
      { current: 38, earned: false, glasses: "retro", target: 50 },
      { current: 0, earned: false, glasses: "monocle", target: 1 },
    ]);
  });
});

describe(getEarnedGlasses, () => {
  it("awards glasses by fixed milestones, never at random", () => {
    expect(getEarnedGlasses(counts)).toStrictEqual([
      { key: "star", kind: "glasses" },
      { key: "catEye", kind: "glasses" },
    ]);
  });
});

describe(getCrossedMilestones, () => {
  it("celebrates a new belt and the buddy growing only when crossed now", () => {
    expect(getCrossedMilestones({ after: 7600, before: 7400, hasBuddy: true })).toStrictEqual([
      { key: "orange", kind: "belt" },
      { key: "young", kind: "buddyStage" },
    ]);

    expect(getCrossedMilestones({ after: 2600, before: 2400, hasBuddy: true })).toStrictEqual([
      { key: "yellow", kind: "belt" },
    ]);

    expect(getCrossedMilestones({ after: 7600, before: 7500, hasBuddy: true })).toStrictEqual([]);
  });

  it("gives Focus learners the belt without a buddy stage", () => {
    expect(getCrossedMilestones({ after: 7600, before: 7400, hasBuddy: false })).toStrictEqual([
      { key: "orange", kind: "belt" },
    ]);
  });
});

describe(pickCeremony, () => {
  it("shows the buddy growing first, then the newest of the rest, never twice", () => {
    const earnedAt = new Date("2026-09-30T10:00:00Z");
    const later = new Date("2026-09-30T11:00:00Z");

    const milestones = [
      { earnedAt: later, id: "badge", kind: "badge" as const, shownAt: null },
      { earnedAt, id: "stage", kind: "buddyStage" as const, shownAt: null },
      { earnedAt: later, id: "belt", kind: "belt" as const, shownAt: earnedAt },
    ];

    expect(pickCeremony(milestones)?.id).toBe("stage");
    expect(pickCeremony(milestones.slice(0, 1))?.id).toBe("badge");
    expect(pickCeremony(milestones.slice(2))).toBeNull();
  });
});
