import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Monday in 2020, before the learning events other tests write (see `plan-changes.test.ts`). */
const NOW = new Date("2020-09-28T12:00:00Z");
const TARGET = "2020-11-08";

/**
 * An exam six weeks away with two subjects and a redação of three written-test skills, an hour a
 * day: time for everything, so the final weeks hold the redação at under half of each day.
 */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Preparação"],
    skills: [
      { area: "Matemática", lessons: 12 },
      { area: "Biologia", lessons: 12 },
      { area: "Redação", lessons: 6 },
      { area: "Redação", lessons: 6 },
      { area: "Redação", lessons: 6 },
    ],
  });

  // The skill graph gives an exam outcome skills only for the parts answered in writing.
  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill) =>
      skill.area === "Redação" ? { ...skill, outcome: true } : skill,
    ),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date(`${TARGET}T00:00:00Z`),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  const redacao = new Set(
    graph.skills.filter((skill) => skill.outcome).map((skill) => skill.skillId),
  );

  return { goal, plan, redacao };
}

/** The days the plan's redação lessons are due, in order. */
async function writtenDays({ planId, redacao }: { planId: string; redacao: Set<string> }) {
  const items = await prisma.planItem.findMany({
    orderBy: { scheduledFor: "asc" },
    where: { kind: "lesson", planId, skillId: { in: [...redacao] } },
  });

  return items.map((item) => item.scheduledFor?.toISOString().slice(0, 10) ?? "");
}

describe("the written tests' cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves the redação's lessons to the final weeks, keeps them all, and undoes", async () => {
    const { goal, plan, redacao } = await setup();
    const weekly = await writtenDays({ planId: plan.id, redacao });

    // Every week by default: the redação starts in the plan's first week.
    expect(weekly[0] && weekly[0] < "2020-10-05").toBe(true);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ cadence: "finalWeeks", kind: "setWrittenCadence" }] },
    });

    expect(result).toMatchObject({ status: "applied" });

    const final = await writtenDays({ planId: plan.id, redacao });

    // The final weeks of a six-week plan: its last three, from 18 Oct.
    expect(final).toHaveLength(weekly.length);
    expect(final.every((day) => day >= "2020-10-18" && day < TARGET)).toBe(true);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { writtenCadence: "finalWeeks" },
    });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: {
        writtenPractice: {
          cadence: "finalWeeks",
          finalWeeksFrom: "2020-10-18",
          parts: ["Redação"],
        },
      },
    });

    const change = result.status === "applied" ? result.change : null;

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(writtenDays({ planId: plan.id, redacao })).resolves.toStrictEqual(weekly);
  });

  it("keeps the redação out of the plan's every other week", async () => {
    const { goal, plan, redacao } = await setup();
    const weekly = await writtenDays({ planId: plan.id, redacao });

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ cadence: "biweekly", kind: "setWrittenCadence" }] },
    });

    const biweekly = await writtenDays({ planId: plan.id, redacao });

    // Weeks run Monday to Sunday from 28 Sep: the second (5 to 11 Oct) and the fourth have none.
    const offWeeks = biweekly.filter(
      (day) =>
        (day >= "2020-10-05" && day <= "2020-10-11") ||
        (day >= "2020-10-19" && day <= "2020-10-25"),
    );

    expect(biweekly).toHaveLength(weekly.length);
    expect(offWeeks).toStrictEqual([]);
  });
});
