import {
  type FinishedChapter,
  type MissionMomentView,
} from "@zoonk/core/sessions/completion-contract";
import { type Mission } from "@zoonk/core/sessions/missions";
import { type Reached } from "@zoonk/core/sessions/reached";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";

export type DayMomentFacts = {
  /** Only keeps a new belt's number from being said twice: the ceremony shows before the result. */
  ceremony: Pick<CeremonyMilestone, "kind"> | null;
  finishedChapter?: FinishedChapter | null;
  missionMoment: MissionMomentView | null;
  reached: Reached;
};

type MissionMomentFacts = {
  completed: readonly Mission["kind"][];
  fullMeal: { paid: boolean };
  missions: readonly Mission[];
};

export function getJustDoneMissions({
  completed,
  missions,
}: Pick<MissionMomentFacts, "completed" | "missions">): readonly Mission[] {
  return missions.filter(
    (mission) => mission.status === "done" && completed.includes(mission.kind),
  );
}

/** What an activity did to the day's missions: finished them all, finished some, or nothing. */
export function getMissionMomentKind(facts: MissionMomentFacts): "all" | "one" | null {
  if (getJustDoneMissions(facts).length === 0 && !facts.fullMeal.paid) {
    return null;
  }

  return facts.fullMeal.paid && facts.missions.every((mission) => mission.status === "done")
    ? "all"
    : "one";
}

/** Where the buddy starts glowing (`getBuddyEnergyState`). */
const GLOWING_ENERGY = 80;

/** Energy gets a moment only where the buddy shows it: any other tenth is a number moving. */
function isGlowReached(reached: Reached): boolean {
  return reached.energy !== null && reached.energy >= GLOWING_ENERGY;
}

/**
 * A task's end shows one extra moment at most, the rarest that applies. The others aren't lost: the
 * day's summary, the top bar and the buddy's page show them.
 */
export function pickDayMoment({
  ceremony,
  finishedChapter,
  missionMoment,
  reached,
}: DayMomentFacts): "belt" | "chapter" | "glow" | "mission" | "missions" | null {
  const missions = missionMoment ? getMissionMomentKind(missionMoment) : null;

  if (reached.level && ceremony?.kind !== "belt") {
    return "belt";
  }

  if (missions === "all") {
    return "missions";
  }

  if (finishedChapter) {
    return "chapter";
  }

  if (isGlowReached(reached)) {
    return "glow";
  }

  return missions === "one" ? "mission" : null;
}
