import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
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
import { getAllowance } from "./get-allowance";

const NOW = new Date("2026-11-13T12:00:00Z");
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CUTOFF = new Date(NOW.getTime() - WINDOW_MS);

function start(targetId = randomUUID()) {
  return claimUsage({ kind: "lessonStart", targetId });
}

async function learner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

async function lessonAllowance() {
  const allowance = await getAllowance();
  return allowance?.items.find((item) => item.kind === "lessonStart");
}

describe("rolling lesson admission", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("counts claims a second inside the window, excludes its boundary and older claims, and admits only the twentieth start", async () => {
    const user = await learner();

    await Promise.all([
      usageRecordsFixture({
        count: 1,
        createdAt: new Date(CUTOFF.getTime() + 1000),
        userId: user.id,
      }),
      usageRecordsFixture({ count: 18, createdAt: NOW, userId: user.id }),
      usageRecordsFixture({ count: 1, createdAt: CUTOFF, userId: user.id }),
      usageRecordsFixture({
        count: 1,
        createdAt: new Date(CUTOFF.getTime() - 1000),
        userId: user.id,
      }),
    ]);

    await expect(lessonAllowance()).resolves.toMatchObject({
      availableAt: null,
      remaining: 1,
      rollingLimit: 20,
      usedLast30Days: 19,
    });

    await expect(start()).resolves.toStrictEqual({ status: "allowed" });
    const availableAt = new Date(NOW.getTime() + 1000);

    await expect(start()).resolves.toMatchObject({
      limit: {
        availableAt,
        limit: 20,
        period: "rolling30Days",
        resource: "lessonStart",
        tier: "free",
      },
      status: "limitReached",
    });

    await expect(lessonAllowance()).resolves.toMatchObject({
      availableAt,
      remaining: 0,
      rollingLimit: 20,
      usedLast30Days: 20,
    });

    vi.setSystemTime(availableAt);
    await expect(start()).resolves.toStrictEqual({ status: "allowed" });
  });

  it("returns the twentieth-newest claim's expiry when existing usage exceeds twenty", async () => {
    const user = await learner();

    await Promise.all([
      usageRecordsFixture({
        count: 5,
        createdAt: new Date(CUTOFF.getTime() + 1000),
        userId: user.id,
      }),
      usageRecordsFixture({
        count: 1,
        createdAt: new Date(CUTOFF.getTime() + 2000),
        userId: user.id,
      }),
      usageRecordsFixture({ count: 19, createdAt: NOW, userId: user.id }),
    ]);

    const availableAt = new Date(NOW.getTime() + 2000);

    await expect(start()).resolves.toMatchObject({
      limit: { availableAt },
      status: "limitReached",
    });

    await expect(lessonAllowance()).resolves.toMatchObject({ availableAt, usedLast30Days: 25 });
    vi.setSystemTime(new Date(NOW.getTime() + 1000));

    await expect(start()).resolves.toMatchObject({
      limit: { availableAt },
      status: "limitReached",
    });

    vi.setSystemTime(availableAt);
    await expect(start()).resolves.toStrictEqual({ status: "allowed" });
  });

  it("admits one concurrent new start at nineteen and replays a charged target whatever its age", async () => {
    const user = await learner();
    const oldTarget = randomUUID();

    await prisma.usageRecord.create({
      data: {
        createdAt: new Date(CUTOFF.getTime() - 1000),
        kind: "lessonStart",
        targetId: oldTarget,
        userId: user.id,
      },
    });

    await usageRecordsFixture({ count: 19, createdAt: NOW, userId: user.id });
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;
    const pending = Array.from({ length: 5 }, () => start());

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 5);
    } finally {
      held.release();
      await held.done;
    }

    const decisions = await Promise.all(pending);
    expect(decisions.filter((decision) => decision.status === "allowed")).toHaveLength(1);
    await expect(start(oldTarget)).resolves.toStrictEqual({ status: "allowed" });
    await expect(start(oldTarget)).resolves.toStrictEqual({ status: "allowed" });
    await expect(lessonAllowance()).resolves.toMatchObject({ usedLast30Days: 20 });
    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(21);
  });

  it("counts a predecessor's claim after waiting for the learner lock", async () => {
    const user = await learner();
    await usageRecordsFixture({ count: 19, createdAt: NOW, userId: user.id });

    const held = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.usageRecord.create({
          data: {
            createdAt: new Date(NOW.getTime() + 1000),
            kind: "lessonStart",
            targetId: randomUUID(),
            userId: user.id,
          },
        }),
      userId: user.id,
    });

    const pid = await held.pid;
    const pending = start();

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
      vi.setSystemTime(new Date(NOW.getTime() + 2000));
    } finally {
      held.release();
      await held.done;
    }

    await expect(pending).resolves.toMatchObject({
      limit: { period: "rolling30Days" },
      status: "limitReached",
    });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(20);
  });
});
