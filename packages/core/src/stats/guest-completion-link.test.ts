import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it, vi } from "vitest";
import {
  createExistingAccount,
  signInAsGuest,
  signInWithPassword,
} from "../../../auth/src/guests/_test-utils/guest-auth";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { lessonRunFixture } from "../lesson-player/_test-utils/lesson-run-fixture";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { getCompletionEnergyContext } from "./completion-energy";
import { upsertDailyProgress } from "./daily-progress";
import { recordAnsweredActivity } from "./record-answered-activity";

/** BotID requires Vercel; guest authentication, transactions and PostgreSQL locks stay real. */
vi.mock("../../../auth/node_modules/botid/server", () => ({
  checkBotId: vi.fn().mockResolvedValue({ isBot: false }),
}));

async function createLinkOwners() {
  const [account, guest] = await Promise.all([
    createExistingAccount({ createdAt: new Date("2026-09-01T00:00:00Z") }),
    signInAsGuest(),
  ]);

  return { account, guest };
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

/** Hold linking after it owns the guest, so a settlement must wait for the ownership decision. */
async function linkBeforeSettlement({
  account,
  guest,
  rejection,
  settle,
}: Awaited<ReturnType<typeof createLinkOwners>> & {
  /** How the settlement fails once the guest it was for is gone. */
  rejection: object;
  settle: () => Promise<unknown>;
}) {
  const release = Promise.withResolvers<null>();
  const ready = Promise.withResolvers<number>();

  const held = prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM user_progress WHERE user_id = ${account.userId}::uuid FOR UPDATE
      `;

      const [session] = await transaction.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;

      ready.resolve(session?.pid ?? 0);
      await release.promise;
    },
    { timeout: 12_000 },
  );

  const pid = await ready.promise;

  const linking = Promise.allSettled([
    signInWithPassword({ email: account.email, headers: guest.headers }),
  ]);

  const writing = (async () => {
    try {
      const linkPid = await waitForBlocked(pid);
      const result = Promise.allSettled([settle()]);
      await waitForBlocked(linkPid);
      release.resolve(null);
      await held;
      return await result;
    } finally {
      release.resolve(null);
      await held;
    }
  })();

  const results = await Promise.all([linking, writing]);

  expect(results).toMatchObject([
    [{ status: "fulfilled" }],
    [{ reason: rejection, status: "rejected" }],
  ]);

  await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();

  await expect(
    prisma.userProgress.findUniqueOrThrow({ where: { userId: account.userId } }),
  ).resolves.toMatchObject({ currentEnergy: 0, totalBrainPower: 0n });

  await expect(prisma.dailyProgress.count({ where: { userId: account.userId } })).resolves.toBe(0);
  await expect(prisma.dailyProgress.count({ where: { userId: guest.guestId } })).resolves.toBe(0);
  await expect(prisma.userProgress.count({ where: { userId: guest.guestId } })).resolves.toBe(0);
}

describe("guest completion during account linking", () => {
  it.each(["guest", "account"] as const)(
    "preserves a delayed %s completion with PostgreSQL's default deadlock detector settings",
    async (owner) => {
      const { account, guest } = await createLinkOwners();
      const userId = owner === "guest" ? guest.guestId : account.userId;
      const ready = Promise.withResolvers<{ date: Date; pid: number }>();
      const write = Promise.withResolvers<null>();

      await expect(prisma.userProgress.count({ where: { userId: guest.guestId } })).resolves.toBe(
        1,
      );

      const writing = prisma.$transaction(
        async (transaction) => {
          const context = await getCompletionEnergyContext({
            timeZone: "UTC",
            transaction,
            userId,
          });

          const [session] = await transaction.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          ready.resolve({ date: context.completionDate, pid: session?.pid ?? 0 });
          await write.promise;

          await transaction.userProgress.update({
            data: {
              currentEnergy: context.currentEnergy + 1,
              lastActiveAt: context.completedAt,
              totalBrainPower: { increment: 7 },
            },
            where: { userId },
          });

          await upsertDailyProgress(transaction, {
            clampedEnergy: context.currentEnergy + 1,
            date: context.completionDate,
            durationSeconds: 21,
            field: "interactiveCompleted",
            lessonsCompleted: 1,
            score: { brainPower: 7, correctCount: 1, incorrectCount: 0 },
            userId,
          });
        },
        { timeout: 12_000 },
      );

      const written = Promise.allSettled([writing]);
      const { date, pid } = await ready.promise;

      if (owner === "account") {
        await Promise.all(
          [guest.guestId, account.userId].map((dayOwner) =>
            prisma.dailyProgress.create({
              data: { date, dayOfWeek: date.getUTCDay(), userId: dayOwner },
            }),
          ),
        );
      }

      const linking = Promise.allSettled([
        signInWithPassword({ email: account.email, headers: guest.headers }),
      ]);

      try {
        await waitForBlocked(pid);

        // Wait beyond PostgreSQL's one-second deadlock detector before resuming completion.
        await new Promise((resolve) => {
          setTimeout(resolve, 1400);
        });
      } finally {
        write.resolve(null);
      }

      const [linked] = await Promise.all([linking, written]);
      expect(linked).toMatchObject([{ status: "fulfilled" }]);
      await writing;

      await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();

      await expect(
        prisma.userProgress.findUniqueOrThrow({ where: { userId: account.userId } }),
      ).resolves.toMatchObject({ currentEnergy: 1, totalBrainPower: 7n });

      await expect(
        prisma.dailyProgress.findMany({ where: { userId: account.userId } }),
      ).resolves.toMatchObject([
        {
          brainPowerEarned: 7,
          correctAnswers: 1,
          energyAtEnd: 1,
          incorrectAnswers: 0,
          interactiveCompleted: 1,
          lessonsCompleted: 1,
          timeSpentSeconds: 21,
        },
      ]);

      await expect(prisma.dailyProgress.count({ where: { userId: guest.guestId } })).resolves.toBe(
        0,
      );

      await expect(prisma.userProgress.count({ where: { userId: guest.guestId } })).resolves.toBe(
        0,
      );
    },
  );

  it("rolls back a waiting lesson completion and counts its account retry exactly once", async () => {
    const { account, guest } = await createLinkOwners();
    const { lesson } = await playableLessonFixture({ steps: ["hook", "explanation", "summary"] });
    const run = await lessonRunFixture({ lessonId: lesson.id, userId: guest.guestId });
    mockGuestSession(guest.guestId);

    const complete = () =>
      completeLibraryLesson({ input: { runId: run.id, timeZone: "UTC" }, lessonId: lesson.id });

    await linkBeforeSettlement({ account, guest, rejection: { code: "P2003" }, settle: complete });

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: run.id } }),
    ).resolves.toMatchObject({ brainPower: 0, endedAt: null, userId: account.userId });

    mockSession(account.userId);

    await expect(complete()).resolves.toMatchObject({
      completion: { brainPower: 10, isFirstCompletion: true, totalBrainPower: 10 },
      status: "completed",
    });

    await expect(complete()).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: run.id } }),
    ).resolves.toMatchObject({ brainPower: 10, endedAt: expect.any(Date), userId: account.userId });

    await expect(
      prisma.dailyProgress.findMany({ where: { userId: account.userId } }),
    ).resolves.toMatchObject([{ brainPowerEarned: 10, lessonsCompleted: 1, staticCompleted: 1 }]);

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: account.userId } }),
    ).resolves.toMatchObject({ totalBrainPower: 10n });
  });

  it("rolls back a waiting answered activity and safely records it under the linked account", async () => {
    const { account, guest } = await createLinkOwners();
    const goal = await goalFixture({ userId: guest.guestId });

    const activity = {
      answers: [{ durationMs: 21_000, isCorrect: true }],
      contentIds: { testOutId: goal.id },
      goalId: goal.id,
      lessonKind: "testOut" as const,
      timeZone: "UTC",
    };

    await linkBeforeSettlement({
      account,
      guest,
      rejection: { message: "Cannot lock a missing learner" },
      settle: () => recordAnsweredActivity({ ...activity, userId: guest.guestId }),
    });

    await expect(prisma.learningEvent.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    await recordAnsweredActivity({ ...activity, userId: account.userId });

    await expect(
      prisma.dailyProgress.findMany({ where: { userId: account.userId } }),
    ).resolves.toMatchObject([
      { brainPowerEarned: 0, correctAnswers: 1, interactiveCompleted: 1, timeSpentSeconds: 21 },
    ]);

    await expect(
      prisma.learningEvent.findMany({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject([
      { correctAnswers: 1, lessonKind: "testOut", seconds: 21, userId: account.userId },
    ]);
  });
});
