import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it, vi } from "vitest";
import {
  createExistingAccount,
  signInAsGuest,
  signInWithPassword,
} from "../../../auth/src/guests/_test-utils/guest-auth";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import * as milestoneAwards from "../milestones/award-milestones";
import * as blockCompletion from "./_utils/block-completion";
import { toBlockPayload } from "./block-payload";
import { BRAIN_POWER_BONUS } from "./brain-power";
import { finishStudyBlock } from "./finish-study-block";

/** BotID needs Vercel; Better Auth linking and all database operations remain real. */
vi.mock("../../../auth/node_modules/botid/server", () => ({
  checkBotId: vi.fn().mockResolvedValue({ isBot: false }),
}));

async function readyToFinish(userId: string, kind: "boss" | "weekly" = "weekly") {
  const skill = await skillFixture();
  const planItemId = crypto.randomUUID();

  const [session, item] = await Promise.all([
    studySessionFixture({ status: "active", userId }),
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
  ]);

  const [block, ledger] = await Promise.all([
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({
        checkpoint: {
          kind,
          mock: false,
          passMark: 1,
          phase: null,
          rematch: false,
          timeLimitMinutes: null,
        },
        itemIds: [item.id],
        planItemId,
      }),
      position: 2,
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    }),
    learningEventFixture({
      contentIds: { studySessionId: session.id },
      endedAt: null,
      kind: "session",
      seconds: 0,
      userId,
    }),
    studySessionBlockFixture({
      kind: "learn",
      position: 0,
      sessionId: session.id,
      status: "completed",
    }),
    studySessionBlockFixture({
      kind: "review",
      payload: toBlockPayload({
        capsules: [
          {
            format: "rapidFire",
            itemIds: [item.id],
            key: item.id,
            lessonId: null,
            skillIds: [],
            title: "Recall",
          },
        ],
      }),
      position: 1,
      sessionId: session.id,
      status: "completed",
    }),
    mistakeFixture({ fixedAt: new Date(), status: "fixed", userId }),
    attemptFixture({ itemId: item.id, studySessionId: session.id, userId }),
  ]);

  await prisma.learningEvent.update({ data: { endedAt: null }, where: { id: ledger.id } });

  return { block, ledger, planItemId, session };
}

