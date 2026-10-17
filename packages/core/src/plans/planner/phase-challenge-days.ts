import { type BuildPlanInput } from "./build-plan";
import { isLessonRoom } from "./day-index";
import { addDays, toIsoDate } from "./plan-calendar";
import { type PlanSettings } from "./plan-state";
import { type PlanDay, getLessonCapacity } from "./schedule-units";

/**
 * What decides the days a phase challenge no kept day holds can go on: a learn plan's, or an
 * undated exam's, leads the first later day with lesson time (see `placeBoss`); a dated exam's
 * goes on a study day away from the exam's eve and its mocks' own days (see `placeExamBosses`).
 */
type PhaseChallengeDayRules =
  | { kind: "lessons" }
  | { kind: "examDays"; eve: number | null; movedTo: ReadonlySet<string> };

type MoveSettings = Pick<PlanSettings, "mockRelocations" | "movedEvents">;

/**
 * A dated exam's rules: its eve, and the days a mock was moved onto (`movedTo`: the learner's
 * move, or a run's, see `findRelocation`), which a challenge can still go on.
 */
export function getExamChallengeDayRules({
  settings,
  targetDate,
}: {
  settings: MoveSettings;
  targetDate: Date | null;
}): PhaseChallengeDayRules {
  return {
    eve: targetDate ? addDays(targetDate, -1).getTime() : null,
    kind: "examDays",
    movedTo: new Set([...settings.movedEvents, ...settings.mockRelocations].map((move) => move.to)),
  };
}

/**
 * The rules a goal's runs place its phase challenges by: an exam with a date lays its days out by
 * the exam's calendar (see `createDays`), every other goal by its lessons.
 */
export function getPhaseChallengeDayRules({
  goal,
  settings,
}: {
  goal: Pick<BuildPlanInput["goal"], "kind" | "targetDate">;
  settings: MoveSettings;
}): PhaseChallengeDayRules {
  return goal.kind === "exam" && goal.targetDate
    ? getExamChallengeDayRules({ settings, targetDate: goal.targetDate })
    : { kind: "lessons" };
}

/**
 * Whether a run's day can hold a phase challenge no kept day holds: a day with lesson time, which
 * it leads, or a dated exam's study day: with study time, before the exam's eve, and not a weekly
 * mock's own day, though a day a mock was moved onto still is (the two share it when its days
 * fund both, else the mock moves on).
 */
export function canHoldPhaseChallenge({
  day,
  rules,
}: {
  day: PlanDay;
  rules: PhaseChallengeDayRules;
}): boolean {
  if (rules.kind === "lessons") {
    return isLessonRoom(getLessonCapacity(day));
  }

  if (day.shape.minutes <= 0 || day.date.getTime() === rules.eve) {
    return false;
  }

  const ownMock = day.shape.events.some((event) => event.kind === "mock" && event.replacesDay);
  return !ownMock || rules.movedTo.has(toIsoDate(day.date));
}

/** The ISO days among `days` that can hold one (see `canHoldPhaseChallenge`), in order. */
export function listPhaseChallengeDays({
  days,
  rules,
}: {
  days: readonly PlanDay[];
  rules: PhaseChallengeDayRules;
}): string[] {
  return days.flatMap((day) =>
    canHoldPhaseChallenge({ day, rules }) ? [toIsoDate(day.date)] : [],
  );
}
