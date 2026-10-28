import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposePlanChange } from "./propose-plan-change";

/** Before other tests' learning events, so their pace never changes these plans. */
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

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Math"], kind: "focusAreas" }] },
      }),
    ).resolves.toStrictEqual({ reason: "alreadyIn", status: "unchanged" });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(stored.settings).not.toMatchObject({ focusAreas: ["Math"] });
    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);

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

  it("says when a focused area starts against the plan the learner sees", async () => {
    const { goal, library, plan } = await setup();
    const biology = library.skills[1]?.id ?? "";

    await prisma.planItem.updateMany({
      data: { scheduledFor: new Date("2020-10-09T00:00:00Z") },
      where: { planId: plan.id, skillId: biology },
    });

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: ["Biology"], kind: "focusAreas" }] },
    });

    expect(result.status === "applied" && result.change?.effect?.areaStarts).toStrictEqual([
      { after: "2020-09-29", area: "Biology", before: "2020-10-09" },
    ]);
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

  it("keeps today's lessons when the learner adds a topic", async () => {
    const { goal, library, plan } = await setup();

    const [extra] = await planLibraryFixture({ skills: [{ area: "Math", lessons: 3 }] }).then(
      (more) => more.skills,
    );

    const readToday = () =>
      prisma.planItem
        .findMany({
          orderBy: { position: "asc" },
          select: { lessonId: true, skillId: true },
          where: { planId: plan.id, scheduledFor: new Date("2020-09-28T00:00:00Z") },
        })
        .then((items) => items.map((item) => item.lessonId ?? item.skillId));

    const today = await readToday();

    const proposed = await proposePlanChange({
      goalId: goal.id,
      operations: [
        {
          kind: "addSkills",
          skills: [
            {
              area: "Math",
              beforeSkillId: library.skills[0]?.id ?? null,
              lessons: 3,
              name: "Fractions",
              skillId: extra?.id ?? "",
            },
          ],
        },
      ],
      reason: "Starting with fractions, as you asked.",
      source: "buddy",
    });

    const result =
      proposed.status === "proposed"
        ? await decidePlanChange({
            changeId: proposed.changeId,
            goalId: goal.id,
            input: { status: "applied" },
          })
        : proposed;

    expect(result.status).toMatch(/applied|updated/u);
    expect(today.length).toBeGreaterThan(0);
    await expect(readToday()).resolves.toStrictEqual(today);
  });

  it("says about how many lessons a topic adds while its lessons aren't written", async () => {
    const { goal } = await setup();

    const [extra] = await planLibraryFixture({ skills: [{ area: "Math", lessons: 0 }] }).then(
      (more) => more.skills,
    );

    const proposed = await proposePlanChange({
      goalId: goal.id,
      operations: [
        {
          kind: "addSkills",
          skills: [
            {
              area: "Math",
              beforeSkillId: null,
              lessons: 4,
              name: "Dividends",
              skillId: extra?.id ?? "",
            },
          ],
        },
      ],
      reason: "Adding dividends, as you asked.",
      source: "buddy",
    });

    const change = await prisma.planChange.findUniqueOrThrow({
      where: { id: "changeId" in proposed ? proposed.changeId : "" },
    });

    expect(parsePlanChangePayload(change.payload).effect).toMatchObject({
      lessonsAdded: 4,
      lessonsAddedEstimated: true,
    });
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

    const library = await planLibraryFixture({
      phases: ["Basics", "Further"],
      skills: [
        { area: "Math", lessons: 4, phase: 0 },
        { area: "Biology", lessons: 3, phase: 0 },
        { area: "Math", builds: 0, lessons: 4, phase: 1 },
        { area: "Biology", builds: 1, lessons: 3, phase: 1 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

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
