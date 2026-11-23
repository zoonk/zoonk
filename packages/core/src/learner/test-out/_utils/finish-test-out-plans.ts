import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { announceTestedOutItems } from "../../../plans/announce-tested-out-items";
import { refreshGoalPlan } from "../../../plans/refresh-goal-plan";
import { getAnswerTimeZone } from "../../_utils/owned-goal";

const pendingPlan = z.object({
  goalId: z.string(),
  itemIds: z.array(z.string()),
  timeZone: z.string(),
});

const pendingPlansSchema = z.tuple([pendingPlan], pendingPlan);

export async function pendingTestOutPlans({
  goalId,
  itemIds,
  sharedItemIds,
  timeZone,
  tx,
}: {
  goalId: string;
  itemIds: string[];
  sharedItemIds: string[];
  timeZone: string;
  tx: TransactionClient;
}) {
  const shared =
    sharedItemIds.length > 0
      ? await tx.plan.findMany({
          select: {
            goal: { select: { timezone: true } },
            goalId: true,
            items: { select: { id: true }, where: { id: { in: sharedItemIds } } },
          },
          where: { items: { some: { id: { in: sharedItemIds } } } },
        })
      : [];

  return [
    ...shared.map((plan) => ({
      goalId: plan.goalId,
      itemIds: plan.items.map(({ id }) => id),
      timeZone: getAnswerTimeZone({ goal: plan.goal }),
    })),
    { goalId, itemIds, timeZone },
  ];
}

/** Each plan commit removes its own pending work. A retry resumes with the first unfinished goal. */
export async function finishTestOutPlans(event: LearningEvent): Promise<LearningEvent> {
  if (!isJsonObject(event.contentIds) || !event.contentIds.pendingPlans) {
    return event;
  }

  const { pendingPlans, ...content } = event.contentIds;
  const plans = pendingPlansSchema.parse(pendingPlans);
  const [plan, ...remaining] = plans;

  const save = (
    tx: TransactionClient,
    changeId: string | null,
    outcome?: { lessonsSkipped: number; planVersion: number },
  ) =>
    tx.learningEvent.update({
      data: {
        contentIds: {
          ...content,
          ...(remaining.length > 0 && { pendingPlans: remaining }),
          ...(plan.goalId === event.goalId &&
            outcome && {
              ...(changeId && { planChangeId: changeId }),
              lessonsSkipped: String(outcome.lessonsSkipped),
              planVersion: String(outcome.planVersion),
            }),
        },
      },
      where: { contentIds: { equals: plans, path: ["pendingPlans"] }, id: event.id },
    });

  if (plan.itemIds.length === 0) {
    await refreshGoalPlan({ goalId: plan.goalId });
    return save(prisma, null);
  }

  const announced = await announceTestedOutItems({
    extraWrites: save,
    goalId: plan.goalId,
    now: new Date(),
    planItemIds: plan.itemIds,
    testedOutAt: event.endedAt ?? event.createdAt,
    timeZone: plan.timeZone,
  });

  const updated = announced
    ? await prisma.learningEvent.findUniqueOrThrow({ where: { id: event.id } })
    : await save(prisma, null);

  return finishTestOutPlans(updated);
}
