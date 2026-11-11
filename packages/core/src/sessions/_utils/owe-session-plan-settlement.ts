import { type Goal, type StudySession, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type FollowUp } from "../../follow-ups/follow-up-contract";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";

/** Call under the learner and session locks, in the transaction that records the end. */
export async function oweSessionPlanSettlement(
  tx: TransactionClient,
  {
    followUps,
    goal,
    session,
    timeZone,
  }: { followUps: readonly FollowUp[]; goal: Goal | null; session: StudySession; timeZone: string },
): Promise<boolean> {
  const { goalId } = session;
  const firstEnd = !session.endedAt && !session.stoppedAt;

  const testAnswers =
    goal?.kind === "exam"
      ? await tx.attempt.count({
          where: { isPlacement: true, studySessionId: session.id, userId: session.userId },
        })
      : 0;

  const newAnswers = testAnswers > (session.testAnswersOwed ?? 0);

  const planOwed = goalId !== null && (firstEnd || newAnswers);

  const pending = planOwed
    ? await tx.followUp.findUnique({
        where: {
          userKindKey: { key: session.id, kind: "settleSessionPlan", userId: session.userId },
        },
      })
    : null;

  const rebalance =
    firstEnd ||
    (pending !== null && isJsonObject(pending.input) && pending.input.rebalance !== false);

  await oweFollowUps({
    db: tx,
    followUps: [
      ...followUps,
      ...(planOwed
        ? [
            {
              input: {
                goalId,
                ...(!rebalance && { rebalance: false }),
                sessionId: session.id,
                timeZone,
              },
              kind: "settleSessionPlan" as const,
            },
          ]
        : []),
    ],
    userId: session.userId,
  });

  if (newAnswers) {
    await tx.studySession.update({
      data: { testAnswersOwed: testAnswers },
      where: { id: session.id },
    });
  }

  return planOwed;
}
