import "server-only";
import { type Goal, type Plan, type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { findScheduledMock } from "../../../plans/planner/mock-identity";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanPhases, parsePlanSettings } from "../../../plans/planner/plan-state";
import { getFinalStretchStart, isInFinalStretch } from "../../final-stretch/final-stretch-rules";
import { getMockDays } from "../mock-plan";
import { type AnytimeMockSetup } from "./anytime-mock-setup";

export const SCHEDULED_SUPPLY_PLAN_SELECT = {
  items: {
    orderBy: { scheduledFor: "asc" },
    select: { scheduledFor: true },
    take: 2,
    where: { kind: "mock", status: "todo" },
  },
  graph: true,
  phases: true,
  settings: true,
} as const;

export async function listScheduledSupplyOptions({
  client = prisma,
  goal,
  plan,
  setup,
}: {
  client?: TransactionClient;
  goal: Pick<Goal, "id" | "targetDate">;
  plan:
    | (Pick<Plan, "graph" | "settings" | "phases"> & { items: Pick<PlanItem, "scheduledFor">[] })
    | null;
  setup: AnytimeMockSetup;
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

  const days = getMockDays(setup.structure);
  const finalStretchStart = getFinalStretchStart(parsePlanPhases(plan?.phases));

  return scheduled.flatMap(({ date, identity }, index) => {
    const fullLength =
      identity?.fullLength ??
      isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today: date });

    const day = identity ? identity.day : (days[(finished + index) % days.length] ?? null);

    const option = setup.options.find(
      (candidate) => candidate.day === day && candidate.kind === (fullLength ? "full" : "half"),
    );

    return option ? [{ option, scheduledFor: date }] : [];
  });
}
