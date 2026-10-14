import "server-only";
import { prisma } from "@zoonk/db";
import { type MockIdentity, findScheduledMock } from "../../../plans/planner/mock-identity";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";

/**
 * The exam day and length of the goal's mock scheduled on `date`, as its plan saved it (see
 * `MockIdentity`): what its card and session sit. Null for a goal without one there, or a plan
 * saved before its mocks had an identity.
 */
export async function loadScheduledMock({
  date,
  goalId,
  planItemId,
}: {
  date: Date;
  goalId: string | null;
  /** The owned scheduled event, including when its session is built after its original day. */
  planItemId?: string | null;
}): Promise<MockIdentity | null> {
  const item =
    planItemId && goalId
      ? await prisma.planItem.findFirst({
          select: { plan: { select: { settings: true } }, scheduledFor: true },
          where: { id: planItemId, kind: "mock", plan: { goalId } },
        })
      : null;

  if (planItemId && !item?.scheduledFor) {
    return null;
  }

  const plan =
    item?.plan ??
    (goalId
      ? await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } })
      : null);

  return plan
    ? findScheduledMock({
        date: toIsoDate(item?.scheduledFor ?? date),
        funding: parsePlanSettings(plan.settings).mockFunding,
      })
    : null;
}
