import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { answerStudyQuestion } from "./answer-study-question";
import { toBlockPayload } from "./block-payload";

async function setup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const { goal, plan } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const session = await studySessionFixture({
    goalId: goal.id,
    startedAt: new Date(),
    status: "active",
    userId: user.id,
  });

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

  const answer = () =>
    answerStudyQuestion({
      blockId: block.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: item.id, timeZone: "UTC" },
      sessionId: session.id,
    });

  return { answer, item, plan, session, user };
}

async function versions({ plan, user }: Awaited<ReturnType<typeof setup>>) {
  const [saved, actor] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
  ]);

  return { inputVersion: saved.inputVersion, learnerRevision: actor.learnerRevision };
}

describe("checkpoint answers cross the same revision boundary as other answers", () => {
  it("marks the answer once and leaves the input version unchanged on replay", async () => {
    const day = await setup();
    const before = await versions(day);

    await expect(day.answer()).resolves.toMatchObject({
      feedback: { isCorrect: true },
      status: "ready",
    });

    const recorded = {
      inputVersion: before.inputVersion + 1,
      learnerRevision: before.learnerRevision + 1n,
    };

    await expect(versions(day)).resolves.toStrictEqual(recorded);

    await expect(day.answer()).resolves.toMatchObject({
      feedback: { isCorrect: true },
      status: "ready",
    });

    await expect(versions(day)).resolves.toStrictEqual(recorded);
  });

  it("serializes competing answers and commits one answer with one revision", async () => {
    const day = await setup();
    const before = await versions(day);

    await expect(Promise.all([day.answer(), day.answer()])).resolves.toMatchObject([
      { feedback: { isCorrect: true }, status: "ready" },
      { feedback: { isCorrect: true }, status: "ready" },
    ]);

    await expect(versions(day)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      learnerRevision: before.learnerRevision + 1n,
    });

    await expect(
      prisma.attempt.count({
        where: { itemId: day.item.id, studySessionId: day.session.id, userId: day.user.id },
      }),
    ).resolves.toBe(1);
  });
});
