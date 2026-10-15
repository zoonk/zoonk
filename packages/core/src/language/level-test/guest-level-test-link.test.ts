import { prisma } from "@zoonk/db";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it, vi } from "vitest";
import {
  createExistingAccount,
  signInAsGuest,
  signInWithPassword,
} from "../../../../auth/src/guests/_test-utils/guest-auth";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import * as levelState from "./_utils/level-test-state";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { finishLanguageLevelTest } from "./finish-language-level-test";
import { type LevelTestBank } from "./level-test-contract";

/** BotID requires Vercel; sign-in, ownership transfer and all database writes stay real. */
vi.mock("../../../../auth/node_modules/botid/server", () => ({
  checkBotId: vi.fn().mockResolvedValue({ isBot: false }),
}));

async function createAnsweredTest(targetLanguage = "fr") {
  const [account, guest] = await Promise.all([
    createExistingAccount({ createdAt: new Date("2026-09-01T00:00:00Z") }),
    signInAsGuest(),
  ]);

  const levels = CEFR_LEVELS.slice(0, 5);

  const bank: LevelTestBank = {
    questions: levels.flatMap((level) =>
      (["reading", "listening"] as const).flatMap((skill) =>
        [0, 1].map((index) => ({
          answerIndex: 1,
          id: `${skill}-${level}-${index}`,
          level,
          options: ["a", "b", "c", "d"],
          passage: `${skill} passage ${level}`,
          question: "What does this say?",
          skill,
        })),
      ),
    ),
    speaking: levels.map((level) => ({ level, sentence: `Say ${level}`, translation: "Say it" })),
  };

  /** This test owns a different language pair from the other level-test suites. */
  await prisma.languageLevelTest.create({
    data: {
      content: bank,
      language: "es",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage,
    },
  });

  const goal = await prisma.goal.create({
    data: {
      dailyMinutes: 20,
      details: { level: "A2" },
      kind: "language",
      language: "es",
      prompt: "French",
      targetLanguage,
      title: "French",
      userId: guest.guestId,
    },
  });

  mockGuestSession(guest.guestId);

  await expect(
    answerLanguageLevelTest({
      goalId: goal.id,
      input: { answerIndex: 1, durationMs: 40_000, questionId: "reading-A2-0" },
    }),
  ).resolves.toMatchObject({ status: "ready" });

  return { account, goal, guest };
}

async function waitForBlocked(pid: number) {
  return vi.waitFor(
    async () => {
      const [waiting] = await prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
      `;

      if (!waiting) {
        throw new Error(`Expected a writer blocked by database session ${pid}.`);
      }

      return waiting.pid;
    },
    { interval: 10, timeout: 4000 },
  );
}

async function finishWhileLinking({
  account,
  goal,
  guest,
}: Awaited<ReturnType<typeof createAnsweredTest>>) {
  const seen = Promise.withResolvers<null>();
  const permit = Promise.withResolvers<null>();
  const ready = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();
  const loadContext = levelState.loadLevelTestContext;

  /** Pause after the real owned-goal read; the spy never substitutes context or query results. */
  const observed = vi.spyOn(levelState, "loadLevelTestContext").mockImplementation(async (id) => {
    const context = await loadContext(id);
    seen.resolve(null);
    await permit.promise;
    return context;
  });

  const finished = Promise.allSettled([finishLanguageLevelTest(goal.id)]);
  await seen.promise;

  /** Hold linking after it owns the guest but before it can finish merging account progress. */
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

  const linking = Promise.allSettled([
    signInWithPassword({ email: account.email, headers: guest.headers }),
  ]);

  try {
    const linkPid = await waitForBlocked(await ready.promise);
    permit.resolve(null);

    await vi.waitFor(
      async () => {
        const waiting = await prisma.$queryRaw<{ pid: number }[]>`
          SELECT pid FROM pg_stat_activity
          WHERE datname = current_database()
            AND ${linkPid} = ANY(pg_blocking_pids(pid))
            AND query LIKE '%UPDATE users SET learner_revision%'
        `;

        expect(waiting).toHaveLength(1);
      },
      { interval: 10, timeout: 4000 },
    );
  } finally {
    permit.resolve(null);
    release.resolve(null);
    await held;
    observed.mockRestore();
  }

  /** The revision marker now rejects the linked-away guest before a progress insert can fail its FK. */
  await expect(Promise.all([linking, finished])).resolves.toMatchObject([
    [{ status: "fulfilled" }],
    [{ reason: { message: "Cannot mark a missing learner changed" }, status: "rejected" }],
  ]);
}

describe("language level-test completion during guest linking", () => {
  it("leaves a failed finish uncounted so an account retry records every answer once", async () => {
    const owners = await createAnsweredTest();
    const { account, goal, guest } = owners;

    await finishWhileLinking(owners);

    const beforeRetry = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();

    await expect(prisma.dailyProgress.count({ where: { userId: account.userId } })).resolves.toBe(
      0,
    );

    await expect(
      prisma.learningEvent.count({ where: { goalId: goal.id, lessonKind: "levelTest" } }),
    ).resolves.toBe(0);

    mockSession(account.userId);

    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ status: "ready" });
    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ status: "ready" });

    const [saved, days, events, progress] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.dailyProgress.findMany({ where: { userId: account.userId } }),
      prisma.learningEvent.findMany({
        where: { goalId: goal.id, lessonKind: "levelTest", userId: account.userId },
      }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: account.userId } }),
    ]);

    expect(days.reduce((sum, day) => sum + day.timeSpentSeconds, 0)).toBe(40);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ correctAnswers: 1, incorrectAnswers: 0, seconds: 40 });

    expect(days).toMatchObject([
      {
        correctAnswers: 1,
        energyAtEnd: 0.2,
        incorrectAnswers: 0,
        interactiveCompleted: 1,
        timeSpentSeconds: 40,
      },
    ]);

    expect(progress).toMatchObject({ currentEnergy: 0.2, totalBrainPower: 0n });

    expect(beforeRetry).toMatchObject({
      details: { levelTest: { answers: [{ id: "reading-A2-0" }], counted: 0 } },
      userId: account.userId,
    });

    expect(saved).toMatchObject({ details: { levelTest: { counted: 1 } }, userId: account.userId });
  });

  it("counts once when two finishes have already read the same uncounted answers", async () => {
    const { goal, guest } = await createAnsweredTest("de");
    const loaded: levelState.LevelTestContext[] = [];
    const permit = Promise.withResolvers<null>();
    const loadContext = levelState.loadLevelTestContext;

    const observed = vi.spyOn(levelState, "loadLevelTestContext").mockImplementation(async (id) => {
      const context = await loadContext(id);
      loaded.push(context);

      if (loaded.length === 2) {
        permit.resolve(null);
      }

      await permit.promise;
      return context;
    });

    try {
      const results = await Promise.all([
        finishLanguageLevelTest(goal.id),
        finishLanguageLevelTest(goal.id),
      ]);

      expect(results).toMatchObject([{ status: "ready" }, { status: "ready" }]);
    } finally {
      permit.resolve(null);
      observed.mockRestore();
    }

    await expect(
      prisma.learningEvent.findMany({ where: { goalId: goal.id, lessonKind: "levelTest" } }),
    ).resolves.toMatchObject([{ correctAnswers: 1, incorrectAnswers: 0, seconds: 40 }]);

    await expect(
      prisma.dailyProgress.findMany({ where: { userId: guest.guestId } }),
    ).resolves.toMatchObject([
      { correctAnswers: 1, interactiveCompleted: 1, timeSpentSeconds: 40 },
    ]);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      details: { levelTest: { counted: 1 } },
    });
  });
});
