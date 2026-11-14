import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { chapterMapClaims } from "../mind-maps/_utils/bulk-chapters";
import { evaluateUsage } from "./_utils/evaluate-usage";
import { type UsageLedger, decideBundle } from "./_utils/usage-ledger";
import { claimUsage, claimUsageFor } from "./claim-usage";
import { getAllowance } from "./get-allowance";

const NOW = new Date("2026-11-13T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;
const LIMIT = 20;

async function lessonAllowance() {
  const allowance = await getAllowance();
  return allowance?.items.find((entry) => entry.kind === "lessonStart");
}

function freeLedger({ now, starts }: { now: Date; starts: readonly Date[] }): UsageLedger {
  const inWindow = starts
    .filter((at) => at.getTime() > now.getTime() - WINDOW_MS)
    .toSorted((a, b) => b.getTime() - a.getTime());

  return {
    claimed: new Set(),
    now,
    prepared: new Map(),
    totals: {
      activeGoals: 0,
      kinds: new Map(),
      lessonStarts: {
        count: inWindow.length,
        latest: inWindow.slice(0, LIMIT),
        latestPrepared: [],
        prepared: 0,
      },
      spentTodayMicros: 0,
    },
    viewer: { isGuest: false, tier: "free", userId: randomUUID() },
  };
}

function decideStart(ledger: UsageLedger) {
  return evaluateUsage({
    costMicros: 0,
    counts: {
      activeGoals: 0,
      day: 0,
      generatedTotal: 0,
      lastUsedAt: null,
      lessonStarts: ledger.totals.lessonStarts,
      month: 0,
      secondsThisMonth: 0,
      secondsToday: 0,
      spentTodayMicros: 0,
      total: 0,
    },
    generated: false,
    kind: "lessonStart",
    now: ledger.now,
    tier: "free",
  });
}

describe("the window", () => {
  it("refuses exactly at 20 in the window, and availableAt is the first instant a start is allowed", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ max: 5 * DAY_MS, min: -40 * DAY_MS }), { maxLength: 60 }),
        (offsets) => {
          const starts = offsets.map((offset) => new Date(NOW.getTime() + offset));
          const ledger = freeLedger({ now: NOW, starts });
          const decision = decideStart(ledger);
          const used = ledger.totals.lessonStarts.count;

          expect(decision.status === "limitReached").toBe(used >= LIMIT);

          if (decision.status !== "limitReached" || decision.limit.period !== "rolling30Days") {
            return;
          }

          const { availableAt } = decision.limit;
          const past = starts;
          expect(availableAt.getTime()).toBeGreaterThan(NOW.getTime());

          expect(decideStart(freeLedger({ now: availableAt, starts: past })).status).toBe(
            "allowed",
          );

          expect(
            decideStart(freeLedger({ now: new Date(availableAt.getTime() - 1), starts: past }))
              .status,
          ).toBe("limitReached");
        },
      ),
    );
  });
});

describe("a map's bundle of lesson starts", () => {
  it("returns a date at which the same bundle is admitted", () => {
    const starts = Array.from(
      { length: 15 },
      (_, index) => new Date(NOW.getTime() - (index + 1) * DAY_MS),
    );

    const claims = chapterMapClaims({
      chapterId: randomUUID(),
      lessonIds: Array.from({ length: 8 }, () => randomUUID()),
    });

    const refused = decideBundle({ claims, ledger: freeLedger({ now: NOW, starts }) });

    if (refused.decision.status !== "limitReached") {
      throw new Error("expected a refusal");
    }

    if (refused.decision.limit.period !== "rolling30Days") {
      throw new Error("expected the rolling limit");
    }

    const { availableAt } = refused.decision.limit;
    expect(availableAt).toStrictEqual(new Date(NOW.getTime() + 17 * DAY_MS));

    expect(
      decideBundle({
        claims,
        ledger: freeLedger({ now: new Date(availableAt.getTime() - 1), starts }),
      }).decision.status,
    ).toBe("limitReached");

    const again = decideBundle({ claims, ledger: freeLedger({ now: availableAt, starts }) });
    expect(again.decision.status).toBe("allowed");
  });

  it("shows what a learner with no lesson starts gets for a chapter of 21 unwritten lessons", () => {
    const claims = chapterMapClaims({
      chapterId: randomUUID(),
      lessonIds: Array.from({ length: 21 }, () => randomUUID()),
    });

    const refused = decideBundle({ claims, ledger: freeLedger({ now: NOW, starts: [] }) });

    expect(refused.decision).toMatchObject({
      limit: { availableAt: null, resource: "chapterLessons" },
      status: "limitReached",
    });
  });
});

