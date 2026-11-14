import { randomUUID } from "node:crypto";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import {
  liveCallFixture,
  liveCallHistoryFixture,
} from "../language/conversations/_test-utils/live-call-fixture";
import { claimUsage } from "./claim-usage";
import { getAllowance } from "./get-allowance";
import { getCallMonthlyBudgetMicros, getLiveCallReservationMicros } from "./limits";

const NOW = new Date("2026-12-01T12:00:00Z");

async function allowanceForTest(kind: "conversation" | "mindMap") {
  const allowance = await getAllowance();
  return allowance?.items.find((item) => item.kind === kind);
}

describe("rolling allowances", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps November claims on December 1 and opens when the limiting claim ages out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const user = await userFixture();
    mockSession(user.id);

    await usageRecordsFixture({
      count: 10,
      createdAt: new Date("2026-11-29T12:00:00Z"),
      kind: "mindMap",
      userId: user.id,
    });

    await expect(claimUsage({ kind: "mindMap", targetId: randomUUID() })).resolves.toMatchObject({
      limit: { availableAt: new Date("2026-12-29T12:00:00Z"), period: "rolling30Days" },
      status: "limitReached",
    });

    vi.setSystemTime(new Date("2026-12-29T12:00:00Z"));

    await expect(claimUsage({ kind: "mindMap", targetId: randomUUID() })).resolves.toMatchObject({
      status: "allowed",
    });
  });

  it("does not delay a time opening for money that already admits the requested call", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date("2026-11-10T12:00:00Z"),
      kind: "conversation",
      seconds: 300,
      userId: user.id,
    });

    await liveCallHistoryFixture({
      conversationId: conversation.id,
      costMicros: getCallMonthlyBudgetMicros("free") - getLiveCallReservationMicros(120) + 1,
      createdAt: new Date("2026-11-25T12:00:00Z"),
      userId: user.id,
    });

    const availableAt = new Date("2026-12-10T12:00:00Z");

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toMatchObject({
      limit: { availableAt, resource: "callSeconds" },
      status: "limitReached",
    });

    vi.setSystemTime(availableAt);

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toMatchObject({ status: "allowed" });
  });

  it.each(["mindMap", "conversation"] as const)("uses strict 30-day edges for %s", async (kind) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const user = await userFixture();
    mockSession(user.id);
    const edge = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    await usageRecordsFixture({ count: 1, createdAt: edge, kind, seconds: 100, userId: user.id });

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date(edge.getTime() + 1000),
      kind,
      seconds: 100,
      userId: user.id,
    });

    const resultItem = await allowanceForTest(kind);

    expect(resultItem).toMatchObject({
      availableAt: null,
      usedLast30Days: kind === "conversation" ? 100 : 1,
    });
  });

  it("waits for the right weighted seconds claim, and permits a start at its exact aging instant", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const user = await userFixture();
    mockSession(user.id);

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date("2026-11-10T12:00:00Z"),
      kind: "conversation",
      seconds: 100,
      userId: user.id,
    });

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date("2026-11-20T12:00:00Z"),
      kind: "conversation",
      seconds: 300,
      userId: user.id,
    });

    const availableAt = new Date("2026-12-20T12:00:00Z");

    await expect(allowanceForTest("conversation")).resolves.toMatchObject({
      availableAt,
      remaining: 0,
      usedLast30Days: 400,
    });

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId: randomUUID() }),
    ).resolves.toMatchObject({
      limit: { availableAt, period: "rolling30Days", resource: "callSeconds" },
      status: "limitReached",
    });

    vi.setSystemTime(availableAt);

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId: randomUUID() }),
    ).resolves.toMatchObject({ status: "allowed" });
  });

  it.each(["mindMap", "conversation"] as const)(
    "serializes concurrent %s starts and keeps a replay free",
    async (kind) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      const user = await userFixture();
      mockSession(user.id);

      await usageRecordsFixture({
        count: kind === "conversation" ? 1 : 9,
        createdAt: new Date("2026-11-29T12:00:00Z"),
        kind,
        seconds: kind === "conversation" ? 299 : 0,
        userId: user.id,
      });

      const held = holdLearnerLock({ userId: user.id });
      const pid = await held.pid;
      const ids = Array.from({ length: 3 }, () => randomUUID());
      const pending = ids.map((targetId) => claimUsage({ kind, seconds: 1, targetId }));

      try {
        await waitForBlockedStatement(pid, LEARNER_LOCK, 3);
      } finally {
        held.release();
        await held.done;
      }

      const results = await Promise.all(pending);
      expect(results.filter((result) => result.status === "allowed")).toHaveLength(1);
      expect(results.filter((result) => result.status === "limitReached")).toHaveLength(2);
      const targetId = ids[results.findIndex((result) => result.status === "allowed")]!;

      await expect(claimUsage({ kind, seconds: 1, targetId })).resolves.toMatchObject({
        status: "allowed",
      });
    },
  );

  it("rolls the call money budget at its exact edge without waiting for the calendar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { user, conversation } = await liveCallFixture();
    mockSession(user.id);
    const edge = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    const budget = getCallMonthlyBudgetMicros("free");

    await liveCallHistoryFixture({
      conversationId: conversation.id,
      costMicros: budget,
      createdAt: edge,
      userId: user.id,
    });

    await liveCallHistoryFixture({
      conversationId: conversation.id,
      costMicros: budget,
      createdAt: new Date(edge.getTime() + 1000),
      userId: user.id,
    });

    const availableAt = new Date(NOW.getTime() + 1000);

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId: randomUUID() }),
    ).resolves.toMatchObject({
      limit: { availableAt, period: "rolling30Days", resource: "aiSpend" },
      status: "limitReached",
    });

    await expect(allowanceForTest("conversation")).resolves.toMatchObject({
      availableAt,
      remaining: 0,
    });

    vi.setSystemTime(availableAt);

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId: randomUUID() }),
    ).resolves.toMatchObject({ status: "allowed" });
  });

  it("dates a known call at the first instant the same start is admitted", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const user = await userFixture();
    mockSession(user.id);

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date("2026-11-10T12:00:00Z"),
      kind: "conversation",
      seconds: 180,
      userId: user.id,
    });

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date("2026-11-20T12:00:00Z"),
      kind: "conversation",
      seconds: 240,
      userId: user.id,
    });

    await expect(allowanceForTest("conversation")).resolves.toMatchObject({
      availableAt: new Date("2026-12-10T12:00:00Z"),
    });

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toMatchObject({
      limit: { availableAt: new Date("2026-12-10T12:00:00Z") },
      status: "limitReached",
    });
  });

  it("dates a known call when positive money capacity returns", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);
    const budget = getCallMonthlyBudgetMicros("free");

    await liveCallHistoryFixture({
      conversationId: conversation.id,
      costMicros: 2,
      createdAt: new Date("2026-11-10T12:00:00Z"),
      userId: user.id,
    });

    await liveCallHistoryFixture({
      conversationId: conversation.id,
      costMicros: budget - 1,
      createdAt: new Date("2026-11-20T12:00:00Z"),
      userId: user.id,
    });

    await expect(allowanceForTest("conversation")).resolves.toMatchObject({
      availableAt: new Date("2026-12-10T12:00:00Z"),
    });

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toMatchObject({
      limit: { availableAt: new Date("2026-12-10T12:00:00Z"), resource: "aiSpend" },
      status: "limitReached",
    });
  });

  it.each(["mindMap", "conversation"] as const)(
    "does not promise a rolling %s opening before a blocked UTC day clears",
    async (kind) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      const user = await userFixture();
      mockSession(user.id);

      await usageRecordsFixture({
        count: kind === "conversation" ? 1 : 7,
        createdAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000 + 1000),
        kind,
        seconds: kind === "conversation" ? 180 : 0,
        userId: user.id,
      });

      await usageRecordsFixture({
        count: kind === "conversation" ? 1 : 3,
        createdAt: NOW,
        kind,
        seconds: kind === "conversation" ? 120 : 0,
        userId: user.id,
      });

      const availableAt = new Date("2026-12-02T00:00:00Z");
      await expect(allowanceForTest(kind)).resolves.toMatchObject({ availableAt });

      await expect(
        claimUsage({ kind, seconds: 60, targetId: randomUUID() }),
      ).resolves.toMatchObject({
        limit: { availableAt, period: "rolling30Days" },
        status: "limitReached",
      });

      vi.setSystemTime(availableAt);

      await expect(
        claimUsage({ kind, seconds: 60, targetId: randomUUID() }),
      ).resolves.toMatchObject({ status: "allowed" });
    },
  );
});
