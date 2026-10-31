import { type BuddyGlasses } from "@zoonk/db";
import { type MilestoneCounts } from "../milestones/milestone-rules";
import { BRAIN_POWER_BONUS, type CheckpointKind } from "../sessions/brain-power";

/** Bosses pay on a win; weekly challenges pay on completion. */
export type CheckpointReward = {
  badge: boolean;
  brainPower: number;
  glasses: Exclude<BuddyGlasses, "round"> | null;
  phaseComplete: boolean;
};

function getBossGlasses({
  counts,
  kind,
}: {
  counts: MilestoneCounts;
  kind: CheckpointKind;
}): CheckpointReward["glasses"] {
  if (kind === "finalBoss" && counts.finalBossesWon === 0) {
    return "monocle";
  }

  return counts.bossesWon === 0 ? "star" : null;
}

export function getCheckpointReward({
  counts,
  kind,
}: {
  counts: MilestoneCounts;
  kind: CheckpointKind;
}): CheckpointReward {
  if (kind === "weekly") {
    return {
      badge: false,
      brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
      glasses: counts.bigChallenges === 0 ? "aviator" : null,
      phaseComplete: false,
    };
  }

  return {
    badge: true,
    brainPower: kind === "finalBoss" ? BRAIN_POWER_BONUS.finalBoss : BRAIN_POWER_BONUS.phaseBoss,
    glasses: getBossGlasses({ counts, kind }),
    phaseComplete: true,
  };
}
