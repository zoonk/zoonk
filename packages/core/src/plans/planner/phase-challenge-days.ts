import { isLessonRoom } from "./day-index";
import { addDays, toIsoDate } from "./plan-calendar";
import { type PlanDay, getLessonCapacity } from "./schedule-units";

type PhaseChallengeDayRules = { kind: "lessons" } | { kind: "examDays"; eve: number | null };

export function getExamChallengeDayRules({
  targetDate,
}: {
  targetDate: Date | null;
}): PhaseChallengeDayRules {
  return { eve: targetDate ? addDays(targetDate, -1).getTime() : null, kind: "examDays" };
}

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
  return !ownMock;
}

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
