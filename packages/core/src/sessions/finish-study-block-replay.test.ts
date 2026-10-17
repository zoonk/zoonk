import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerStudyQuestion } from "./answer-study-question";
import { type BlockPayload, toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";

const BOSS: BlockPayload["checkpoint"] = {
  kind: "boss",
  mock: false,
  passMark: 1,
  phase: 0,
  rematch: false,
  timeLimitMinutes: null,
};

/** A block answered and ready to finish, with a lesson after it so the day goes on. */
async function setup(checkpoint: BlockPayload["checkpoint"]) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const session = await studySessionFixture({
    startedAt: new Date(),
    status: "active",
    userId: user.id,
  });

  const [block] = await Promise.all([
    studySessionBlockFixture({
      kind: checkpoint ? "checkpoint" : "practice",
      payload: toBlockPayload({ checkpoint, itemIds: [item.id] }),
      position: 0,
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    }),
    studySessionBlockFixture({ kind: "learn", position: 1, sessionId: session.id }),
  ]);

  mockSession(user.id);

  await expect(
    answerStudyQuestion({
      blockId: block.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: item.id },
      sessionId: session.id,
    }),
  ).resolves.toMatchObject({ status: "ready" });

  const finish = () =>
    finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });

  return { block, finish, user };
}

/** Everything a finish pays or records for the learner. */
async function readPaid({ block, user }: Awaited<ReturnType<typeof setup>>) {
  const [progress, saved, events, milestones] = await Promise.all([
    prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    prisma.learningEvent.count({ where: { userId: user.id } }),
    prisma.milestone.count({ where: { userId: user.id } }),
  ]);

  return {
    blockBrainPower: saved.brainPower,
    energy: progress.currentEnergy,
    events,
    milestones,
    totalBrainPower: progress.totalBrainPower,
  };
}

describe("finishing a block that already finished", () => {
  it.each([
    { checkpoint: null, name: "practice block" },
    { checkpoint: BOSS, name: "boss duel" },
  ])("returns the $name's moment again, paying nothing twice", async ({ checkpoint }) => {
    const day = await setup(checkpoint);
    const first = await day.finish();

    expect(first).toMatchObject({
      completion: { brainPower: expect.any(Number), sessionCompleted: false },
      status: "ready",
    });

    const paid = await readPaid(day);
    expect(paid.blockBrainPower).toBeGreaterThan(0);

    // A retry after the first response was lost: the same moment, whose milestones were recorded
    // the first time (the day's summary shows any the learner didn't see).
    const retried = await day.finish();

    expect(retried).toStrictEqual(
      first.status === "ready"
        ? { ...first, completion: { ...first.completion, milestones: [] } }
        : first,
    );

    await expect(readPaid(day)).resolves.toStrictEqual(paid);
  });
});
