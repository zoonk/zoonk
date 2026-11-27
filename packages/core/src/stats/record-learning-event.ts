import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { type JsonObject } from "@zoonk/utils/json";
import { getLearnerLocalTime } from "../learner/_utils/local-time";

type LedgerIdentity = Pick<LearningEvent, "kind" | "startedAt" | "titleSnapshot" | "userId"> &
  Partial<Pick<LearningEvent, "brainPower" | "goalId" | "lessonKind">> & {
    /** Plain content ids without foreign keys, so the row outlives the content. */
    contentIds: JsonObject;
    timeZone: string;
  };

type LearningEventOutcome = Pick<
  LearningEvent,
  "brainPower" | "correctAnswers" | "energyDelta" | "incorrectAnswers" | "seconds"
>;

type FinishedLearningEvent = LedgerIdentity & LearningEventOutcome & { endedAt: Date };

/** Pass the same endedAt stored for the activity; local ledger time describes its end and survives content deletion. */
export function recordLearningEvent(
  tx: TransactionClient,
  { endedAt, timeZone, ...event }: FinishedLearningEvent,
) {
  return tx.learningEvent.create({
    data: { ...event, endedAt, ...getLearnerLocalTime({ date: endedAt, timeZone }) },
  });
}

/** Start with endedAt unset so abandoned activities count against completion rates. */
export function startLearningEvent(
  tx: TransactionClient,
  { startedAt, timeZone, ...event }: LedgerIdentity,
) {
  return tx.learningEvent.create({
    data: { ...event, startedAt, ...getLearnerLocalTime({ date: startedAt, timeZone }) },
  });
}

/** Closes only an open row; the result identifies which concurrent caller performed the transition. */
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
    data: { ...outcome, endedAt, kind, ...getLearnerLocalTime({ date: endedAt, timeZone }) },
    where: { endedAt: null, id: eventId },
  });

  return count > 0;
}
