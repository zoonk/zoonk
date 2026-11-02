import { describe, expect, it } from "vitest";
import { type MilestoneCounts } from "../milestones/milestone-rules";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { getCheckpointReward } from "./checkpoint-reward";

const NOTHING_YET: MilestoneCounts = {
  bigChallenges: 0,
  bossesWon: 0,
  capsulesOpened: 0,
  finalBossesWon: 0,
  fullMeals: 0,
};

describe(getCheckpointReward, () => {
  it("promises the Star glasses and a badge for the first boss won", () => {
    expect(getCheckpointReward({ counts: NOTHING_YET, kind: "boss" })).toStrictEqual({
      badge: true,
      brainPower: BRAIN_POWER_BONUS.phaseBoss,
      glasses: "star",
      phaseComplete: true,
    });
  });

  it("promises no glasses once the Star glasses were earned", () => {
    expect(
      getCheckpointReward({ counts: { ...NOTHING_YET, bossesWon: 2 }, kind: "boss" }),
    ).toMatchObject({ badge: true, glasses: null });
  });

  it("puts the Monocle on the final boss until it's won", () => {
    expect(
      getCheckpointReward({ counts: { ...NOTHING_YET, bossesWon: 3 }, kind: "finalBoss" }),
    ).toStrictEqual({
      badge: true,
      brainPower: BRAIN_POWER_BONUS.finalBoss,
      glasses: "monocle",
      phaseComplete: true,
    });
  });

  it("pays a Big Challenge for finishing it, with the Aviator glasses the first time", () => {
    expect(getCheckpointReward({ counts: NOTHING_YET, kind: "weekly" })).toStrictEqual({
      badge: false,
      brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
      glasses: "aviator",
      phaseComplete: false,
    });

    expect(
      getCheckpointReward({ counts: { ...NOTHING_YET, bigChallenges: 1 }, kind: "weekly" }),
    ).toMatchObject({ glasses: null });
  });
});
