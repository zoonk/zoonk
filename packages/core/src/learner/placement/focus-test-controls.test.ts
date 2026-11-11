import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { listOwed } from "../../_test-utils/follow-ups";
import { readBlockPayload, toBlockPayload } from "../../sessions/block-payload";
import { PLAN_SHOWN, examTestGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { getGoalPlacement } from "./get-goal-placement";
import { updateFocusTest } from "./update-focus-test";

const SUBJECTS = [
  { name: "Português", questions: 8 },
  { name: "Direito Administrativo", questions: 12 },
  { name: "Informática", questions: 4 },
];

async function control(goalId: string, input: Parameters<typeof updateFocusTest>[0]["input"]) {
  const result = await updateFocusTest({ goalId, input: { timeZone: "UTC", ...input } });

  if (result.status !== "ready") {
    throw new Error(`The test's controls answered ${result.status}`);
  }

  return result.focusTest;
}

async function readBlocks(sessionId: string) {
  const blocks = await prisma.studySessionBlock.findMany({
    orderBy: { position: "asc" },
    select: { payload: true, status: true },
    where: { sessionId },
  });

  return blocks.map((block) => ({
    placementItemIds: readBlockPayload(block).placementItemIds,
    status: block.status,
  }));
}

describe(updateFocusTest, () => {
  it("pauses the test's session questions, skips them for a day, and turns them back on", async () => {
    const { goal } = await examTestGoalFixture({ goal: PLAN_SHOWN, subjects: SUBJECTS });

    await expect(control(goal.id, { sessionQuestions: "on" })).resolves.toStrictEqual({
      offer: { minutes: 12, questions: 12 },
      sessionQuestions: "on",
      setsFocus: false,
      state: "notStarted",
      subjects: null,
    });

    await expect(control(goal.id, { sessionQuestions: "paused" })).resolves.toMatchObject({
      sessionQuestions: "paused",
    });

    await expect(control(goal.id, { sessionQuestions: "skippedToday" })).resolves.toMatchObject({
      sessionQuestions: "paused",
    });

    await expect(control(goal.id, { sessionQuestions: "on" })).resolves.toMatchObject({
      sessionQuestions: "on",
    });

    await expect(control(goal.id, { sessionQuestions: "skippedToday" })).resolves.toMatchObject({
      sessionQuestions: "skippedToday",
    });

    const placement = await getGoalPlacement({ goalId: goal.id, timeZone: "UTC" });

    expect(placement.status === "ready" && placement.placement.focusTest).toMatchObject({
      sessionQuestions: "skippedToday",
    });
  });

  it("shows the sitting on the plan's row, and the last result once it has answers", async () => {
    const { goal } = await examTestGoalFixture({ subjects: SUBJECTS });

    await startSitting(goal.id);

    await expect(control(goal.id, { suggestion: "dismissed" })).resolves.toStrictEqual({
      offer: { minutes: 12, questions: 12 },
      sessionQuestions: "on",
      setsFocus: false,
      state: "sitting",
      subjects: null,
    });
  });

  it("has no controls for a goal that isn't an exam, or for another learner's", async () => {
    const { user } = await examTestGoalFixture({ subjects: SUBJECTS });
    const other = await goalFixture({ userId: user.id });

    await expect(
      updateFocusTest({ goalId: other.id, input: { sessionQuestions: "paused" } }),
    ).resolves.toStrictEqual({ status: "unavailable" });

    await expect(
      updateFocusTest({ goalId: crypto.randomUUID(), input: { sessionQuestions: "paused" } }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("takes today's unanswered test questions out of the session and keeps the answered one", async () => {
    const { goal, items, user } = await examTestGoalFixture({
      goal: PLAN_SHOWN,
      subjects: SUBJECTS,
    });

    const [answered, unanswered, other, practice] = items;

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: toUTCMidnight(new Date()),
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({
        kind: "review",
        payload: toBlockPayload({
          itemIds: [practice?.id ?? ""],
          placementItemIds: [answered?.id ?? "", unanswered?.id ?? ""],
        }),
        position: 0,
        sessionId: session.id,
        status: "active",
      }),
      studySessionBlockFixture({
        kind: "review",
        payload: toBlockPayload({ placementItemIds: [other?.id ?? ""] }),
        position: 1,
        sessionId: session.id,
        status: "pending",
      }),
      attemptFixture({
        isPlacement: true,
        itemId: answered?.id ?? "",
        skillId: answered?.skillId ?? "",
        studySessionId: session.id,
        userId: user.id,
      }),
    ]);

    await control(goal.id, { sessionQuestions: "skippedToday" });

    await expect(readBlocks(session.id)).resolves.toStrictEqual([
      { placementItemIds: [answered?.id], status: "active" },
      { placementItemIds: [], status: "skipped" },
    ]);

    await expect(listOwed(user.id)).resolves.toMatchObject([{ kind: "settleSessionDay" }]);

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });
});
