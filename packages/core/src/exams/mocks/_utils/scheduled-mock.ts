import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { type MockIdentity, findScheduledMock } from "../../../plans/planner/mock-identity";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";

export async function loadScheduledMock({
  date,
  goalId,
  planItemId,
}: {
  date: Date;
  goalId: string | null;
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

export async function readScheduledPaper({
  client,
  goalId,
  planItemId,
}: {
  client: TransactionClient;
  goalId: string;
  planItemId: string;
}) {
  const item = isUuid(planItemId)
    ? await client.planItem.findFirst({
        select: { scheduledFor: true },
        where: { id: planItemId, kind: "mock", plan: { goalId } },
      })
    : null;

  return item ? (item.scheduledFor?.toISOString() ?? null) : undefined;
}
