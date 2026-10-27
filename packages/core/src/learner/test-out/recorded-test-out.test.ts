import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getChapterTestOut } from "./get-chapter-test-out";
import { getRecordedTestOut } from "./get-recorded-test-out";
import { submitChapterTestOut } from "./submit-chapter-test-out";

const NOW = new Date("2026-09-30T12:00:00Z");

/** A planned chapter of six lessons on one skill, whose test asks its four questions. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics"],
    skills: [{ lessons: 6, phase: 0 }],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 60,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...Array.from({ length: 4 }, () =>
      itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
    ),
  ]);

  mockSession(user.id);

  const chapterId = library.chapters[0]?.id ?? "";
  const testOut = await getChapterTestOut({ chapterId, goalId: goal.id });
  const questions = testOut.status === "ready" ? testOut.testOut.questions : [];

  /** The test sent with one answer per question, the first option (the right one) unless `wrong`. */
  const send = ({ requestId, wrong = 0 }: { requestId: string; wrong?: number }) =>
    submitChapterTestOut({
      chapterId,
      goalId: goal.id,
      input: {
        answers: questions.map((question, index) => ({
          answer: { selectedIndex: index < wrong ? 1 : 0 },
          durationMs: 5000,
          itemId: question.itemId,
        })),
        requestId,
      },
    });

  return { chapterId, goal, questions, send, user };
}

async function countRecorded(userId: string) {
  const [events, attempts, day] = await Promise.all([
    prisma.learningEvent.count({ where: { lessonKind: "testOut", userId } }),
    prisma.attempt.count({ where: { userId } }),
    prisma.dailyProgress.findFirst({ where: { userId } }),
  ]);

  return { attempts, correctAnswers: day?.correctAnswers, events };
}

describe("a chapter test-out sent and read back", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts a test sent again once and answers with what it recorded", async () => {
    const { questions, send, user } = await setup();
    const requestId = randomUUID();

    expect(questions).toHaveLength(4);

    const first = await send({ requestId });
    const counted = await countRecorded(user.id);

    expect(first).toMatchObject({ outcome: { correct: 4, passed: true }, status: "ready" });
    expect(counted).toStrictEqual({ attempts: 4, correctAnswers: 4, events: 1 });

    // A retry after a lost response: nothing is recorded, counted or celebrated again.
    const again = await send({ requestId });

    expect(again).toStrictEqual({
      outcome: {
        ...(first.status === "ready" && first.outcome),
        reached: { energy: null, level: null },
      },
      status: "ready",
    });

    await expect(countRecorded(user.id)).resolves.toStrictEqual(counted);
  });

  it("counts a double submit once", async () => {
    const { send, user } = await setup();
    const requestId = randomUUID();

    const [first, second] = await Promise.all([send({ requestId }), send({ requestId })]);

    const firstChange = first.status === "ready" ? first.outcome.changeId : null;

    expect(firstChange).toBeTruthy();
    expect(second.status === "ready" && second.outcome.changeId).toBe(firstChange);

    await expect(countRecorded(user.id)).resolves.toMatchObject({ correctAnswers: 4, events: 1 });
  });

  it("reads a pass back as it was recorded, with its undo while the plan stands", async () => {
    const { chapterId, goal, send } = await setup();
    const requestId = randomUUID();
    const sent = await send({ requestId });
    const changeId = sent.status === "ready" ? sent.outcome.changeId : null;
    const lessonsSkipped = sent.status === "ready" ? sent.outcome.lessonsSkipped : 0;

    expect(changeId).toBeTruthy();
    expect(lessonsSkipped).toBeGreaterThan(0);

    await expect(
      getRecordedTestOut({ chapterId, goalId: goal.id, requestId }),
    ).resolves.toStrictEqual({
      result: {
        canUndo: true,
        changeId,
        correct: 4,
        lessonsSkipped,
        passed: true,
        total: 4,
        undone: false,
      },
      status: "ready",
    });

    await decidePlanChange({
      changeId: changeId ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(
      getRecordedTestOut({ chapterId, goalId: goal.id, requestId }),
    ).resolves.toMatchObject({
      result: { canUndo: false, changeId, lessonsSkipped, passed: true, undone: true },
      status: "ready",
    });
  });

  it("reads a fail back without a plan change", async () => {
    const { chapterId, goal, send } = await setup();
    const requestId = randomUUID();

    await send({ requestId, wrong: 2 });

    await expect(
      getRecordedTestOut({ chapterId, goalId: goal.id, requestId }),
    ).resolves.toStrictEqual({
      result: {
        canUndo: false,
        changeId: null,
        correct: 2,
        lessonsSkipped: 0,
        passed: false,
        total: 4,
        undone: false,
      },
      status: "ready",
    });
  });

  it("finds no result for a test never sent, another chapter's or another learner's", async () => {
    const { chapterId, goal, send } = await setup();
    const requestId = randomUUID();

    await send({ requestId });

    await expect(
      getRecordedTestOut({ chapterId, goalId: goal.id, requestId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      getRecordedTestOut({ chapterId: randomUUID(), goalId: goal.id, requestId }),
    ).resolves.toStrictEqual({ status: "notFound" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(
      getRecordedTestOut({ chapterId, goalId: goal.id, requestId }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
