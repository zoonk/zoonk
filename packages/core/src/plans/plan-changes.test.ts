import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposePlanChange } from "./propose-plan-change";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics"],
    skills: [
      { area: "Math", lessons: 8 },
      { area: "Biology", lessons: 6 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, user };
}

function lastDate(planId: string) {
  return prisma.planItem
    .aggregate({ _max: { scheduledFor: true }, where: { planId } })
    .then((result) => result._max.scheduledFor?.toISOString().slice(0, 10));
}

describe("plan changes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves no focus that would move nothing, and says why", async () => {
    const { goal, plan } = await setup();

    // Every lesson fits and Math already comes first: focusing it moves nothing.
    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Math"], kind: "focusAreas" }] },
      }),
    ).resolves.toStrictEqual({ reason: "alreadyIn", status: "unchanged" });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(stored.settings).not.toMatchObject({ focusAreas: ["Math"] });
    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);

    // The focus test's choice is kept even then: its result names the focus it chose.
    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Math"], kind: "focusAreas" }] },
        saveFocusAnyway: true,
      }),
    ).resolves.toMatchObject({ status: "applied" });
  });

  it("applies the learner's change, re-plans from today and lets them undo it", async () => {
    const { goal, plan } = await setup();
    const before = await lastDate(plan.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [1, 2] }] },
    });

    expect(result).toMatchObject({
      change: { canUndo: true, kind: "edited", reason: null, source: "learner", status: "applied" },
      status: "applied",
    });

    const moved = await lastDate(plan.id);
    expect(moved && before && moved > before).toBe(true);

    const change = result.status === "applied" ? result.change : null;

    const undone = await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undone).toMatchObject({
      change: { canUndo: false, status: "undone" },
      status: "updated",
    });

    await expect(lastDate(plan.id)).resolves.toBe(before);

    const settings = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(settings.settings).toMatchObject({ weekdayMinutes: null });
  });

  it("refuses changes that can't apply and changes to other learners' plans", async () => {
    const { goal } = await setup();

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["History"], kind: "focusAreas" }] },
      }),
    ).resolves.toStrictEqual({ error: "unknownArea", status: "invalid" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("applies a proposal of one lesson at once and holds a bigger one for the learner's OK", async () => {
    const { goal, library, plan } = await setup();

    const [extra] = await planLibraryFixture({ skills: [{ lessons: 1 }] }).then(
      (more) => more.skills,
    );

    const anchor = library.skills[1]?.id ?? null;

    const small = await proposePlanChange({
      goalId: goal.id,
      operations: [
        {
          kind: "addSkills",
          skills: [
            {
              area: null,
              beforeSkillId: anchor,
              lessons: 1,
              name: "Fractions",
              skillId: extra?.id ?? "",
            },
          ],
        },
      ],
      reason: "I added a short lesson on fractions.",
      source: "mistakes",
    });

    expect(small.status).toBe("applied");

    const big = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 5 }],
      reason: "Your evenings are busy, so I made days shorter.",
      source: "memory",
    });

    expect(big.status).toBe("proposed");

    const items = await prisma.planItem.findMany({
      select: { skillId: true },
      where: { planId: plan.id },
    });

    expect(items.map((item) => item.skillId)).toContain(extra?.id);

    const goalBefore = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(goalBefore.dailyMinutes).toBe(12);

    const accepted = await decidePlanChange({
      changeId: "changeId" in big ? big.changeId : "",
      goalId: goal.id,
      input: { status: "applied" },
    });

    expect(accepted).toMatchObject({
      change: {
        canUndo: true,
        reason: "Your evenings are busy, so I made days shorter.",
        status: "applied",
      },
      status: "updated",
    });

    const goalAfter = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(goalAfter.dailyMinutes).toBe(5);

    await expect(
      decidePlanChange({
        changeId: "changeId" in big ? big.changeId : "",
        goalId: goal.id,
        input: { status: "declined" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("declines a proposal without touching the plan", async () => {
    const { goal, plan } = await setup();
    const before = await lastDate(plan.id);

    const proposal = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 5 }],
      reason: "Shorter days.",
      source: "memory",
    });

    const declined = await decidePlanChange({
      changeId: "changeId" in proposal ? proposal.changeId : "",
      goalId: goal.id,
      input: { status: "declined" },
    });

    expect(declined).toMatchObject({ change: { status: "declined" }, status: "updated" });
    await expect(lastDate(plan.id)).resolves.toBe(before);
  });

  it("marks an applied change seen without touching the plan, and never a proposal", async () => {
    const { goal, plan } = await setup();

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    const before = await lastDate(plan.id);

    const seen = await decidePlanChange({
      changeId: applied.status === "applied" ? (applied.change?.id ?? "") : "",
      goalId: goal.id,
      input: { status: "seen" },
    });

    expect(seen).toMatchObject({
      change: { canUndo: true, seen: true, status: "applied" },
      status: "updated",
    });

    await expect(lastDate(plan.id)).resolves.toBe(before);

    const proposal = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 5 }],
      reason: "Shorter days.",
      source: "memory",
    });

    await expect(
      decidePlanChange({
        changeId: "changeId" in proposal ? proposal.changeId : "",
        goalId: goal.id,
        input: { status: "seen" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("only undoes the latest edit", async () => {
    const { goal } = await setup();

    const change = (minutes: number) =>
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes }] },
      });

    const first = await change(20);
    await change(30);

    await expect(
      decidePlanChange({
        changeId: first.status === "applied" ? (first.change?.id ?? "") : "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it(`makes "harder" harder now: the basics of a subject the learner does well in leave the plan`, async () => {
    const user = await userFixture();

    // Two subjects, each with its basics in the first phase and what builds on them in the next.
    const library = await planLibraryFixture({
      phases: ["Basics", "Further"],
      skills: [
        { area: "Math", lessons: 4, phase: 0 },
        { area: "Biology", lessons: 3, phase: 0 },
        { area: "Math", lessons: 4, phase: 1 },
        { area: "Biology", lessons: 3, phase: 1 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    // Right every time in math's first lessons; nothing in biology yet.
    await Promise.all(
      Array.from({ length: 8 }, () =>
        attemptFixture({ skillId: library.skills[0]?.id ?? "", userId: user.id }),
      ),
    );

    const todoLessons = (skillIndex: number) =>
      prisma.planItem.count({
        where: { planId: plan.id, skillId: library.skills[skillIndex]?.id, status: "todo" },
      });

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ bias: "harder", kind: "setDifficultyBias" }] },
    });

    expect(result).toMatchObject({
      change: { effect: { lessonsRemoved: 4 }, status: "applied" },
      status: "applied",
    });

    // Math starts past its basics; biology, not shown yet, and math's next part stay.
    await expect(
      Promise.all([0, 1, 2, 3].map((index) => todoLessons(index))),
    ).resolves.toStrictEqual([0, 3, 4, 3]);

    const change = result.status === "applied" ? result.change : null;

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(todoLessons(0)).resolves.toBe(4);
  });
});
