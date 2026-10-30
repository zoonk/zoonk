import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";

async function finishedChallengeFixture({
  correctAnswers,
  date,
  planItemId,
}: {
  correctAnswers: number;
  date: Date;
  planItemId: string;
}) {
  const { plan } = await prisma.planItem.findUniqueOrThrow({
    select: { plan: { select: { goal: { select: { id: true, userId: true } } } } },
    where: { id: planItemId },
  });

  return learningEventFixture({
    contentIds: { planItemId },
    correctAnswers,
    endedAt: date,
    goalId: plan.goal.id,
    incorrectAnswers: 10 - correctAnswers,
    kind: "checkpoint",
    userId: plan.goal.userId,
  });
}

/** A plan keeps the phase ends it shows only once the learner has taken one of its challenges. */
export async function takenChallengeFixture({ date, planId }: { date: Date; planId: string }) {
  const item = await planItemFixture({
    completedAt: date,
    kind: "checkpoint",
    planId,
    position: -1,
    scheduledFor: date,
    status: "done",
    titleSnapshot: "Weekly challenge",
  });

  await finishedChallengeFixture({ correctAnswers: 8, date, planItemId: item.id });
  return item;
}

/** A lost phase challenge stays to do in the plan; only its attempt says it was taken. */
export function lostChallengeFixture({ date, planItemId }: { date: Date; planItemId: string }) {
  return finishedChallengeFixture({ correctAnswers: 2, date, planItemId });
}
