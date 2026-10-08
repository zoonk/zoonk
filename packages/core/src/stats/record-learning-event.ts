import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone, getHourInTimeZone } from "@zoonk/utils/time-zone";

type LedgerIdentity = Pick<LearningEvent, "kind" | "startedAt" | "titleSnapshot" | "userId"> &
  Partial<Pick<LearningEvent, "goalId" | "lessonKind">> & {
    /** Plain content ids without foreign keys, so the row outlives the content. */
    contentIds: Record<string, string>;
    timeZone: string;
  };

type LearningEventOutcome = Pick<
  LearningEvent,
  "brainPower" | "correctAnswers" | "energyDelta" | "incorrectAnswers" | "seconds"
>;

type FinishedLearningEvent = LedgerIdentity & LearningEventOutcome & { endedAt: Date };

/** The learner-local date, hour and weekday the ledger stores for an instant. */
function getLedgerLocalTime({ date, timeZone }: { date: Date; timeZone: string }) {
  const localDate = getDateInTimeZone({ date, timeZone });
  return { hour: getHourInTimeZone({ date, timeZone }), localDate, weekday: localDate.getUTCDay() };
}

/**
 * Appends one finished activity to the learner's content-free ledger. The learner-local date, hour
 * and weekday describe when it ended, so time-of-day patterns and admin stats never read content
 * tables. Callers pass the same `endedAt` they store elsewhere for the activity.
 */
export function recordLearningEvent(
  tx: TransactionClient,
  { endedAt, timeZone, ...event }: FinishedLearningEvent,
) {
  return tx.learningEvent.create({
    data: { ...event, endedAt, ...getLedgerLocalTime({ date: endedAt, timeZone }) },
  });
}

/**
 * Opens an activity the learner just started, with `endedAt` still null, so a start that is never
 * finished still counts against completion rates. Its local time describes the start until
 * `finishLearningEvent` closes it.
 */
export function startLearningEvent(
  tx: TransactionClient,
  { startedAt, timeZone, ...event }: LedgerIdentity,
) {
  return tx.learningEvent.create({
    data: { ...event, startedAt, ...getLedgerLocalTime({ date: startedAt, timeZone }) },
  });
}

/**
 * Closes a started activity with its outcome and moves its local time to when it ended. Only an
 * open row is updated, so two finishes racing on one activity close it once; the result tells the
 * caller whether it was the one that closed it.
 */
export async function finishLearningEvent(
  tx: TransactionClient,
  {
    endedAt,
    eventId,
    kind,
    outcome,
    timeZone,
  }: {
    endedAt: Date;
    eventId: string;
    kind: LearningEvent["kind"];
    outcome: LearningEventOutcome;
    timeZone: string;
  },
): Promise<boolean> {
  const { count } = await tx.learningEvent.updateMany({
    data: { ...outcome, endedAt, kind, ...getLedgerLocalTime({ date: endedAt, timeZone }) },
    where: { endedAt: null, id: eventId },
  });

  return count > 0;
}
