import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

const DAY = 86_400_000;

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

/** The plan as the learner sees it: its phases, and its items in order with their day and status. */
async function readPlan(planId: string) {
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

/**
 * A plan of two phases whose first ends two days after its lessons do, as a run that kept the end
 * the learner saw leaves it: its challenge is on that day, and the next phase starts after it.
 * Planned again, that end and challenge move back to the lessons.
 */
async function setupKeptEnd() {
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

  const [first, second] = created.phases as { endDate: string; startDate: string }[];
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

  return { goal, library, plan };
}

describe("undoing a change in the app", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // R38. Planned again from the state before the change, an undo moved what earlier runs kept:
  // after a light week, 243 items and every phase end of a career plan (seed 1005).
  it("puts back the phase end and the days an earlier run kept, not a plan made again", async () => {
    const { goal, plan } = await setupKeptEnd();
    const shown = await readPlan(plan.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    const change = result.status === "applied" ? result.change : null;
    await expect(readPlan(plan.id)).resolves.not.toStrictEqual(shown);

    await expect(
      decidePlanChange({
        changeId: change?.id ?? "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);
  });

  // Class test seed 1002: undoing placement's test-outs planned the plan again, which left the
  // skipped lessons as todo rows on day one, beside the lessons laid out without them. Each comes
  // back on the day it had, with every other item as it was.
  it("puts back the lessons a test-out skipped on the days they had", async () => {
    const { goal, library, plan } = await setupKeptEnd();
    const [shown, goalPlan] = await Promise.all([readPlan(plan.id), loadGoalPlan(goal.id)]);

    const { changeId } = await markPlanItemsTestedOut({
      goalId: goal.id,
      items: goalPlan.items,
      knownSkillIds: new Set([library.skills[0]?.id ?? ""]),
      testedOutAt: NOW,
      timeZone: "UTC",
    });

    await expect(readPlan(plan.id)).resolves.not.toStrictEqual(shown);

    await decidePlanChange({
      changeId: changeId ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);
  });

  // Marcos moved his date and undid it: the plan came back, but today's session went from 3
  // activities to 6, with lessons being written. Undo gives back the day the learner had.
  it("gives back today's session as the learner had it", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["Basics"],
      skills: [
        { area: "Math", lessons: 8 },
        { area: "Biology", lessons: 0, size: 6 },
      ],
    });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const readDay = async () => {
      const day = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
      const blocks = day.status === "ready" ? day.session.blocks : [];
      return blocks.map((block) => [block.kind, block.lessonId ?? null]);
    };

    const day = await readDay();

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
    });

    const change = result.status === "applied" ? result.change : null;

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(day.length).toBeGreaterThan(0);
    await expect(readDay()).resolves.toStrictEqual(day);
  });

  // Ana set her time to 15 minutes and back to 45 in the editor: the plan, Today and her subjects'
  // shares came back different from the ones she had. Setting the old value back is Undo.
  it("undoes the latest change when the learner sets back by hand what it changed", async () => {
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
    const shown = await readPlan(plan.id);

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    const change = changed.status === "applied" ? changed.change : null;

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 12 }] },
      }),
    ).resolves.toMatchObject({ change: { id: change?.id, status: "undone" }, status: "applied" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "applied" } }),
    ).resolves.toBe(0);
  });

  // Language seed 1054: the learner applied Today's "move phase dates", then picked
  // the practice mix their plan already had. Moving phase dates changes no setting, so the edit
  // read as setting it back, and the dates they had just accepted went back without a word.
  it("never takes an edit that changes nothing as the Undo of a change that set nothing", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 4 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);
    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const moved = await planChangeFixture({
      kind: "edited",
      payload: toPlanChangePayload({
        operations: [{ kind: "fitPhaseDates" }],
        source: "learner",
        versionAfter: version,
      }),
      planId: plan.id,
      status: "applied",
    });

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ bias: "balanced", kind: "setPracticeBias" }] },
      }),
    ).resolves.not.toMatchObject({ change: { id: moved.id } });

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: moved.id } }),
    ).resolves.toMatchObject({ status: "applied" });
  });

  it("can't undo once the Library deleted a lesson the plan before had", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 4 }] });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
    });

    const change = result.status === "applied" ? result.change : null;
    await prisma.lesson.delete({ where: { id: library.lessons[0]?.id ?? "" } });

    await expect(
      decidePlanChange({
        changeId: change?.id ?? "",
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });
});
