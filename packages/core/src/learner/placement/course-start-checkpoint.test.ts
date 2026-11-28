import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
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
import { readPlacementAttempt } from "./_utils/placement-attempt-record";
import { gradePlacementAnswer, parsePlacementItem } from "./_utils/placement-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { placementAnswerInputSchema } from "./placement-contract";
import { startPlacementSitting } from "./start-placement-sitting";

type StockAnswers = "right" | "stop" | "miss" | "ineligible";

async function finishStockTest(goalId: string, answers: StockAnswers = "right") {
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
        answer: answers === "miss" ? { dontKnow: true } : correctAnswer,
        attemptId,
        durationMs: 1200,
        itemId,
      }),
    });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    if (result.placement.next && answers !== "stop") {
      await answerNext(result.placement.next.itemId);
    }
  }

  await answerNext(started.placement.next!.itemId);

  if (answers === "ineligible") {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    const lastTopic = readPlacementAttempt(goal).attempt?.search?.topics?.at(-1);

    if (!lastTopic) {
      throw new Error("Expected a frozen course line");
    }

    await prisma.planItem.updateMany({
      data: { skillId: lastTopic.id },
      where: { kind: "lesson", plan: { goalId }, status: "todo" },
    });
  }

  const finished = await finishGoalPlacement({ goalId, input: { attemptId } });

  if (finished.status !== "ready" || !finished.completion.result) {
    throw new Error("Expected a saved course result");
  }

  const { changeId, lessonsSkipped, testedOutPlanItemIds } = finished.completion;

  return {
    changeId,
    chapter: finished.completion.result.chapter,
    course: finished.completion.result.course,
    lessonsSkipped,
    next: finished.completion.result.nextLesson,
    testedOutPlanItemIds,
  };
}

async function seedPedro() {
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

  return { goalId, items, userId };
}

async function placePedro() {
  const { goalId, items, userId } = await seedPedro();
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

  const { changeId, next } = finished;

  if (!changeId || !next) {
    throw new Error("Expected a starting lesson and an Undo receipt");
  }

  const start = after.find((item) => item.lessonId === next.id)!;
  expect(start.phase).toBe(3);
  await refreshTestedOutPlan({ goalId, userId });
  const view = await getGoalPlan(goalId);

  if (view.status !== "ready") {
    throw new Error(view.status);
  }

  const phases = view.plan.phases.map(({ index }) => ({
    lessons: after.filter((item) => item.kind === "lesson" && item.phase === index).length,
    start: index === start.phase,
  }));

  expect(finished.course?.chapters).toMatchObject(phases);
  expect(finished.chapter).toBe(view.plan.phases[start.phase]?.name);
  expect(view.plan.currentPhase).toBe(start.phase);
  expect(view.plan.phases[start.phase]).toMatchObject({ state: "current" });

  expect(
    view.plan.phases.slice(0, start.phase).map(({ checkpoint, state }) => ({ checkpoint, state })),
  ).toStrictEqual(Array.from({ length: start.phase }, () => ({ checkpoint: null, state: "done" })));

  const earlier = after.filter(
    (item) => item.phase < start.phase && PHASE_WORK_KINDS.has(item.kind),
  );

  expect(earlier.filter((item) => item.status === "todo")).toStrictEqual([]);

  return { before, finished: { ...finished, changeId, next }, goalId, items, userId };
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
  it.each(["stop", "miss", "ineligible"] as const)(
    "keeps Pedro's Plan start with zero skips after %s",
    async (answers) => {
      const { goalId, items } = await seedPedro();

      if (answers === "stop") {
        const before = await items();

        const first = before.find(
          (row) => row.phase === 0 && row.kind === "lesson" && row.status === "todo",
        )!;

        if (!first.lessonId) {
          const lesson = await libraryLessonFixture({ title: first.titleSnapshot });
          await prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: first.id } });
        }
      }

      const finished = await finishStockTest(goalId, answers);
      const after = await items();
      const rows = after.filter((item) => item.kind === "lesson");

      const first = rows
        .toSorted((a, b) => a.phase - b.phase)
        .find((row) => row.status === "todo")!;

      const plan = await getGoalPlan(goalId);

      if (plan.status !== "ready") {
        throw new Error(plan.status);
      }

      expect(finished.lessonsSkipped).toBe(0);
      expect(Boolean(finished.changeId)).toBe(answers === "ineligible");
      expect(finished.chapter).toBe(plan.plan.phases[first.phase]?.name);
      expect(finished.next?.id ?? null).toBe(first.lessonId);
      expect(plan.plan.currentPhase).toBe(first.phase);

      expect(finished.course?.chapters).toStrictEqual(
        plan.plan.phases.map(({ index }) => {
          const lessons = rows.filter((row) => row.phase === index);

          return {
            done: lessons.filter((row) => row.status === "done" || row.status === "testedOut")
              .length,
            lessons: lessons.length,
            skipped: 0,
            start: first.phase === index,
          };
        }),
      );
    },
  );

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

    const first = before
      .toSorted((a, b) => a.phase - b.phase)
      .find((item) => item.kind === "lesson" && item.status === "todo")!;

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: {
        result: { lessonsSkipped: 0, nextLesson: first.lessonId ? { id: first.lessonId } : null },
      },
    });

    await expect(openFirstBlock(goalId)).resolves.toMatchObject({
      kind: "practice",
      payload: { mistakeIds: expect.arrayContaining([expect.any(String)]) },
    });
  });
});
