import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

async function setup(details: Record<string, unknown>) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics"],
    skills: [
      { area: "Italiano", lessons: 0, level: "beginner", size: 4 },
      { area: "Italiano", lessons: 0, level: "beginner", size: 4 },
      { area: "Italiano", lessons: 0, level: "intermediate", size: 4 },
      { area: "Italiano", lessons: 0, level: "advanced", size: 4 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    details,
    kind: "language",
    settings: { startDate: "2020-09-28" },
    targetLanguage: "it",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const [trip, everyday, work, fluent] = library.graph.skills.map((skill) => skill.skillId);
  return { goal, plan, skills: { everyday, fluent, trip, work } };
}

async function plannedSkills(planId: string): Promise<Set<string | null>> {
  const items = await prisma.planItem.findMany({ where: { planId } });
  return new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));
}

describe("a language goal's aim", () => {
  it("plans only the situations up to the aim, and a higher aim brings the next ones in", async () => {
    const { goal, plan, skills } = await setup({ level: "none", targetScore: "A2" });

    const trip = await plannedSkills(plan.id);
    expect(trip).toContain(skills.trip);
    expect(trip).not.toContain(skills.work);
    expect(trip).not.toContain(skills.fluent);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ aim: "B1", kind: "setAim" }] },
    });

    expect(result).toMatchObject({ change: { canUndo: true }, status: "applied" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { level: "none", targetScore: "B1" },
    });

    const everyday = await plannedSkills(plan.id);
    expect(everyday).toContain(skills.work);
    expect(everyday).not.toContain(skills.fluent);
  });

  it("puts the aim back when the learner undoes its change", async () => {
    const { goal, plan, skills } = await setup({ level: "none", targetScore: "A2" });

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ aim: "C1", kind: "setAim" }] },
    });

    const change = result.status === "applied" ? result.change : null;

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { targetScore: "A2" },
    });

    await expect(plannedSkills(plan.id)).resolves.not.toContain(skills.fluent);
  });

  it("refuses an aim for a goal that isn't a language", async () => {
    const { goal } = await setup({ level: "none", targetScore: "A2" });
    await prisma.goal.update({ data: { kind: "learn" }, where: { id: goal.id } });

    await expect(
      changeGoalPlan({ goalId: goal.id, input: { operations: [{ aim: "B1", kind: "setAim" }] } }),
    ).resolves.toStrictEqual({ error: "notLanguage", status: "invalid" });
  });
});
