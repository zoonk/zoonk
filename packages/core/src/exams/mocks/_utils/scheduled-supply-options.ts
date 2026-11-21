import "server-only";
import { type Goal, type Plan, type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { findScheduledMock } from "../../../plans/planner/mock-identity";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";

export const SCHEDULED_SUPPLY_PLAN_SELECT = {
  graph: true,
  items: {
    orderBy: { scheduledFor: "asc" },
    select: { scheduledFor: true },
    take: 2,
    where: { kind: "mock", status: "todo" },
  },
  settings: true,
} as const;

export async function listScheduledSupplyOptions({
  client = prisma,
  goal,
  plan,
}: {
  client?: TransactionClient;
  goal: Pick<Goal, "id" | "targetDate">;
  plan: (Pick<Plan, "settings"> & { items: Pick<PlanItem, "scheduledFor">[] }) | null;
}) {
  const funding = parsePlanSettings(plan?.settings).mockFunding;
  const dates = (plan?.items ?? []).flatMap((item) => item.scheduledFor ?? []);

  const scheduled = dates.map((date) => ({
    date,
    identity: findScheduledMock({ date: toIsoDate(date), funding }),
  }));

  const finished = scheduled.some((item) => !item.identity)
    ? await client.mockExam.count({ where: { goalId: goal.id, status: "finished" } })
    : 0;

  return scheduled.map(({ date, identity }, index) => ({
    finishedMocks: finished + index,
    identity,
    scheduledFor: date,
  }));
}