async function waitForBlocked(pid: number) {
  return vi.waitFor(
    async () => {
      const waiting = await prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
      `;

      const [first] = waiting;

      if (!first) {
        throw new Error(`Expected a writer blocked by database session ${pid}.`);
      }

      return first.pid;
    },
    { interval: 10, timeout: 4000 },
  );
}

describe("session day settlement during guest linking", () => {
  it("settles the linked account's remaining full meal and session once on a completed question block retry", async () => {
    const [account, guest] = await Promise.all([
      createExistingAccount({ createdAt: new Date("2026-09-01T00:00:00Z") }),
      signInAsGuest(),
    ]);

    const { block, ledger, session } = await readyToFinish(guest.guestId);
    mockGuestSession(guest.guestId);

    const finish = () =>
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });

    const seen = Promise.withResolvers<null>();
    const permit = Promise.withResolvers<null>();
    const completeBlockMoment = blockCompletion.completeBlockMoment;

    /** Gate only orchestration after block commit; the wrapper calls the real day settlement. */
    const gatedMoment = vi
      .spyOn(blockCompletion, "completeBlockMoment")
      .mockImplementation(async (input) => {
        seen.resolve(null);
        await permit.promise;
        return completeBlockMoment(input);
      });

    const finished = Promise.allSettled([finish()]);

    try {
      await seen.promise;

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      ).resolves.toMatchObject({ status: "completed" });

      const linkRelease = Promise.withResolvers<null>();
      const linkReady = Promise.withResolvers<number>();

      const linkHeld = prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`
            SELECT id FROM user_progress WHERE user_id = ${account.userId}::uuid FOR UPDATE
          `;

          const [backend] = await transaction.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          linkReady.resolve(backend?.pid ?? 0);
          await linkRelease.promise;
        },
        { timeout: 12_000 },
      );

      const accountPid = await linkReady.promise;

      const linking = Promise.allSettled([
        signInWithPassword({ email: account.email, headers: guest.headers }),
      ]);

      try {
        /** Linking owns the guest before waiting for destination progress, but hasn't moved its answers. */
        const linkPid = await waitForBlocked(accountPid);
        permit.resolve(null);
        /** The completed checkpoint reaches full-meal settlement and waits for guest ownership. */
        await waitForBlocked(linkPid);
      } finally {
        linkRelease.resolve(null);
        await linkHeld;
        await linking;
      }

      await expect(linking).resolves.toMatchObject([{ status: "fulfilled" }]);
      await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();
    } finally {
      permit.resolve(null);
      await finished;
      gatedMoment.mockRestore();
    }

    // Settling the day marks the guest's revision first, and finds no guest anymore.
    await expect(finished).resolves.toMatchObject([
      { reason: { message: "Cannot mark a missing learner changed" }, status: "rejected" },
    ]);

    const transferred = await prisma.userProgress.findUniqueOrThrow({
      where: { userId: account.userId },
    });

    const paidBlock = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
    expect(paidBlock.brainPower).toBeGreaterThan(0);
    expect(transferred.totalBrainPower).toBe(BigInt(paidBlock.brainPower));

    /** The linked account's prior learning puts the remaining full meal across orange/young. */
    const before = await prisma.userProgress.update({
      data: { totalBrainPower: 7475n },
      where: { userId: account.userId },
    });

    await expect(
      prisma.milestone.findMany({ where: { userId: account.userId } }),
    ).resolves.toStrictEqual([]);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ fullMealAt: null, status: "active", userId: account.userId });

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: ledger.id } }),
    ).resolves.toMatchObject({ brainPower: 0, endedAt: null, userId: account.userId });

    mockSession(account.userId);

    // Try again on the linked account gets the block's moment with the full meal it now pays, once.
    await expect(finish()).resolves.toMatchObject({
      completion: {
        blockId: block.id,
        brainPower: paidBlock.brainPower + BRAIN_POWER_BONUS.fullMeal,
        fullMeal: { paid: true },
        sessionCompleted: true,
      },
      status: "ready",
    });

    await expect(finish()).resolves.toMatchObject({
      completion: {
        blockId: block.id,
        brainPower: paidBlock.brainPower,
        fullMeal: { paid: false },
        milestones: [],
      },
      status: "ready",
    });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({
      endedAt: expect.any(Date),
      fullMealAt: expect.any(Date),
      status: "completed",
    });

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: ledger.id } }),
    ).resolves.toMatchObject({
      brainPower: BRAIN_POWER_BONUS.fullMeal,
      correctAnswers: 1,
      endedAt: expect.any(Date),
    });

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: account.userId } }),
    ).resolves.toMatchObject({
      totalBrainPower: before.totalBrainPower + BigInt(BRAIN_POWER_BONUS.fullMeal),
    });

    await expect(
      prisma.dailyProgress.findMany({ where: { userId: account.userId } }),
    ).resolves.toMatchObject([
      { brainPowerEarned: paidBlock.brainPower + BRAIN_POWER_BONUS.fullMeal, correctAnswers: 1 },
    ]);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toStrictEqual(paidBlock);

    const milestones = await prisma.milestone.findMany({ where: { userId: account.userId } });

    expect(milestones.map((row) => `${row.kind}:${row.key}`).toSorted()).toStrictEqual([
      "belt:orange",
      "buddyStage:young",
      "glasses:aviator",
    ]);

    expect(milestones.every((row) => row.shownAt === null)).toBe(true);
  });

  it.each(["boss", "weekly"] as const)(
    "recovers an interrupted %s milestone stage from the original rewards after later progress",
    async (kind) => {
      const guest = await signInAsGuest();
      const { block, planItemId, session } = await readyToFinish(guest.guestId, kind);
      mockGuestSession(guest.guestId);

      /** A boss crosses orange itself; the weekly challenge reaches it with the full meal. */
      await prisma.userProgress.update({
        data: {
          totalBrainPower:
            kind === "boss" ? 7400n : BigInt(7475 - BRAIN_POWER_BONUS.weeklyChallenge - 2),
        },
        where: { userId: guest.guestId },
      });

      const finish = () =>
        finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });

      /** Simulate a failed milestone write after the real reward and day transactions commit. */
      const failedAward = vi
        .spyOn(milestoneAwards, "awardMilestones")
        .mockRejectedValueOnce(new Error("Milestone write interrupted"));

      try {
        await expect(finish()).rejects.toThrow("Milestone write interrupted");
      } finally {
        failedAward.mockRestore();
      }

      const paidBlock = await prisma.studySessionBlock.findUniqueOrThrow({
        where: { id: block.id },
      });

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toMatchObject({ fullMealAt: expect.any(Date), status: "completed" });

      /** Later learning must not replace the interval whose milestone write failed. */
      const later = await prisma.userProgress.update({
        data: { totalBrainPower: { increment: 10_000 } },
        where: { userId: guest.guestId },
      });

      // Try again gets the block's moment with the milestones the interrupted write owed it, once.
      const retried = await finish();
      const again = await finish();
      const milestones = await prisma.milestone.findMany({ where: { userId: guest.guestId } });

      const expected =
        kind === "boss"
          ? [`badge:trapHunter:${planItemId}`, "belt:orange", "buddyStage:young", "glasses:star"]
          : ["belt:orange", "buddyStage:young", "glasses:aviator"];

      expect(milestones.map((row) => `${row.kind}:${row.key}`).toSorted()).toStrictEqual(
        expected.toSorted(),
      );

      expect(retried).toMatchObject({
        completion: { blockId: block.id, brainPower: paidBlock.brainPower },
        status: "ready",
      });

      expect(
        retried.status === "ready"
          ? retried.completion.milestones.map((row) => `${row.kind}:${row.key}`).toSorted()
          : [],
      ).toStrictEqual(expected.toSorted());

      expect(again).toMatchObject({ completion: { milestones: [] }, status: "ready" });

      await expect(
        prisma.userProgress.findUniqueOrThrow({ where: { userId: guest.guestId } }),
      ).resolves.toStrictEqual(later);

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      ).resolves.toStrictEqual(paidBlock);
    },
  );
});
