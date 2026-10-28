import { prisma } from "@zoonk/db";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import * as replan from "./_utils/commit-plan";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import * as planContext from "./_utils/plan-context";
import { bringBackMissedLessons } from "./bring-back-missed-lessons";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Sunday in 2020, before the learning events other tests write, which estimates read. */
const SUNDAY = new Date("2020-09-27T12:00:00Z");

/** Just enough days for the plan as first estimated, so keeping its phase dates leaves lessons out. */
const TIGHT = new Date("2020-10-17T00:00:00Z");

/**
 * A two-phase plan whose outlined lessons land shorter in the first phase and longer in the
 * second: keeping the phase dates leaves lessons out by the goal's date, so every write that keeps
 * them asks to move them right after it commits. `refresh: false` leaves the plan before the
 * refresh that plans those lessons and asks first.
 */
async function setup({ refresh = true }: { refresh?: boolean } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Projects"],
    skills: [
      { lessons: 4, phase: 0 },
      { lessons: 0, phase: 0, size: 10 },
      { lessons: 6, phase: 1 },
      { lessons: 0, phase: 1, size: 5 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-27" },
    targetDate: TIGHT,
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const outline = async ({ count, minutes, skill }: Record<string, number>) => {
    const spec = library.graph.skills[skill ?? 0];
    const chapterId = library.chapters[spec?.phase ?? 0]?.id ?? "";

    await Promise.all(
      Array.from({ length: count ?? 0 }, async (_, index) => {
        const lesson = await libraryLessonFixture({
          estimatedMinutes: minutes,
          homeChapterId: chapterId,
          title: `Outlined ${skill}.${index} ${crypto.randomUUID()}`,
        });

        await Promise.all([
          chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 500 + index }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: spec?.skillId ?? "" }),
        ]);
      }),
    );
  };

  await outline({ count: 10, minutes: 1, skill: 1 });
  await outline({ count: 5, minutes: 8, skill: 3 });

  if (refresh) {
    await refreshGoalPlan({ goalId: goal.id });
  }

  return { goal, library, plan };
}

/**
 * Another write marks the plan once, right after the next plan write commits, before the request
 * that made it ends. Only the order is the test's; the writes are real.
 */
function markAfterPlanWrite(planId: string) {
  const commit = replan.commitPlan;

  return vi.spyOn(replan, "commitPlan").mockImplementationOnce(async (input) => {
    const changeId = await commit(input);
    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [planId] }));
    return changeId;
  });
}

function readPlan(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    select: { graph: true, phases: true, settings: true },
    where: { id: planId },
  });
}

/*
 * Each write asked to move the phase dates after it committed; the other write made that ask lose,
 * and the retry around the whole write ran it again.
 */
describe("a plan write when another write lands right after it commits", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // The learner's change applied twice: the second took the first one's undo snapshot.
  it("applies the learner's change once, and its Undo puts the plan back", async () => {
    const { goal, plan } = await setup();
    const before = await readPlan(plan.id);
    const marked = markAfterPlanWrite(plan.id);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: ["Projects"], kind: "reduceAreas" }], timeZone: "UTC" },
    });

    expect(marked).toHaveBeenCalledOnce();

    const applied = await prisma.planChange.findMany({
      include: { snapshot: true },
      where: { kind: "edited", planId: plan.id, status: "applied" },
    });

    expect(applied).toHaveLength(1);

    const [change] = applied;

    expect(change?.snapshot).not.toBeNull();
    expect(result).toMatchObject({ change: { canUndo: true, id: change?.id }, status: "applied" });

    await expect(
      decidePlanChange({
        changeId: change?.id ?? "",
        goalId: goal.id,
        input: { status: "undone", timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ change: { id: change?.id, status: "undone" }, status: "updated" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(before);
  });

  // The retry read the proposal it had just applied and answered "conflict".
  it("answers a proposal the learner applied as applied", async () => {
    const { goal, plan } = await setup();

    const proposal = await prisma.planChange.create({
      data: {
        kind: "edited",
        payload: toPlanChangePayload({
          operations: [{ areas: ["Projects"], kind: "reduceAreas" }],
          source: "buddy",
        }),
        planId: plan.id,
        reason: "Less of Projects for now.",
        status: "proposed",
      },
    });

    const marked = markAfterPlanWrite(plan.id);

    const result = await decidePlanChange({
      changeId: proposal.id,
      goalId: goal.id,
      input: { status: "applied", timeZone: "UTC" },
    });

    expect(marked).toHaveBeenCalledWith(expect.objectContaining({ restorable: proposal.id }));

    expect(result).toMatchObject({
      change: { canUndo: true, id: proposal.id, status: "applied" },
      status: "updated",
    });
  });

  // The retry found nothing left to bring back and recorded a second relearn change with nothing
  // in it. A relearn has no undo, so it keeps no snapshot.
  it("brings missed lessons back once", async () => {
    const { goal, library, plan } = await setup();
    const skillId = library.graph.skills[0]?.skillId ?? "";

    // Placement took the first skill as known, then the learner missed a question on it.
    await prisma.planItem.updateMany({
      data: { completedAt: SUNDAY, status: "testedOut" },
      where: { kind: "lesson", planId: plan.id, skillId },
    });

    const marked = markAfterPlanWrite(plan.id);

    await bringBackMissedLessons({
      goalId: goal.id,
      now: SUNDAY,
      skillIds: [skillId],
      timeZone: "UTC",
    });

    expect(marked).toHaveBeenCalledOnce();

    const relearned = await prisma.planChange.findMany({
      where: { kind: "relearn", planId: plan.id, status: "applied" },
    });

    expect(relearned).toHaveLength(1);
    expect(parsePlanChangePayload(relearned[0]?.payload).carriedItemIds).toHaveLength(4);

    await expect(
      prisma.planItem.count({
        where: { kind: "lesson", planId: plan.id, skillId, status: "todo" },
      }),
    ).resolves.toBe(4);
  });

  // The retry planned the saved plan again and said it was unchanged.
  it("refreshes the plan once", async () => {
    const { goal, plan } = await setup({ refresh: false });
    const marked = markAfterPlanWrite(plan.id);
    const loads = vi.spyOn(planContext, "loadPlanContext");

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "refreshed",
    });

    expect(marked).toHaveBeenCalledOnce();
    expect(loads).toHaveBeenCalledOnce();
  });
});
