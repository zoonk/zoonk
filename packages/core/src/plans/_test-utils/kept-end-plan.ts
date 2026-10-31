import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../_test-utils/mock-session";
import { createGoalPlan } from "../create-goal-plan";
import { parsePlanPhases } from "../planner/plan-state";
import { planLibraryFixture, unplannedGoalFixture } from "./plan-library";

const DAY = 86_400_000;

export async function readPlan(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  return {
    items: plan.items.map((item) => ({
      kind: item.kind,
      lessonId: item.lessonId,
      scheduledFor: item.scheduledFor?.toISOString().slice(0, 10),
      skillId: item.skillId,
      status: item.status,
    })),
    phases: plan.phases,
  };
}

function twoDaysLater(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 2 * DAY).toISOString().slice(0, 10);
}

/** Starts on Monday, September 28, 2020. */
export async function keptEndPlanFixture() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Next steps"],
    skills: [
      { area: "Math", lessons: 6 },
      { area: "Math", lessons: 6, phase: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const created = await prisma.plan.findUniqueOrThrow({
    include: { items: true },
    where: { id: plan.id },
  });

  const [first, second] = parsePlanPhases(created.phases);
  const challenge = created.items.find((item) => item.kind === "boss" && item.phase === 0);

  await Promise.all([
    prisma.plan.update({
      data: {
        phases: [
          { ...first, endDate: twoDaysLater(first?.endDate ?? "") },
          { ...second, startDate: twoDaysLater(second?.startDate ?? "") },
        ],
      },
      where: { id: plan.id },
    }),
    prisma.planItem.update({
      data: { scheduledFor: new Date(`${twoDaysLater(first?.endDate ?? "")}T00:00:00Z`) },
      where: { id: challenge?.id ?? "" },
    }),
  ]);

  return { goal, library, plan, user };
}
