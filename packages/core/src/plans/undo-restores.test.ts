import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { readBlockPayload } from "../sessions/block-payload";
import { keptEndPlanFixture, readPlan } from "./_test-utils/kept-end-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { parsePlanSettings } from "./planner/plan-state";

const DAY = 86_400_000;

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

/** Today's session as the learner has it: its blocks in order, with what each holds. */
async function readDaySession(goalId: string) {
  const session = await prisma.studySession.findFirstOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { goalId },
  });

  return {
    blocks: session.blocks.map((block) => ({
      canDo: block.canDo,
      estimatedMinutes: block.estimatedMinutes,
      id: block.id,
      kind: block.kind,
      lessonId: block.lessonId,
      payload: block.payload,
      position: block.position,
      status: block.status,
    })),
    id: session.id,
    plannedMinutes: session.plannedMinutes,
    status: session.status,
  };
}

/** A built day of a plan whose first topic has an open mistake, so the day fixes it in practice. */
async function setupDayWithMistake({ dailyMinutes = 12 } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics"],
    skills: [{ area: "Math", lessons: 8 }],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  const skillId = library.skills[0]?.id ?? "";

  const [items] = await Promise.all([
    Promise.all(
      Array.from({ length: 3 }, () => itemFixture({ content: choiceItemContent(), skillId })),
    ),
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
  ]);

  await mistakeFixture({
    createdAt: new Date(NOW.getTime() - DAY),
    itemId: items[0]?.id,
    skillId,
    userId: user.id,
  });

  mockSession(user.id);
  await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

  return { goal };
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
    const { goal, plan } = await keptEndPlanFixture();
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
    const { goal, library, plan } = await keptEndPlanFixture();
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

  // Ana applied "Saturday becomes a rest day" on Today and undid it: the plan came back, but today's
  // session was built again, with other lessons and without her mistakes practice. Undo gives back
  // the very day she had, not a new one built like it: its blocks (the same rows, so a screen
  // showing one still reaches it), their order, the questions they ask and its minutes.
  it("gives back today's exact session, with its mistakes practice", async () => {
    const { goal } = await setupDayWithMistake();
    const day = await readDaySession(goal.id);
    const practice = day.blocks.find((block) => block.kind === "practice");

    expect(readBlockPayload({ id: "", payload: practice?.payload ?? {} }).drills).toHaveLength(1);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
    });

    const change = result.status === "applied" ? result.change : null;
    await expect(readDaySession(goal.id)).resolves.not.toStrictEqual(day);

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(readDaySession(goal.id)).resolves.toStrictEqual(day);
  });

  it("announces Undo once and restores the whole original queue, with a no-op replay", async () => {
    const { goal } = await setupDayWithMistake({ dailyMinutes: 15 });
    const original = await readDaySession(goal.id);
    expect(original.blocks).toHaveLength(4);

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
    });

    if (applied.status !== "applied" || !applied.change) {
      throw new Error("Expected the real undoable plan change");
    }

    const before = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    await expect(readDaySession(goal.id)).resolves.not.toStrictEqual(original);

    const decision = {
      changeId: applied.change.id,
      goalId: goal.id,
      input: { status: "undone" as const },
    };

    await expect(decidePlanChange(decision)).resolves.toMatchObject({ status: "updated" });
    await expect(readDaySession(goal.id)).resolves.toStrictEqual(original);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: before.id } }),
    ).resolves.toMatchObject({
      inputVersion: before.inputVersion + 2,
      version: before.version + 1,
    });

    const replay = await countDatabaseStatements(() => decidePlanChange(decision));
    expect(replay.result).toMatchObject({ status: "conflict" });
    expect(replay.writes).toBe(0);
    await expect(readDaySession(goal.id)).resolves.toStrictEqual(original);
  });

  // What the learner did between Apply and Undo is theirs: the lesson they finished stays done, and
  // the day they had comes back around it, without that lesson twice.
  it("keeps what the learner did since the change when it gives back today's session", async () => {
    const { goal } = await setupDayWithMistake();
    const day = await readDaySession(goal.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
    });

    const change = result.status === "applied" ? result.change : null;
    const changed = await readDaySession(goal.id);
    const done = changed.blocks.find((block) => block.kind === "learn");

    await prisma.studySessionBlock.update({
      data: { completedAt: NOW, startedAt: NOW, status: "completed" },
      where: { id: done?.id ?? "" },
    });

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    const after = await readDaySession(goal.id);
    const pending = day.blocks.filter((block) => block.lessonId !== done?.lessonId);

    expect(after.blocks.find((block) => block.id === done?.id)).toMatchObject({
      status: "completed",
    });

    expect(after.blocks.filter((block) => block.id !== done?.id)).toStrictEqual(
      pending.map((block) => ({ ...block, position: expect.any(Number) })),
    );

    expect(after.blocks.filter((block) => block.lessonId === done?.lessonId)).toHaveLength(1);
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

  it("restores an exam plan when the learner sets back time that changed its mock funding", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 30 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 45,
      details: { placementDeclined: true },
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-26"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const [shown, saved] = await Promise.all([
      readPlan(plan.id),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    ]);

    const funding = parsePlanSettings(saved.settings).mockFunding;
    expect(funding.length).toBeGreaterThan(0);

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 15 }] },
    });

    const change = changed.status === "applied" ? changed.change : null;
    const reduced = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(reduced.settings).mockFunding).not.toStrictEqual(funding);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 45 }] },
      }),
    ).resolves.toMatchObject({ change: { id: change?.id, status: "undone" }, status: "applied" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: saved.settings,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 45,
    });

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
