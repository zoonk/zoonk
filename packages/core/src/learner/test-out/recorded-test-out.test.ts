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
import { NOTHING_REACHED } from "../../sessions/reached";
import { getChapterTestOut } from "./get-chapter-test-out";
import { getRecordedTestOut } from "./get-recorded-test-out";
import { submitChapterTestOut } from "./submit-chapter-test-out";

const NOW = new Date("2026-09-30T12:00:00Z");
const DAY_MS = 86_400_000;

/** A planned goal of the library's two chapters, as the learner makes it. */
async function plannedGoal({
  graph,
  userId,
}: {
  graph: Awaited<ReturnType<typeof planLibraryFixture>>["graph"];
  userId: string;
}) {
  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 60,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId,
  });

  await createGoalPlan({ goalId: goal.id, graph });
  return goal;
}

/** Two planned chapters of six lessons on one skill each, whose tests ask four questions each. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Next"],
    skills: [
      { lessons: 6, phase: 0 },
      { lessons: 6, phase: 1 },
    ],
  });

  const goal = await plannedGoal({ graph: library.graph, userId: user.id });

  await Promise.all([
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...library.skills.flatMap((skill) =>
      Array.from({ length: 4 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
  ]);

  mockSession(user.id);

  const chapterIds = library.chapters.map((chapter) => chapter.id);

  const tests = await Promise.all(
    chapterIds.map((chapterId) => getChapterTestOut({ chapterId, goalId: goal.id })),
  );

  const questions = tests.map((test) => (test.status === "ready" ? test.testOut.questions : []));

  /**
   * A chapter's test (the first unless `chapter`) sent with one answer per question, the first
   * option (the right one) unless `wrong`.
   */
  const send = ({
    chapter = 0,
    goalId = goal.id,
    requestId,
    wrong = 0,
  }: {
    chapter?: number;
    goalId?: string;
    requestId: string;
    wrong?: number;
  }) =>
    submitChapterTestOut({
      chapterId: chapterIds[chapter] ?? "",
      goalId,
      input: {
        answers: (questions[chapter] ?? []).map((question, index) => ({
          answer: { selectedIndex: index < wrong ? 1 : 0 },
          durationMs: 5000,
          itemId: question.itemId,
        })),
        requestId,
      },
    });

  return { chapterId: chapterIds[0] ?? "", chapterIds, goal, library, questions, send, user };
}

/** What a test sent again says: what it recorded, celebrating nothing again. */
function sentAgain(first: Awaited<ReturnType<typeof submitChapterTestOut>>) {
  return {
    outcome: { ...(first.status === "ready" && first.outcome), reached: NOTHING_REACHED },
    status: "ready",
  };
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

    expect(questions.map((asked) => asked.length)).toStrictEqual([4, 4]);

    const first = await send({ requestId });
    const counted = await countRecorded(user.id);

    expect(first).toMatchObject({ outcome: { correct: 4, passed: true }, status: "ready" });
    expect(counted).toStrictEqual({ attempts: 4, correctAnswers: 4, events: 1 });

    // A retry after a lost response: nothing is recorded, counted or celebrated again.
    await expect(send({ requestId })).resolves.toStrictEqual(sentAgain(first));
    await expect(countRecorded(user.id)).resolves.toStrictEqual(counted);
  });

  it("says what a test recorded when sent again after its questions changed and its free week ended", async () => {
    const { goal, questions, send, user } = await setup();
    const requestId = randomUUID();
    const first = await send({ requestId });
    const counted = await countRecorded(user.id);

    // Its questions were written again: these can't be graded anymore.
    await prisma.item.deleteMany({
      where: { id: { in: (questions[0] ?? []).map((asked) => asked.itemId) } },
    });

    await expect(send({ requestId })).resolves.toStrictEqual(sentAgain(first));

    // A free exam plan past its first week: a new test takes Plus, the one taken stays taken.
    await prisma.goal.update({
      data: { createdAt: new Date(NOW.getTime() - 10 * DAY_MS), kind: "exam" },
      where: { id: goal.id },
    });

    await expect(send({ requestId })).resolves.toStrictEqual(sentAgain(first));

    await expect(send({ requestId: randomUUID() })).resolves.toStrictEqual({
      status: "plusRequired",
    });

    await expect(countRecorded(user.id)).resolves.toStrictEqual(counted);
  });

  it("takes the same id sent for another chapter or goal as that test's own", async () => {
    const { chapterIds, goal, library, send, user } = await setup();
    const requestId = randomUUID();

    await send({ requestId });

    await expect(send({ chapter: 1, requestId, wrong: 2 })).resolves.toMatchObject({
      outcome: { changeId: null, correct: 2, passed: false },
      status: "ready",
    });

    const other = await plannedGoal({ graph: library.graph, userId: user.id });

    await expect(send({ goalId: other.id, requestId, wrong: 2 })).resolves.toMatchObject({
      outcome: { changeId: null, correct: 2, passed: false },
      status: "ready",
    });

    await expect(
      getRecordedTestOut({ chapterId: chapterIds[0] ?? "", goalId: goal.id, requestId }),
    ).resolves.toMatchObject({ result: { correct: 4, passed: true }, status: "ready" });

    await expect(
      getRecordedTestOut({ chapterId: chapterIds[1] ?? "", goalId: goal.id, requestId }),
    ).resolves.toMatchObject({ result: { correct: 2, passed: false }, status: "ready" });

    await expect(countRecorded(user.id)).resolves.toMatchObject({ events: 3 });
  });

  // Both may record the answers before the progress lock; the day and the ledger count it once.
  it("adds a double submit to the day once", async () => {
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
