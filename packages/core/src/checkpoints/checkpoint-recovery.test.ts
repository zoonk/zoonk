import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerBlockInOrder } from "../sessions/_test-utils/answer-block";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import {
  DAY_MS,
  SESSION_NOW,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { getBlockItemIds, readBlockPayload } from "../sessions/block-payload";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { startStudyBlock } from "../sessions/start-study-block";
import { getCheckpoint } from "./get-checkpoint";
import { startChallenge } from "./start-challenge";

async function startedBoss() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ lessons: 2, userId: user.id });

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { planId: fixture.plan.id },
  });

  const boss = await checkpointItemFixture({ kind: "boss", planId: fixture.plan.id, position: 2 });
  mockSession(user.id);
  const today = await getTodayStudySession({ goalId: fixture.goal.id });

  const block =
    today.status === "ready"
      ? today.session.blocks.find((candidate) => candidate.kind === "checkpoint")
      : null;

  if (!block || today.status !== "ready") {
    throw new Error("Expected the boss");
  }

  const ref = { blockId: block.id, sessionId: today.session.id };
  await startStudyBlock({ ...ref, input: {} });
  const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
  return { ...fixture, boss, itemIds: getBlockItemIds(readBlockPayload(row)), ref, user };
}

describe("challenge recovery after question removal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ends an empty duel without a verdict or reward and can start again the next day", async () => {
    const { boss, itemIds, ref, skills, user } = await startedBoss();
    await prisma.item.deleteMany({ where: { id: { in: itemIds } } });

    await prisma.studySession.update({
      data: {
        missions: {
          picks: [
            { anchor: { blockKind: "practice" }, done: 1, kind: "practice", total: 1 },
            { anchor: { planItemId: boss.id }, kind: "challenge", total: 1 },
          ],
          version: 1,
        },
      },
      where: { id: ref.sessionId },
    });

    const finished = await finishStudyBlock({ ...ref, input: {} });

    expect(finished).toMatchObject({
      completion: { brainPower: 0, checkpoint: null, correct: 0, milestones: [], total: 0 },
      status: "ready",
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: ref.blockId } }),
    ).resolves.toMatchObject({ brainPower: 0, status: "skipped" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    await expect(
      prisma.learningEvent.count({
        where: { kind: { in: ["checkpoint", "mock"] }, userId: user.id },
      }),
    ).resolves.toBe(0);

    await expect(getCheckpoint(ref.blockId)).resolves.toMatchObject({
      checkpoint: { result: null, retry: null, status: "skipped" },
    });

    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      completion: { brainPower: 0, checkpoint: null, total: 0 },
      status: "ready",
    });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: ref.sessionId } }),
    ).resolves.toMatchObject({ fullMealAt: null });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "questionsNeeded",
    });

    await Promise.all(
      skills.flatMap((skill) =>
        Array.from({ length: 5 }, () =>
          itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        ),
      ),
    );

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      destination: { kind: "checkpoint" },
      status: "ready",
    });
  });

  it("resumes an empty challenge whose end committed before the response failed", async () => {
    const { itemIds, ref } = await startedBoss();
    const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: ref.blockId } });
    await prisma.item.deleteMany({ where: { id: { in: itemIds } } });

    await prisma.studySessionBlock.update({
      data: { payload: { ...readBlockPayload(row), checkpointAbandoned: true }, status: "skipped" },
      where: { id: ref.blockId },
    });

    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      completion: { brainPower: 0, checkpoint: null, total: 0 },
      status: "ready",
    });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: ref.sessionId } }),
    ).resolves.toMatchObject({ status: "completed" });
  });

  it.each([
    { deleteAnswered: false, optionIndex: 0 },
    { deleteAnswered: false, optionIndex: 1 },
    { deleteAnswered: true, optionIndex: 0 },
    { deleteAnswered: true, optionIndex: 1 },
  ])(
    "judges the asked question when questions vanish (option $optionIndex, answered removed $deleteAnswered)",
    async ({ deleteAnswered, optionIndex }) => {
      const { itemIds, ref } = await startedBoss();
      await answerBlockInOrder({ ...ref, count: 1, optionIndex });

      await prisma.item.deleteMany({
        where: { id: { in: deleteAnswered ? itemIds : itemIds.slice(1) } },
      });

      await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
        completion: {
          checkpoint: {
            correct: optionIndex === 0 ? 1 : 0,
            passMark: 1,
            passed: optionIndex === 0,
            total: 1,
          },
        },
        status: "ready",
      });
    },
  );
});
