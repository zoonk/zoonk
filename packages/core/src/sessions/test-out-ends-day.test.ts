import { randomUUID } from "node:crypto";
import { type TransactionClient, prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { getChapterTestOut } from "../learner/test-out/get-chapter-test-out";
import { submitChapterTestOut } from "../learner/test-out/submit-chapter-test-out";
import { moveOnWithoutLesson } from "../library/generation/hold-back-lesson";
import { getTodayView } from "../view-models/today/get-today-view";
import { getTodayStudySession } from "./_test-utils/open-today";
import { runOwedSettlements } from "./_test-utils/owed-settlements";
import { sessionGoalFixture } from "./_test-utils/session-goal";
import { skipTestedOutBlocks } from "./_utils/skip-tested-out-blocks";
import { readBlockPayload } from "./block-payload";
import { startStudyBlock } from "./start-study-block";

/** A started day with one lesson open and one waiting, which a test-out and a set-aside take. */
async function startedDayOfTwoLessons() {
  const user = await userFixture();
  const { goal, lessons, planItems } = await sessionGoalFixture({ lessons: 2, userId: user.id });
  const [tested, setAside] = lessons;
  const testedItemId = planItems[0]?.id ?? "";
  const now = new Date();

  const session = await studySessionFixture({
    goalId: goal.id,
    startedAt: now,
    status: "active",
    userId: user.id,
  });

  await Promise.all([
    studySessionBlockFixture({
      lessonId: tested?.id,
      position: 0,
      sessionId: session.id,
      startedAt: now,
      status: "active",
    }),
    studySessionBlockFixture({ lessonId: setAside?.id, position: 1, sessionId: session.id }),
    prisma.planItem.update({
      data: { completedAt: now, status: "testedOut" },
      where: { id: testedItemId },
    }),
  ]);

  return {
    session,
    setAside: (tx: TransactionClient) => moveOnWithoutLesson(tx, setAside?.id ?? "", randomUUID()),
    testOut: () => skipTestedOutBlocks({ goalId: goal.id, planItemIds: [testedItemId] }),
    user,
  };
}

const PASSED = { outcome: { lessonsSkipped: 1, passed: true }, status: "ready" };

/** A started day whose first lesson is done and whose second, the last one left, waits. */
async function startedDay() {
  const user = await userFixture();

  const { chapters, goal, planItems } = await learnerGoalFixture({
    itemsPerSkill: 4,
    phases: [1, 1],
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  const opened = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

  if (opened.status !== "ready") {
    throw new Error(`Expected today's session, got ${opened.status}`);
  }

  const { session } = opened;
  const [first] = session.blocks;

  await startStudyBlock({ blockId: first?.id ?? "", input: {}, sessionId: session.id });

  // The lesson's own completion is covered by its tests; this day only needs it done.
  const done = new Date();

  const [finished] = await Promise.all([
    prisma.studySessionBlock.update({
      data: { completedAt: done, status: "completed" },
      where: { id: first?.id },
    }),
    prisma.planItem.update({
      data: { completedAt: done, status: "done" },
      where: { id: planItems[0]?.id },
    }),
  ]);

  const last = await studySessionBlockFixture({
    estimatedMinutes: finished.estimatedMinutes,
    lessonId: planItems[1]?.lessonId,
    payload: { ...readBlockPayload(finished), planItemId: planItems[1]?.id },
    sessionId: session.id,
  });

  return { chapterId: chapters[1]?.id ?? "", goal, last, session, user };
}

async function passChapterTest({ chapterId, goalId }: { chapterId: string; goalId: string }) {
  const testOut = await getChapterTestOut({ chapterId, goalId });
  const questions = testOut.status === "ready" ? testOut.testOut.questions : [];
  const finishDeferredWork = runDeferredWork();

  const result = await submitChapterTestOut({
    chapterId,
    goalId,
    input: {
      answers: questions.map((question) => ({
        answer: { selectedIndex: 0 },
        durationMs: 6000,
        itemId: question.itemId,
      })),
      requestId: randomUUID(),
      timeZone: "UTC",
    },
  });

  await finishDeferredWork();
  return result;
}

async function expectCompletedDay({
  goalId,
  sessionId,
  userId,
}: {
  goalId: string;
  sessionId: string;
  userId: string;
}) {
  await runOwedSettlements(userId);

  const [saved, ledger, followUps, today] = await Promise.all([
    prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } }),
    prisma.learningEvent.findFirstOrThrow({
      where: { contentIds: { equals: sessionId, path: ["studySessionId"] }, kind: "session" },
    }),
    prisma.followUp.findMany({ select: { key: true, kind: true }, where: { userId } }),
    getTodayView({ goalId, timeZone: "UTC" }),
  ]);

  expect(saved).toMatchObject({ endedAt: expect.any(Date), status: "completed" });
  expect(ledger.endedAt).toStrictEqual(saved.endedAt);
  expect(followUps).toContainEqual({ key: sessionId, kind: "prepareSession" });
  expect(followUps).toContainEqual({ key: sessionId, kind: "rememberSession" });

  expect(today).toMatchObject({
    status: "ready",
    today: { session: { state: "done", status: "completed" } },
  });
}

describe("a started day whose last open lesson a test-out takes away", () => {
  it("completes, with its end ledger, memory and next preparation", async () => {
    const { chapterId, goal, session, user } = await startedDay();

    await expect(passChapterTest({ chapterId, goalId: goal.id })).resolves.toMatchObject(PASSED);
    await expectCompletedDay({ goalId: goal.id, sessionId: session.id, userId: user.id });
  });

  it("completes when the learner had that lesson open", async () => {
    const { chapterId, goal, last, session, user } = await startedDay();

    await startStudyBlock({ blockId: last.id, input: {}, sessionId: session.id });
    await expect(passChapterTest({ chapterId, goalId: goal.id })).resolves.toMatchObject(PASSED);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: last.id } }),
    ).resolves.toMatchObject({ status: "skipped" });

    await expectCompletedDay({ goalId: goal.id, sessionId: session.id, userId: user.id });
  });

  it("completes when the day's other lesson is set aside while the test-out skips this one", async () => {
    const { session, setAside, testOut, user } = await startedDayOfTwoLessons();
    const holding = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    // Each write sees the other's block still open.
    const settingAside = prisma.$transaction(async (tx) => {
      await setAside(tx);
      holding.resolve(null);
      await release.promise;
    });

    await holding.promise;
    await testOut();
    release.resolve(null);
    await settingAside;
    await runOwedSettlements(user.id);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ endedAt: expect.any(Date), status: "completed" });
  });

  it("owes a settlement for each write that takes the day's blocks", async () => {
    const { session, setAside, testOut, user } = await startedDayOfTwoLessons();

    await prisma.$transaction((tx) => setAside(tx));
    await testOut();

    // The API drops a settlement whose key is already running, which may have read the day too early.
    await expect(
      prisma.followUp.count({ where: { kind: "settleSessionDay", userId: user.id } }),
    ).resolves.toBe(2);

    await runOwedSettlements(user.id);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ endedAt: expect.any(Date), status: "completed" });
  });
});
