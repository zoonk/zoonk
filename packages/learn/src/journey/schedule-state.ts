import { daysBetween } from "../_utils/iso-date";
import { type PlanStatus } from "../plan/plan-status-label";

/**
 * A paused plan's schedule reads "Paused": nothing is planned until the learner resumes. A date
 * passed, a finished plan or its last challenges still say more than the pause.
 */
export function showsPausedSchedule({
  paused,
  status,
}: {
  paused: boolean;
  status: PlanStatus;
}): boolean {
  return (
    paused &&
    status.kind !== "pastDate" &&
    status.kind !== "finished" &&
    status.kind !== "challengesLeft"
  );
}

/**
 * The days left to the goal's date, or null when there's none to count down to. A pause moves a
 * goal's own end date, so a paused one counts nothing; an exam's date stays where it is.
 */
export function getPlanDaysLeft({
  exam,
  paused,
  targetDate,
  today,
}: {
  exam: boolean;
  paused: boolean;
  targetDate: string | null;
  today: string;
}): number | null {
  if (!targetDate || targetDate < today || (paused && !exam)) {
    return null;
  }

  return daysBetween(today, targetDate);
}
