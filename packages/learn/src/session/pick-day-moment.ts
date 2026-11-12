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

/**
 * A task's end shows one extra moment at most, the rarest that applies, and only what was earned:
 * one mission done or Energy moving is progress the day's bar, Today and the buddy's page show.
 */
export function pickDayMoment({
  ceremony,
  finishedChapter,
  missionMoment,
  reached,
}: DayMomentFacts): "belt" | "chapter" | "missions" | null {
  const missions = missionMoment ? getMissionMomentKind(missionMoment) : null;

  if (reached.level && ceremony?.kind !== "belt") {
    return "belt";
  }

  if (missions === "all") {
    return "missions";
  }

  return finishedChapter ? "chapter" : null;
}
