import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { PHASE_WORK_KINDS } from "../../plans/planner/plan-item-rules";
import { refreshTestedOutPlan } from "../../plans/refresh-tested-out-plan";
import { seedPersonaCopy } from "../../seed/seed";
import { openStudyDay } from "../../sessions/open-study-day";
import { gradePlacementAnswer, parsePlacementItem } from "./_utils/placement-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { placementAnswerInputSchema } from "./placement-contract";
import { startPlacementSitting } from "./start-placement-sitting";

async function finishStockTest(goalId: string) {
  const started = await startPlacementSitting({ goalId, input: {} });

  if (started.status !== "ready" || !started.placement.attempt) {
    throw new Error("Expected the seeded course test");
  }

  const attemptId = started.placement.attempt.id;

  async function answerNext(itemId: string): Promise<void> {
    const item = parsePlacementItem(await prisma.item.findUniqueOrThrow({ where: { id: itemId } }));

    if (!item) {
      throw new Error("Expected a seeded placement question");
    }

    const { correctAnswer } = gradePlacementAnswer({ answer: { dontKnow: true }, item });

    const result = await answerPlacementQuestion({
      goalId,
      input: placementAnswerInputSchema.parse({
        answer: correctAnswer,
        attemptId,
        durationMs: 1200,
        itemId,
      }),
    });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    if (result.placement.next) {
      await answerNext(result.placement.next.itemId);
    }
  }

  await answerNext(started.placement.next!.itemId);
  const finished = await finishGoalPlacement({ goalId, input: { attemptId } });

  if (
    finished.status !== "ready" ||
    !finished.completion.changeId ||
    !finished.completion.result?.nextLesson
  ) {
    throw new Error("Expected a new starting lesson and Undo");
  }

  const { changeId, lessonsSkipped, testedOutPlanItemIds } = finished.completion;

  return {
    changeId,
    lessonsSkipped,
    next: finished.completion.result.nextLesson,
    testedOutPlanItemIds,
  };
}

async function placePedro() {
  vi.setSystemTime(new Date("2026-11-27T16:00:00Z"));
  const copyKey = randomUUID();

  const { goalId, userId } = await seedPersonaCopy({
    copyKey,
    email: `pedro-${copyKey}@zoonk.test`,
    language: "en",
    persona: "stocks",
    state: "placement",
    timeZone: "UTC",
  });
  // Imported sessions precede the simulated finish. Their database default otherwise uses wall time.
  await prisma.$executeRaw`UPDATE study_sessions SET created_at = local_date WHERE goal_id = ${goalId}::uuid`;
  mockSession(userId);

  const items = () =>
    prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        kind: true,
        lessonId: true,
        phase: true,
        status: true,
        titleSnapshot: true,
      },
      where: { plan: { goalId } },
    });

  const before = await items();
  const finished = await finishStockTest(goalId);
  const after = await items();

  const previouslyTodo = new Set(
    before.filter((item) => item.status === "todo").map((item) => item.id),
  );

  const skipped = after.filter(
    (item) => item.status === "testedOut" && previouslyTodo.has(item.id),
  );

  expect(new Set(finished.testedOutPlanItemIds)).toStrictEqual(
    new Set(skipped.map((item) => item.id)),
  );

  expect(finished.lessonsSkipped).toBe(skipped.filter((item) => item.kind === "lesson").length);

  const start = after.find((item) => item.lessonId === finished.next.id)!;
  expect(start.phase).toBe(3);
  await refreshTestedOutPlan({ goalId, userId });
  const view = await getGoalPlan(goalId);

  if (view.status !== "ready") {
    throw new Error(view.status);
  }

  expect(view.plan.currentPhase).toBe(start.phase);
  expect(view.plan.phases[start.phase]).toMatchObject({ state: "current" });

  expect(
    view.plan.phases.slice(0, start.phase).map(({ checkpoint, state }) => ({ checkpoint, state })),
  ).toStrictEqual(Array.from({ length: start.phase }, () => ({ checkpoint: null, state: "done" })));

  const earlier = after.filter(
    (item) => item.phase < start.phase && PHASE_WORK_KINDS.has(item.kind),
  );

  expect(earlier.filter((item) => item.status === "todo")).toStrictEqual([]);

  return { before, finished, goalId, items, userId };
}

async function openFirstBlock(goalId: string, shownDate = "2026-11-28") {
  const now = new Date(`${shownDate}T16:00:00Z`);
  const opened = await openStudyDay({ goalId, shownDate, timeZone: "UTC" }, now);

  if (opened.status !== "opened") {
    throw new Error(opened.status);
  }

  return prisma.studySessionBlock.findFirstOrThrow({
    orderBy: { position: "asc" },
    where: { sessionId: opened.sessionId },
  });
}

describe("the next study day after course placement", () => {
  it("opens the lesson shown on Pedro's Plan", async () => {
    const { finished, goalId } = await placePedro();

    await expect(openFirstBlock(goalId)).resolves.toMatchObject({
      kind: "learn",
      lessonId: finished.next.id,
    });
  });

  it("keeps the starting lesson for the first teaching day after a practice-only session", async () => {
    const { finished, goalId, userId } = await placePedro();

    const session = await studySessionFixture({
      createdAt: new Date("2026-11-28T16:00:00Z"),
      goalId,
      localDate: new Date("2026-11-28T00:00:00Z"),
      userId,
    });

    await studySessionBlockFixture({ kind: "practice", sessionId: session.id });

    await expect(openFirstBlock(goalId, "2026-11-30")).resolves.toMatchObject({
      kind: "learn",
      lessonId: finished.next.id,
    });
  });

  it("restores the earlier chapters, their challenges and ordinary session order on Undo", async () => {
    const { before, finished, goalId, items } = await placePedro();
    await decidePlanChange({ changeId: finished.changeId, goalId, input: { status: "undone" } });
    await expect(items()).resolves.toStrictEqual(before);
    await expect(getGoalPlan(goalId)).resolves.toMatchObject({ plan: { currentPhase: 0 } });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: {
        result: {
          lessonsSkipped: 0,
          nextLesson: {
            id: before.find((item) => item.kind === "lesson" && item.status === "todo")!.lessonId,
          },
        },
      },
    });

    await expect(openFirstBlock(goalId)).resolves.toMatchObject({
      kind: "practice",
      payload: { mistakeIds: expect.arrayContaining([expect.any(String)]) },
    });
  });
});
