import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { claimUsage } from "./claim-usage";

const NOW = new Date("2026-11-13T12:00:00Z");
const STARTED = new Date("2026-11-10T10:00:00Z");

async function atLimit() {
  const user = await userFixture();
  mockSession(user.id);
  const targetId = randomUUID();

  const claim = await prisma.usageRecord.create({
    data: {
      countedAt: null,
      createdAt: new Date("2026-11-09T12:00:00Z"),
      generated: true,
      kind: "lessonStart",
      targetId,
      userId: user.id,
    },
  });

  await usageRecordsFixture({ count: 20, createdAt: NOW, userId: user.id });
  return { claim, targetId, user };
}

describe("admission of a replay with a missing count stamp", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("repairs the first recorded start at the limit and keeps repeated requests free", async () => {
    const { claim, targetId, user } = await atLimit();

    await Promise.all([
      learningEventFixture({
        contentIds: { lessonId: targetId },
        startedAt: STARTED,
        userId: user.id,
      }),
      learningEventFixture({
        contentIds: { lessonId: targetId },
        startedAt: new Date("2026-11-11T12:00:00Z"),
        userId: user.id,
      }),
    ]);

    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;
    const repeats = Array.from({ length: 3 }, () => claimUsage({ kind: "lessonStart", targetId }));

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 3);
    } finally {
      held.release();
      await held.done;
    }

    await expect(Promise.all(repeats)).resolves.toStrictEqual(
      Array.from({ length: 3 }, () => ({ status: "allowed" })),
    );

    await expect(
      prisma.usageRecord.findUniqueOrThrow({ where: { id: claim.id } }),
    ).resolves.toMatchObject({ countedAt: STARTED, createdAt: claim.createdAt, generated: true });

    await expect(
      prisma.usageRecord.count({ where: { kind: "lessonStart", userId: user.id } }),
    ).resolves.toBe(21);

    await expect(
      claimUsage({ kind: "lessonStart", targetId: randomUUID() }),
    ).resolves.toMatchObject({ status: "limitReached" });
  });

  it("keeps a start older than the rolling window replayable without charging it today", async () => {
    const { claim, targetId, user } = await atLimit();
    const old = new Date("2026-09-01T10:00:00Z");

    await learningEventFixture({
      contentIds: { lessonId: targetId },
      startedAt: old,
      userId: user.id,
    });

    await expect(claimUsage({ kind: "lessonStart", targetId })).resolves.toStrictEqual({
      status: "allowed",
    });

    await expect(
      prisma.usageRecord.findUniqueOrThrow({ where: { id: claim.id } }),
    ).resolves.toMatchObject({ countedAt: old });

    await expect(
      prisma.usageRecord.count({
        where: {
          countedAt: { gt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000) },
          kind: "lessonStart",
          userId: user.id,
        },
      }),
    ).resolves.toBe(20);
  });

  it.each(["none", "otherLearner", "otherLesson", "review"] as const)(
    "does not grant a start from %s proof",
    async (proof) => {
      const { claim, targetId, user } = await atLimit();

      if (proof !== "none") {
        const owner = proof === "otherLearner" ? await userFixture() : user;

        await learningEventFixture({
          contentIds: { lessonId: proof === "otherLesson" ? randomUUID() : targetId },
          kind: proof === "review" ? "review" : "lesson",
          startedAt: STARTED,
          userId: owner.id,
        });
      }

      await expect(claimUsage({ kind: "lessonStart", targetId })).resolves.toMatchObject({
        status: "limitReached",
      });

      await expect(
        prisma.usageRecord.findUniqueOrThrow({ where: { id: claim.id } }),
      ).resolves.toMatchObject({ countedAt: null });
    },
  );
});
