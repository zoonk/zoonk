import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeOwnLevel } from "./change-own-level";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";
import { parsePlanGraph } from "./planner/plan-state";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Monday in 2020, before other tests' learning events, so pace estimates don't move dates. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TIME_ZONE = "UTC";

/** A two-phase plan of four skills whose learner said "intermediate" in onboarding. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Next"],
    skills: [
      { lessons: 1, phase: 0 },
      { lessons: 1, phase: 0 },
      { lessons: 1, phase: 1 },
      { lessons: 1, phase: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    details: { level: "intermediate" },
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, user };
}

function change(goalId: string, level: "advanced" | "basic" | "intermediate" | "none") {
  return changeOwnLevel({ goalId, input: { level, timeZone: TIME_ZONE } });
}

async function graphSkillIds(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return parsePlanGraph(plan.graph).skills.map((skill) => skill.skillId);
}

describe(changeOwnLevel, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lowering adds the missing foundations first, keeps tested-out work, and can be undone", async () => {
    const { goal, library, plan } = await setup();
    const [first] = library.skills;
    const foundation = await skillFixture({ name: `Counting ${randomUUID()}` });

    await skillPrerequisiteFixture({ prerequisiteId: foundation.id, skillId: first?.id ?? "" });

    const testedOut = await prisma.planItem.findFirstOrThrow({
      where: { planId: plan.id, skillId: null },
    });

    await prisma.planItem.update({
      data: { completedAt: NOW, status: "testedOut" },
      where: { id: testedOut.id },
    });

    const result = await change(goal.id, "basic");

    expect(result).toMatchObject({
      ownLevel: { direction: "lower", level: "basic", testOuts: [] },
      status: "ready",
    });

    const added = result.status === "ready" ? result.ownLevel.change : null;

    expect(added).toMatchObject({ canUndo: true, reason: null, source: "ownLevel" });

    expect(added?.operations).toStrictEqual([
      {
        kind: "addSkills",
        skills: [
          {
            area: null,
            beforeSkillId: first?.id,
            lessons: 1,
            name: foundation.name,
            skillId: foundation.id,
          },
        ],
      },
    ]);

    // The foundation comes right before the skill it prepares for.
    await expect(graphSkillIds(plan.id)).resolves.toStrictEqual([
      foundation.id,
      ...library.skills.map((skill) => skill.id),
    ]);

    const [storedGoal, keptItem] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: testedOut.id } }),
    ]);

    expect(storedGoal.details).toMatchObject({ level: "basic" });
    expect(keptItem.status).toBe("testedOut");

    const undone = await decidePlanChange({
      changeId: added?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undone.status).toBe("updated");
    await expect(graphSkillIds(plan.id)).resolves.not.toContain(foundation.id);
  });

  it("lowering adds nothing when the plan already starts from its foundations", async () => {
    const { goal } = await setup();

    const result = await change(goal.id, "none");

    expect(result).toMatchObject({
      ownLevel: { change: null, direction: "lower", level: "none", testOuts: [] },
      status: "ready",
    });

    const plan = await getGoalPlan(goal.id);
    expect(plan.status === "ready" && plan.plan.ownLevel).toBe("none");
  });

  it("raising offers test-outs for the chapters the new level covers and skips nothing", async () => {
    const { goal, library, plan } = await setup();
    const before = await prisma.planItem.findMany({ where: { planId: plan.id } });

    const result = await change(goal.id, "advanced");

    expect(result).toMatchObject({
      ownLevel: { change: null, direction: "higher", level: "advanced" },
      status: "ready",
    });

    expect(result.status === "ready" ? result.ownLevel.testOuts : []).toStrictEqual([
      { chapterId: library.chapters[0]?.id, title: library.chapters[0]?.title },
      { chapterId: library.chapters[1]?.id, title: library.chapters[1]?.title },
    ]);

    const after = await prisma.planItem.findMany({ where: { planId: plan.id } });

    expect(after.map((item) => item.status)).toStrictEqual(before.map((item) => item.status));
  });

  it("changes only the learner's own goals", async () => {
    const { goal } = await setup();

    const other = await userFixture();
    mockSession(other.id);
    await expect(change(goal.id, "basic")).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);
    await expect(change(goal.id, "basic")).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
