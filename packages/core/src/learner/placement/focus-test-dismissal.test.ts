import { prisma } from "@zoonk/db";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replanWaitingGoal } from "../../library/curriculum/replan-waiting-goals";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { getTodayView } from "../../view-models/today/get-today-view";
import { PLAN_SHOWN, shortPlanExamGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";

const TIME_ZONE = "UTC";

async function sit(goalId: string, answers: number) {
  let placement = await startSitting(goalId);

  for (let index = 0; index < answers && placement.next; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
    const result = await answerPlacementQuestion({
      goalId,
      input: { answer: { dontKnow: true }, durationMs: 20_000, itemId: placement.next.itemId },
    });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    placement = result.placement;
  }

  const result = await finishGoalPlacement({ goalId, input: {} });
  return result.status === "ready" ? result.completion.focusTest : null;
}

async function read(goalId: string) {
  const [view, plan, changes, today] = await Promise.all([
    getGoalPlacement({ goalId }),
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
    prisma.planChange.findMany({
      orderBy: { createdAt: "asc" },
      select: { status: true },
      where: { payload: { equals: "focusTest", path: ["source"] }, plan: { goalId } },
    }),
    getTodayView({ goalId, timeZone: TIME_ZONE }),
  ]);

  const test = view.status === "ready" ? view.placement.focusTest : null;
  const focus = test?.checkpoint?.focus ?? null;

  return {
    areas: focus?.rows.flatMap((row) => row.areas) ?? null,
    focus: focus?.state ?? null,
    focusTestChanges: changes.map((change) => change.status),
    planVersion: plan.version,
    todayAsks:
      today.status === "ready" && today.today.planChange
        ? `${today.today.planChange.source}:${today.today.planChange.status}`
        : null,
  };
}

function mockNow() {
  const now = new Date();

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    currentInstant: now,
    timeZone: TIME_ZONE,
  });
}

async function proposal(goalId: string) {
  const finished = await sit(goalId, 1);
  return finished?.checkpoint?.focus?.proposal?.id ?? "";
}

describe("Focus test dismissals after replanning", () => {
  afterEach(() => vi.useRealTimers());

  it.each(["declined", "undone"] as const)("%s, then the next study day", async (status) => {
    const { goal } = await shortPlanExamGoalFixture({
      goal: { ...PLAN_SHOWN, timezone: TIME_ZONE },
    });

    const changeId = await proposal(goal.id);

    if (status === "undone") {
      await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });
    }

    const before = await read(goal.id);
    const decided = await decidePlanChange({ changeId, goalId: goal.id, input: { status } });
    expect(decided.status).toBe("updated");

    mockNow();
    await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + MS_PER_DAY);
    mockNow();
    await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });

    const replanned = await read(goal.id);
    expect(replanned.planVersion).toBeGreaterThan(before.planVersion);

    await sit(goal.id, 1);
    const settled = await read(goal.id);

    expect(settled.areas).toStrictEqual(before.areas);
    expect(settled.focus).toBe("handPicked");
    expect(settled.focusTestChanges).toStrictEqual([status]);
    expect(settled.todayAsks).not.toBe("focusTest:proposed");
  });

  it("applied, lessons written (Undo kept open), then Undo", async () => {
    const { goal } = await shortPlanExamGoalFixture({
      goal: { ...PLAN_SHOWN, timezone: TIME_ZONE },
    });

    const changeId = await proposal(goal.id);
    await decidePlanChange({ changeId, goalId: goal.id, input: { status: "applied" } });

    const skill = await prisma.planItem.findFirstOrThrow({
      select: { skillId: true },
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    await Promise.all(
      Array.from({ length: 4 }, async () => {
        const lesson = await libraryLessonFixture({ estimatedMinutes: 3 });
        await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.skillId ?? "" });
      }),
    );

    await replanWaitingGoal(goal.id);

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: changeId } }),
    ).resolves.toMatchObject({ payload: { replannedSince: true }, status: "applied" });

    const undone = await decidePlanChange({
      changeId,
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undone.status).toBe("updated");
    const beforeSettle = await read(goal.id);
    expect(beforeSettle.focus).toBe("handPicked");
    expect(beforeSettle.focusTestChanges).toStrictEqual(["undone"]);
    expect(beforeSettle.todayAsks).toBeNull();

    await sit(goal.id, 0);
    const settled = await read(goal.id);
    expect(settled.areas).toStrictEqual(beforeSettle.areas);
    expect(settled.focus).toBe("handPicked");
    expect(settled.focusTestChanges).toStrictEqual(["undone"]);
    expect(settled.todayAsks).not.toBe("focusTest:proposed");
  });
});
