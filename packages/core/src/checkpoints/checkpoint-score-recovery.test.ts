import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerBlockInOrder } from "../sessions/_test-utils/answer-block";
import {
  SESSION_NOW,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { toBlockPayload } from "../sessions/block-payload";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { getStudyBlock } from "../sessions/get-study-block";
import { startStudyBlock } from "../sessions/start-study-block";
import { getChallenge } from "./get-challenge";
import { getCheckpoint } from "./get-checkpoint";

describe("finished challenge score recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps deleted answered misses in the active duel's verdicts and question count", async () => {
    const user = await userFixture();

    const { goal, items, plan, planItems, skills } = await sessionGoalFixture({
      lessons: 2,
      userId: user.id,
    });

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: planItems.map((item) => item.id) } },
    });

    const boss = await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 2 });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({
        checkpoint: {
          kind: "boss",
          mock: false,
          passMark: 5,
          phase: 0,
          rematch: false,
          timeLimitMinutes: null,
        },
        itemIds: items.map((item) => item.id),
        planItemId: boss.id,
        skillIds: skills.map((skill) => skill.id),
      }),
      sessionId: session.id,
    });

    const ref = { blockId: block.id, sessionId: session.id };
    mockSession(user.id);

    await expect(startStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      status: "ready",
    });

    await answerBlockInOrder({ ...ref, count: 2, optionIndex: 1 });
    const answered = await getStudyBlock(ref);

    if (answered.status !== "ready") {
      throw new Error("Expected the active duel");
    }

    const missed = answered.detail.questions.slice(0, 2);
    await prisma.item.delete({ where: { id: missed[0]?.itemId } });

    const expectedAnswers = missed.map((question) => ({
      isCorrect: false,
      itemId: question.itemId,
    }));

    await expect(getStudyBlock(ref)).resolves.toMatchObject({
      detail: {
        answeredQuestions: expect.arrayContaining(expectedAnswers),
        block: { checkpoint: { passMark: 5 }, questions: 6 },
      },
    });

    await expect(getCheckpoint(block.id)).resolves.toMatchObject({
      checkpoint: {
        answeredQuestions: expect.arrayContaining(expectedAnswers),
        passMark: 5,
        result: null,
      },
      status: "ready",
    });

    await expect(getChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      challenge: { passMark: 5, questions: 6 },
      status: "ready",
    });

    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      completion: { checkpoint: { correct: 0, passed: false, total: 2 } },
      status: "ready",
    });
  });

  it.each([
    { count: 5, kind: "boss" as const, mock: false, optionIndex: 0, passed: true },
    { count: 2, kind: "finalBoss" as const, mock: false, optionIndex: 1, passed: false },
    { count: 6, kind: "weekly" as const, mock: false, optionIndex: 0, passed: true },
  ])(
    "keeps $kind's saved score after every question is deleted (mock: $mock)",
    async ({ count, kind, mock, optionIndex, passed }) => {
      const user = await userFixture();
      const fixture = await sessionGoalFixture({ lessons: 2, userId: user.id });
      const { items } = fixture;
      expect(items).toHaveLength(6);

      const session = await studySessionFixture({ goalId: fixture.goal.id, userId: user.id });

      const block = await studySessionBlockFixture({
        kind: "checkpoint",
        payload: toBlockPayload({
          checkpoint: { kind, mock, passMark: 5, phase: 0, rematch: false, timeLimitMinutes: null },
          itemIds: items.map((item) => item.id),
          skillIds: fixture.skills.map((skill) => skill.id),
        }),
        sessionId: session.id,
      });

      const ref = { blockId: block.id, sessionId: session.id };
      mockSession(user.id);

      await expect(startStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
        status: "ready",
      });

      await answerBlockInOrder({ ...ref, count, optionIndex });

      const expected = { correct: optionIndex === 0 ? count : 0, passed, total: count };

      await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
        completion: { checkpoint: expected },
        status: "ready",
      });

      await expect(getCheckpoint(block.id)).resolves.toMatchObject({
        checkpoint: { result: expected },
        status: "ready",
      });

      await prisma.item.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
      await expect(getStudyBlock(ref)).resolves.toMatchObject({ detail: { questions: [] } });

      await expect(getCheckpoint(block.id)).resolves.toMatchObject({
        checkpoint: { result: expected, status: "completed" },
        status: "ready",
      });
    },
  );
});
