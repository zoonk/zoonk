import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerStudyQuestion } from "./answer-study-question";
import { toBlockPayload } from "./block-payload";
import { studyAnswerInputSchema } from "./contract";
import { finishStudyBlock } from "./finish-study-block";

describe("checkpoint stored correction evidence", () => {
  it("keeps a corrected old mistake's answer and explanation in the completion review", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

    const [session, mistake] = await Promise.all([
      studySessionFixture({ startedAt: new Date(), status: "active", userId: user.id }),
      mistakeFixture({
        createdAt: new Date(Date.now() - 86_400_000),
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({
        checkpoint: {
          kind: "boss",
          mock: false,
          passMark: 1,
          phase: 0,
          rematch: false,
          timeLimitMinutes: null,
        },
        itemIds: [item.id],
      }),
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    });

    mockSession(user.id);

    const input = { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: item.id };

    expect(
      studyAnswerInputSchema.safeParse({
        ...input,
        answer: { ...input.answer, fixedMistakeIds: [mistake.id] },
      }).success,
    ).toBe(false);

    await expect(
      answerStudyQuestion({ blockId: block.id, input, sessionId: session.id }),
    ).resolves.toMatchObject({ feedback: { isCorrect: true }, status: "ready" });

    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { itemId: item.id, studySessionId: session.id, userId: user.id },
    });

    expect(attempt.answer).toStrictEqual({ fixedMistakeIds: [mistake.id], selectedIndex: 0 });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ fixedAt: attempt.answeredAt, status: "fixed" });

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({
      completion: {
        checkpoint: {
          answers: [
            {
              correctAnswer: { selectedIndex: 0 },
              explanation: "It follows the rule.",
              isCorrect: true,
              itemId: item.id,
            },
          ],
          total: 1,
        },
      },
      status: "ready",
    });
  });
});
