import { type MissionPick } from "./catalog";
import { type DayMissionFacts } from "./day-facts";
import { getMissionBlocks } from "./mission-blocks";
import { getMissionMinutes } from "./mission-time";

function minutes(facts: DayMissionFacts, pick: MissionPick): number {
  return getMissionMinutes({
    blocks: getMissionBlocks({ blocks: facts.blocks, pick }),
    done: 0,
    kind: pick.kind,
    total: pick.total,
  });
}

function outsideMinutes(facts: DayMissionFacts, pick: MissionPick): number {
  return pick.anchor.blockKind ? 0 : minutes(facts, pick);
}

/** Session work counts once; an outside drill needs room beyond the whole day's queue. */
export function fitMission({
  chosen,
  facts,
  pick,
}: {
  chosen: readonly MissionPick[];
  facts: DayMissionFacts;
  pick: MissionPick;
}): MissionPick | null {
  const remaining =
    facts.dailyMinutes - chosen.reduce((sum, entry) => sum + minutes(facts, entry), 0);

  const outsideRemaining =
    Math.max(0, facts.dailyMinutes - facts.plannedMinutes) -
    chosen.reduce((sum, entry) => sum + outsideMinutes(facts, entry), 0);

  if (minutes(facts, pick) <= remaining && outsideMinutes(facts, pick) <= outsideRemaining) {
    return pick;
  }

  // A chapter must still mean the whole chapter; reviews and mistake piles can be smaller.
  if ((pick.kind === "review" || pick.kind === "fixMistake") && pick.total > 1) {
    return fitMission({ chosen, facts, pick: { ...pick, total: pick.total - 1 } });
  }

  return null;
}
