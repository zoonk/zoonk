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

/**
 * A dated exam's rules: its eve, and the days the learner moved a mock onto (`movedTo`), which a
 * challenge can still go on.
 */
export function getExamChallengeDayRules({
  settings,
  targetDate,
}: {
  settings: Pick<PlanSettings, "movedEvents">;
  targetDate: Date | null;
}): PhaseChallengeDayRules {
  return {
    eve: targetDate ? addDays(targetDate, -1).getTime() : null,
    kind: "examDays",
    movedTo: new Set(settings.movedEvents.map((move) => move.to)),
  };
}

/**
 * Whether a run's day can hold a phase challenge no kept day holds: a day with lesson time, which
 * it leads, or a dated exam's study day: with study time, before the exam's eve, and not a weekly
 * mock's own day, though a day the learner moved a mock onto still is, for the challenge they moved
 * it onto (see `placeExamBosses`): the two share it, the challenge on top of the mock's time.
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
