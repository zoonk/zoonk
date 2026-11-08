import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { setUpPlanInSteps } from "./_test-utils/set-up-plan";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";
import { getPlanTimeAdvice } from "./get-time-advice";
import { previewPlanChange } from "./preview-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** New language plans stop at their aim; plans laid out before that rule have no setting. */
const NEW_PLAN = { stopsAtAim: true };
const OLDER_PLAN = {};

async function setup(details: Record<string, unknown>, settings: Record<string, unknown>) {
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
    settings: { startDate: "2020-09-28", ...settings },
    targetLanguage: "it",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const [trip, everyday, work, fluent] = library.graph.skills.map((skill) => skill.skillId);
  return { goal, plan, skills: { everyday, fluent, trip, work } };
}

const WEEK = { dailyMinutes: 20, studyDays: [1, 2, 3, 4, 5] };

async function adviceEnd(goalId: string, aim?: "B1" | "C1"): Promise<string | null> {
  const result = await getPlanTimeAdvice({ goalId, input: { ...WEEK, aim } });
  return result.status === "ready" ? result.advice.endDate : null;
}

async function plannedSkills(planId: string): Promise<Set<string | null>> {
  const items = await prisma.planItem.findMany({ where: { planId } });
  return new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));
}

describe("a language goal's aim", () => {
  it("plans only the situations up to the aim, and a higher aim brings the next ones in", async () => {
    const { goal, plan, skills } = await setup({ level: "none", targetScore: "A2" }, NEW_PLAN);

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
    const { goal, plan, skills } = await setup({ level: "none", targetScore: "A2" }, NEW_PLAN);

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

  it("keeps a plan laid out before aims stopped there as it was, every band and a half band's hours", async () => {
    const { goal, plan, skills } = await setup({ level: "basic", targetScore: "B1+" }, OLDER_PLAN);

    await refreshGoalPlan({ goalId: goal.id, mode: "forced" });

    await expect(plannedSkills(plan.id)).resolves.toContain(skills.fluent);

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const graph = saved.graph as { skills: { lessons: number }[] };

    expect(graph.skills.reduce((total, skill) => total + skill.lessons, 0)).toBe(2044);
  });

  it("stops an older plan at its aim once the learner moves the aim", async () => {
    const { goal, plan, skills } = await setup({ level: "none", targetScore: "C1" }, OLDER_PLAN);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ aim: "B1", kind: "setAim" }] },
    });

    await expect(plannedSkills(plan.id)).resolves.not.toContain(skills.fluent);
  });

  it("dates each aim on the time question as the time question dates it once that aim is picked", async () => {
    const { goal } = await setup({ level: "none", targetScore: "A2" }, NEW_PLAN);
    await setUpPlanInSteps(goal.id);
    const [b1, c1] = await Promise.all([adviceEnd(goal.id, "B1"), adviceEnd(goal.id, "C1")]);

    expect(b1).not.toBeNull();
    expect(c1).not.toBe(b1);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ aim: "C1", kind: "setAim" }] },
    });

    await expect(adviceEnd(goal.id)).resolves.toBe(c1);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ aim: "B1", kind: "setAim" }] },
    });

    await expect(adviceEnd(goal.id)).resolves.toBe(b1);
  });

  it("previews each aim's end as the plan ends once that aim is applied", async () => {
    const { goal } = await setup({ level: "none", targetScore: "A2" }, NEW_PLAN);
    const input = { operations: [{ aim: "C1" as const, kind: "setAim" as const }] };
    const preview = await previewPlanChange({ goalId: goal.id, input });
    const end = preview.status === "ready" ? preview.preview.effect?.endDateAfter : undefined;

    expect(end).toStrictEqual(expect.any(String));

    await changeGoalPlan({ goalId: goal.id, input });
    const plan = await getGoalPlan(goal.id);

    expect(plan.status === "ready" ? plan.plan.estimate.endDate : null).toBe(end);
  });

  it("refuses an aim for a goal that isn't a language", async () => {
    const { goal } = await setup({ level: "none", targetScore: "A2" }, NEW_PLAN);
    await prisma.goal.update({ data: { kind: "learn" }, where: { id: goal.id } });

    await expect(
      changeGoalPlan({ goalId: goal.id, input: { operations: [{ aim: "B1", kind: "setAim" }] } }),
    ).resolves.toStrictEqual({ error: "notLanguage", status: "invalid" });
  });
});
