import { MS_PER_DAY } from "@zoonk/utils/date";
import {
  FIRST_STEP_KINDS,
  type FirstStepKind,
  MISSION_RULES,
  type MissionKind,
  type MissionPick,
} from "./catalog";
import { type DayMissionFacts } from "./day-facts";
import { fitMission } from "./fit-mission";

const DISTINCTIVE: readonly MissionKind[] = ["challenge", "mock", "weeklyChallenge", "essay"];

const ROTATION: readonly MissionKind[] = [
  "fixMistake",
  "practice",
  "pattern",
  "pronunciation",
  "call",
  "askBuddy",
  "weakSpot",
];

const WEEK_DAYS = 7;

function getFirstStepKind(kind: MissionKind): FirstStepKind | null {
  return kind === "finishChapter"
    ? "somethingNew"
    : (FIRST_STEP_KINDS.find((step) => step === kind) ?? null);
}

function isUnfinishedStep({ facts, pick }: { facts: DayMissionFacts; pick: MissionPick }): boolean {
  const stepKind = getFirstStepKind(pick.kind);

  return (
    facts.firstSteps?.steps.some(
      (step) => step.kind === stepKind && step.status !== "done" && step.status !== "later",
    ) ?? false
  );
}

function withFirstStep({
  facts,
  pick,
}: {
  facts: DayMissionFacts;
  pick: MissionPick;
}): MissionPick {
  return isUnfinishedStep({ facts, pick }) ? { ...pick, firstStep: true } : pick;
}

function rotationAge({ facts, kind }: { facts: DayMissionFacts; kind: MissionKind }): number {
  const index = facts.recentPicks.slice(0, WEEK_DAYS).findIndex((picks) => picks.includes(kind));
  return index === -1 ? WEEK_DAYS : index;
}

function hasPressingMistakes(facts: DayMissionFacts): boolean {
  return (
    facts.readyMistakeCount >= MISSION_RULES.mistakePileSize ||
    (facts.oldestReadyMistakeAt !== null &&
      facts.localDate.getTime() - facts.oldestReadyMistakeAt.getTime() >= WEEK_DAYS * MS_PER_DAY)
  );
}

function rankUseCandidates(facts: DayMissionFacts): MissionPick[] {
  const get = (kind: MissionKind) => facts.candidates.find((candidate) => candidate.kind === kind);
  const distinctive = DISTINCTIVE.flatMap((kind) => get(kind) ?? []);

  const first = facts.firstSteps?.steps.find(
    (step) =>
      step.status !== "done" &&
      step.status !== "later" &&
      step.kind !== "review" &&
      step.kind !== "somethingNew" &&
      get(step.kind),
  );

  const firstPick = first ? get(first.kind) : undefined;

  const pressing = [
    hasPressingMistakes(facts) && get("fixMistake"),
    facts.patternExpiresTomorrow && get("pattern"),
  ].filter((pick): pick is MissionPick => Boolean(pick));

  const rotation = ROTATION.toSorted(
    (a, b) => rotationAge({ facts, kind: b }) - rotationAge({ facts, kind: a }),
  ).flatMap((kind) => get(kind) ?? []);

  return [...distinctive, ...(firstPick ? [firstPick] : []), ...pressing, ...rotation].filter(
    (pick, index, all) => all.findIndex((other) => other.kind === pick.kind) === index,
  );
}

function conflicts({
  chosen,
  pick,
}: {
  chosen: readonly MissionPick[];
  pick: MissionPick;
}): boolean {
  if (chosen.some((other) => other.kind === pick.kind)) {
    return true;
  }

  const kinds = new Set([...chosen.map((other) => other.kind), pick.kind]);

  return (
    (kinds.has("practice") && kinds.has("fixMistake")) ||
    (kinds.has("practice") && kinds.has("weakSpot"))
  );
}

function fillSlots({
  chosen,
  count,
  facts,
  ranked,
}: {
  chosen: readonly MissionPick[];
  count: number;
  facts: DayMissionFacts;
  ranked: readonly MissionPick[];
}): MissionPick[] {
  const next = ranked
    .filter((pick) => !conflicts({ chosen, pick }))
    .map((pick) => fitMission({ chosen, facts, pick }))
    .find((pick) => pick !== null);

  return chosen.length >= count || !next
    ? [...chosen]
    : fillSlots({ chosen: [...chosen, next], count, facts, ranked });
}

/** Deterministic daily picks prioritize reviews and new learning before distinctive work and rotation. */
export function pickMissions(facts: DayMissionFacts): MissionPick[] {
  if (!facts.available || facts.plannedMinutes <= 0) {
    return [];
  }

  const short = facts.plannedMinutes < MISSION_RULES.shortDayMinutes;
  const count = short ? 2 : 3;
  const reviewCandidate = facts.candidates.find((pick) => pick.kind === "review");
  const review = reviewCandidate ? fitMission({ chosen: [], facts, pick: reviewCandidate }) : null;
  const remembered = review ? [review] : [];

  const learn = ["finishChapter", "somethingNew"].flatMap((kind) => {
    const pick = facts.candidates.find((candidate) => candidate.kind === kind);
    return pick ? (fitMission({ chosen: remembered, facts, pick }) ?? []) : [];
  })[0];

  const primary = [...remembered, ...(learn ? [learn] : [])];

  const ranked = rankUseCandidates(facts).filter(
    (pick) => !short || (Boolean(pick.anchor.blockKind) && pick.kind !== "weakSpot"),
  );

  const filled = fillSlots({ chosen: primary, count, facts, ranked });
  // A short day may still offer one small off-session mission when no session pick fits.
  const selected =
    filled.length > 0
      ? filled
      : fillSlots({ chosen: [], count: 1, facts, ranked: rankUseCandidates(facts) });

  const use = selected.find((pick) => !primary.includes(pick));
  const fillers = selected.filter((pick) => !primary.includes(pick) && pick !== use);

  const remember =
    review ?? fillers[0] ?? (primary.length + fillers.length < count ? use : undefined);

  const newSlot = learn ?? fillers[review ? 0 : 1];

  return [remember, newSlot, use]
    .filter(
      (pick, index, all): pick is MissionPick => pick !== undefined && all.indexOf(pick) === index,
    )
    .map((pick) => withFirstStep({ facts, pick }));
}
