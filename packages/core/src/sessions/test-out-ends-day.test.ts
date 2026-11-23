import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
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
import { placementItemBank } from "../learner/_test-utils/placement-tap-items";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getChapterTestOut } from "../learner/test-out/get-chapter-test-out";
import { submitChapterTestOut } from "../learner/test-out/submit-chapter-test-out";
import { moveOnWithoutLesson } from "../library/generation/hold-back-lesson";
import { getTodayStudySession } from "./_test-utils/open-today";
import { runOwedSettlements } from "./_test-utils/owed-settlements";
import { sessionGoalFixture } from "./_test-utils/session-goal";
import { completeLessonPlanItems } from "./_utils/plan-items";
import { readBlockPayload } from "./block-payload";
import { startStudyBlock } from "./start-study-block";

const PASSED = { outcome: { lessonsSkipped: 1, passed: true }, status: "ready" };

/** A started day whose first lesson is done and whose second, the last one left, waits. */
async function startedDay() {
  const user = await userFixture();

  const { chapters, goal, planItems, skills } = await learnerGoalFixture({
    challengesDone: true,
    itemsPerSkill: 0,
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

  const bank = await placementItemBank([skills[1]?.id ?? ""]);

  return {
    answersById: new Map(bank.flat().map(({ answer, item }) => [item.id, answer])),
    chapterId: chapters[1]?.id ?? "",
    goal,
    last,
    planItemId: planItems[1]?.id ?? "",
    session,
  };
}

async function passChapterTest({
  answersById,
  chapterId,
  goalId,
}: {
  answersById: Awaited<ReturnType<typeof startedDay>>["answersById"];
  chapterId: string;
  goalId: string;
}) {
  const testOut = await getChapterTestOut({ chapterId, goalId });
  const questions = testOut.status === "ready" ? testOut.testOut.questions : [];
  const finishDeferredWork = runDeferredWork();

  const result = await submitChapterTestOut({
    chapterId,
    goalId,
    input: {
      answers: questions.map((question) => ({
        answer: answersById.get(question.itemId) ?? { dontKnow: true },
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

describe("a chapter test-out during a shown session", () => {
  it.each(["pending", "active"] as const)(
    "keeps its %s lesson and leaves the session open",
    async (status) => {
      const { answersById, chapterId, goal, last, planItemId, session } = await startedDay();

      if (status === "active") {
        await startStudyBlock({ blockId: last.id, input: {}, sessionId: session.id });
      }

      await expect(
        passChapterTest({ answersById, chapterId, goalId: goal.id }),
      ).resolves.toMatchObject(PASSED);

      const [block, day, item] = await Promise.all([
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: last.id } }),
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
        prisma.planItem.findUniqueOrThrow({ where: { id: planItemId } }),
      ]);

      expect(block.status).toBe(status);
      expect(day).toMatchObject({ endedAt: null, status: "active" });
      expect(item.status).toBe("testedOut");
    },
  );
});

describe("settlement after redundant teaching is removed", () => {
  it("owes a separate settlement when completion elsewhere removes the last lesson", async () => {
    const user = await userFixture();

    const {
      goal,
      lessons: [learned, setAside],
    } = await sessionGoalFixture({ challengesDone: true, lessons: 2, userId: user.id });

    const now = new Date();

    const session = await studySessionFixture({
      goalId: goal.id,
      startedAt: now,
      status: "active",
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({ lessonId: learned!.id, position: 0, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: setAside!.id, position: 1, sessionId: session.id }),
    ]);

    await prisma.$transaction((tx) => moveOnWithoutLesson(tx, setAside!.id, randomUUID()));
    await runOwedSettlements(user.id);

    const readDay = () => prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    await expect(readDay()).resolves.toMatchObject({ endedAt: null, status: "active" });

    await writeLearnerChange({ planInputs: true, userId: user.id }, (tx) =>
      completeLessonPlanItems(tx, { lessonId: learned!.id, now, userId: user.id }),
    );

    await expect(
      prisma.followUp.count({ where: { kind: "settleSessionDay", userId: user.id } }),
    ).resolves.toBe(2);

    await runOwedSettlements(user.id);

    await expect(readDay()).resolves.toMatchObject({
      endedAt: expect.any(Date),
      status: "completed",
    });
  });
});
