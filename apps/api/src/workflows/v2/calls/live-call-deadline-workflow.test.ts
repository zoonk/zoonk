import { closeLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { expiredLiveCallFixture } from "./_test-utils/live-call-fixtures";
import { liveCallDeadlineWorkflow } from "./live-call-deadline-workflow";
import { recoverOverdueLiveCallsStep } from "./steps/live-call-recovery-steps";

/** Only the provider is replaced; recovery, slots, liability and settlement use PostgreSQL. */
vi.mock("@zoonk/ai/tasks/v2/language/live-call-session", () => ({
  closeLiveCallSession: vi.fn(),
  createLiveCallSession: vi.fn(),
  isLiveCallAvailable: () => true,
}));

const CLOSED = { reason: "close_requested", seconds: 15, status: "closed" as const };

describe(liveCallDeadlineWorkflow, () => {
  beforeEach(() => {
    vi.mocked(closeLiveCallSession).mockReset().mockResolvedValue(CLOSED);
  });

  it("expires an unredeemed reservation without provider spend", async () => {
    const connection = await expiredLiveCallFixture("pending");

    await expect(
      liveCallDeadlineWorkflow({ ...connection, connectionId: connection.id }),
    ).resolves.toMatchObject({ status: "closed" });

    expect(closeLiveCallSession).not.toHaveBeenCalled();

    await expect(
      prisma.usageRecord.findUniqueOrThrow({ where: { id: connection.usageRecordId } }),
    ).resolves.toMatchObject({ costMicros: 0, seconds: 0 });

    await expect(
      prisma.liveCallSlot.findUniqueOrThrow({ where: { userId: connection.userId } }),
    ).resolves.toMatchObject({ connectionId: null });
  });

  it("retries shutdown with sleep backoff in the same invocation then settles confirmed usage", async () => {
    const connection = await expiredLiveCallFixture();
    vi.mocked(closeLiveCallSession).mockRejectedValueOnce(new Error("Sideband timed out"));

    await expect(
      liveCallDeadlineWorkflow({ ...connection, connectionId: connection.id }),
    ).resolves.toMatchObject({ status: "closed" });

    expect(sleep).toHaveBeenNthCalledWith(1, connection.deadlineAt);
    expect(sleep).toHaveBeenNthCalledWith(2, "5s");
    expect(closeLiveCallSession).toHaveBeenCalledTimes(2);

    await expect(
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).resolves.toMatchObject({ costConfidence: "confirmed", liabilityMicros: 0, state: "closed" });
  });

  it.each(["active", "creating"] as const)(
    "ends finite retries for %s without releasing unconfirmed liability",
    async (state) => {
      const connection = await expiredLiveCallFixture(state);
      vi.mocked(closeLiveCallSession).mockRejectedValue(new Error("No terminal confirmation"));

      await expect(
        liveCallDeadlineWorkflow({ ...connection, connectionId: connection.id }),
      ).resolves.toStrictEqual({ status: "unconfirmed" });

      expect(sleep).toHaveBeenCalledTimes(5);
      expect(closeLiveCallSession).toHaveBeenCalledTimes(state === "active" ? 5 : 0);

      const stored = await prisma.liveCallConnection.findUniqueOrThrow({
        where: { id: connection.id },
      });

      expect(stored).toMatchObject({ costConfidence: "unconfirmed", state: "closing" });
      expect(stored.recoveryUnconfirmedAt).not.toBeNull();
      expect(stored.liabilityMicros).toBeGreaterThan(0);

      await expect(
        prisma.liveCallSlot.findUniqueOrThrow({ where: { userId: connection.userId } }),
      ).resolves.toMatchObject({ connectionId: connection.id });
    },
  );

  it("ignores a stale fenced timer", async () => {
    const connection = await expiredLiveCallFixture();

    await expect(
      liveCallDeadlineWorkflow({ ...connection, connectionId: connection.id, generation: 2 }),
    ).resolves.toMatchObject({ status: "stale" });

    expect(closeLiveCallSession).not.toHaveBeenCalled();

    await expect(
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).resolves.toMatchObject({ state: "active" });
  });

  it("uses the same core recovery through the existing daily-sweeps fallback", async () => {
    const connection = await expiredLiveCallFixture();
    await recoverOverdueLiveCallsStep();

    await expect(
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).resolves.toMatchObject({ state: "closed" });
  });
});
