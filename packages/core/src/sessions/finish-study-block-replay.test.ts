import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import * as sessionState from "./_utils/capture-snapshot";
import { answerStudyQuestion } from "./answer-study-question";
import { type BlockPayload, toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";

const NOTHING = { energy: null, level: null };

const BOSS: BlockPayload["checkpoint"] = {
  kind: "boss",
  mock: false,
  passMark: 1,
  phase: 0,
  rematch: false,
  timeLimitMinutes: null,
};

const PRACTICE_MISSION = {
  picks: [{ anchor: { blockKind: "practice" }, kind: "practice", total: 1 }],
  version: 1,
};

async function setup(
  checkpoint: BlockPayload["checkpoint"],
  { last = false, missions }: { last?: boolean; missions?: typeof PRACTICE_MISSION } = {},
) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const session = await studySessionFixture({
    missions,
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
    last ? null : studySessionBlockFixture({ kind: "learn", position: 1, sessionId: session.id }),
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

    const retried = await day.finish();

    expect(retried).toStrictEqual(
      first.status === "ready"
        ? {
            ...first,
            completion: { ...first.completion, ceremony: null, milestones: [], reached: NOTHING },
          }
        : first,
    );

    await expect(readPaid(day)).resolves.toStrictEqual(paid);
  });

  it("says again which missions it completed and that it paid the day's bonus", async () => {
    const day = await setup(null, { missions: PRACTICE_MISSION });
    const first = await day.finish();

    expect(first).toMatchObject({
      completion: { completedMissions: ["practice"], fullMeal: { bonus: 50, paid: true } },
      status: "ready",
    });

    const retried = await day.finish();

    expect(retried).toStrictEqual(
      first.status === "ready"
        ? {
            ...first,
            completion: { ...first.completion, ceremony: null, milestones: [], reached: NOTHING },
          }
        : first,
    );
  });

  it("keeps the missions it completed when the session's end failed after they settled", async () => {
    const day = await setup(null, { last: true, missions: PRACTICE_MISSION });

    const failedEnd = vi
      .spyOn(sessionState, "measureSessionState")
      .mockRejectedValueOnce(new Error("Session end interrupted"));

    try {
      await expect(day.finish()).rejects.toThrow("Session end interrupted");
    } finally {
      failedEnd.mockRestore();
    }

    await expect(day.finish()).resolves.toMatchObject({
      completion: {
        completedMissions: ["practice"],
        fullMeal: { bonus: 50, paid: true },
        sessionCompleted: true,
      },
      status: "ready",
    });
  });

  it("says the belt level and the tenth of Energy it reached, with its ceremony", async () => {
    const day = await setup(null, { missions: PRACTICE_MISSION });

    const progress = { currentEnergy: 79.9, lastActiveAt: new Date(), totalBrainPower: 2490n };

    await prisma.userProgress.upsert({
      create: { ...progress, userId: day.user.id },
      update: progress,
      where: { userId: day.user.id },
    });

    await expect(day.finish()).resolves.toMatchObject({
      completion: {
        ceremony: { key: "yellow", kind: "belt" },
        reached: { energy: 80, level: { color: "yellow", level: 1 } },
      },
      status: "ready",
    });

    await expect(day.finish()).resolves.toMatchObject({
      completion: { ceremony: null, reached: NOTHING },
    });
  });

  it("doesn't celebrate Max Energy again for a learner already at it", async () => {
    const day = await setup(null);
    const progress = { currentEnergy: 100, lastActiveAt: new Date(), totalBrainPower: 10n };

    await prisma.userProgress.upsert({
      create: { ...progress, userId: day.user.id },
      update: progress,
      where: { userId: day.user.id },
    });

    await expect(day.finish()).resolves.toMatchObject({
      completion: { reached: { energy: null } },
      status: "ready",
    });
  });

  it("tells two finishes at once the same missions and bonus", async () => {
    const day = await setup(null, { missions: PRACTICE_MISSION });
    const finishes = await Promise.all([day.finish(), day.finish()]);

    const moments = finishes.flatMap((finish) =>
      finish.status === "ready" ? [finish.completion] : [],
    );

    expect(moments.length).toBeGreaterThan(0);

    for (const moment of moments) {
      expect(moment).toMatchObject({
        completedMissions: ["practice"],
        fullMeal: { bonus: 50, paid: true },
      });
    }
  });
});