describe("admission against the database", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("refuses the 21st start when the 20th was stamped by a server whose clock is a second ahead", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await usageRecordsFixture({ count: 19, createdAt: NOW, userId: user.id });

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date(NOW.getTime() + 1000),
      userId: user.id,
    });

    const decision = await claimUsage({ kind: "lessonStart", targetId: randomUUID() });
    expect(decision.status).toBe("limitReached");
  });

  it("shows what lessons written ahead and never started do to the next start", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all(
      Array.from({ length: LIMIT }, () =>
        claimUsageFor({
          generated: true,
          kind: "lessonStart",
          targetId: randomUUID(),
          userId: user.id,
        }),
      ),
    );

    const runs = await prisma.learningEvent.count({ where: { userId: user.id } });
    const allowance = await getAllowance();
    const item = allowance?.items.find((entry) => entry.kind === "lessonStart");

    expect(runs).toBe(0);
    expect(item).toMatchObject({ availableAt: null, remaining: 20, usedLast30Days: 0 });
    const decision = await claimUsage({ kind: "lessonStart", targetId: randomUUID() });
    expect(decision.status).toBe("allowed");

    await expect(lessonAllowance()).resolves.toMatchObject({ remaining: 19, usedLast30Days: 1 });
  });

  it("counts a prepared lesson once from its first start, not its preparation date", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const targetId = randomUUID();
    vi.setSystemTime(new Date(NOW.getTime() - 40 * DAY_MS));

    await expect(
      claimUsageFor({ generated: true, kind: "lessonStart", targetId, userId: user.id }),
    ).resolves.toMatchObject({ status: "allowed" });

    vi.setSystemTime(NOW);

    await expect(claimUsage({ kind: "lessonStart", targetId })).resolves.toMatchObject({
      status: "allowed",
    });

    await expect(
      prisma.usageRecord.findUnique({
        where: { userUsageTarget: { kind: "lessonStart", targetId, userId: user.id } },
      }),
    ).resolves.toMatchObject({
      countedAt: NOW,
      createdAt: new Date(NOW.getTime() - 40 * DAY_MS),
      generated: true,
    });

    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    await claimUsage({ kind: "lessonStart", targetId });

    await expect(lessonAllowance()).resolves.toMatchObject({ usedLast30Days: 1 });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("serializes a start and automatic preparation of the same lesson into one counted row", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const targetId = randomUUID();
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;

    const pending = [
      claimUsageFor({ generated: true, kind: "lessonStart", targetId, userId: user.id }),
      claimUsage({ kind: "lessonStart", targetId }),
      claimUsage({ kind: "lessonStart", targetId }),
    ];

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 3);
    } finally {
      held.release();
      await held.done;
    }

    await expect(Promise.all(pending)).resolves.toStrictEqual(
      Array.from({ length: 3 }, () => ({ status: "allowed" })),
    );

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(lessonAllowance()).resolves.toMatchObject({ remaining: 19, usedLast30Days: 1 });
  });

  it("bounds automatic preparation by counted plus unstarted lessons without charging those lessons to the learner", async () => {
    const user = await userFixture();
    mockSession(user.id);
    await usageRecordsFixture({ count: 14, createdAt: NOW, userId: user.id });

    const decisions = await Promise.all(
      Array.from({ length: 7 }, () =>
        claimUsageFor({
          generated: true,
          kind: "lessonStart",
          targetId: randomUUID(),
          userId: user.id,
        }),
      ),
    );

    expect(decisions.filter((decision) => decision.status === "allowed")).toHaveLength(6);

    expect(decisions.find((decision) => decision.status !== "allowed")).toMatchObject({
      limit: { resource: "lessonPreparation" },
      status: "limitReached",
    });

    await expect(lessonAllowance()).resolves.toMatchObject({
      availableAt: null,
      remaining: 6,
      usedLast30Days: 14,
    });

    await expect(
      claimUsage({ kind: "lessonStart", targetId: randomUUID() }),
    ).resolves.toMatchObject({ status: "allowed" });
  });
});
