import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { waitForBlocked } from "./_test-utils/blocked-sessions";
import { createExistingAccount, signInAsGuest, signInWithPassword } from "./_test-utils/guest-auth";
import {
  mergeDailyProgress,
  mergeLearningProfile,
  mergeUserProgress,
} from "./_utils/merge-progress";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

const DAY = new Date("2026-09-01T00:00:00Z");
const LATER = new Date("2026-09-02T00:00:00Z");
const TABLES = ["daily_progress", "user_progress", "user_learning_profiles"] as const;
type Table = (typeof TABLES)[number];

async function seed({ table, userId, value }: { table: Table; userId: string; value: number }) {
  switch (table) {
    case "daily_progress":
      return prisma.dailyProgress.create({
        data: {
          brainPowerEarned: value,
          correctAnswers: value,
          date: DAY,
          dayOfWeek: 2,
          energyAtEnd: value,
          incorrectAnswers: value,
          interactiveCompleted: value,
          lessonsCompleted: value,
          staticCompleted: value,
          timeSpentSeconds: value,
          userId,
        },
      });
    case "user_progress":
      return prisma.userProgress.upsert({
        create: {
          currentEnergy: value,
          lastActiveAt: value > 5 ? LATER : DAY,
          totalBrainPower: value,
          userId,
        },
        update: {
          currentEnergy: value,
          lastActiveAt: value > 5 ? LATER : DAY,
          totalBrainPower: value,
        },
        where: { userId },
      });
    case "user_learning_profiles": {
      const goal = await prisma.goal.create({
        data: {
          dailyMinutes: value,
          kind: "learn",
          language: "en",
          prompt: "Learn chemistry",
          title: "Chemistry",
          userId,
        },
      });

      return prisma.userLearningProfile.create({
        data: {
          activeGoalId: goal.id,
          buddyGlasses: value > 5 ? "round" : "star",
          buddyKind: "zu",
          buddyName: `Buddy ${value}`,
          createdAt: DAY,
          dailyLimitMinutes: value,
          instructions: `Instructions ${value}`,
          interests: { value },
          memoryEnabled: value > 5,
          preferences: { value },
          soundsEnabled: value > 5,
          updatedAt: DAY,
          userId,
        },
      });
    }
    default:
      throw new Error("Unknown progress table");
  }
}

function read({ table, userId }: { table: Table; userId: string }) {
  switch (table) {
    case "daily_progress":
      return prisma.dailyProgress.findMany({ where: { userId } });
    case "user_progress":
      return prisma.userProgress.findMany({ where: { userId } });
    case "user_learning_profiles":
      return prisma.userLearningProfile.findMany({ where: { userId } });
    default:
      throw new Error("Unknown progress table");
  }
}

function merge({
  guestUserId,
  table,
  transaction,
  userId,
}: {
  guestUserId: string;
  table: Table;
  transaction: TransactionClient;
  userId: string;
}) {
  const context = { guestUserId, transaction, userId };

  switch (table) {
    case "daily_progress":
      return mergeDailyProgress(context);
    case "user_progress":
      return mergeUserProgress(context);
    case "user_learning_profiles":
      return mergeLearningProfile(context);
    default:
      throw new Error("Unknown progress table");
  }
}

async function holdRows({ table, userIds }: { table: Table; userIds: string[] }) {
  const ready = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();

  const held = prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw(
        sql`SELECT id FROM ${sql([table])} WHERE user_id = ANY(${userIds}::uuid[]) FOR UPDATE`,
      );

      const [backend] = await transaction.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;

      ready.resolve(backend!.pid);
      await release.promise;
    },
    { timeout: 12_000 },
  );

  const blocker = await ready.promise;
  return { blocker, held, release };
}

async function removeAccountRows({ table, userId }: { table: Table; userId: string }) {
  switch (table) {
    case "daily_progress":
      return prisma.dailyProgress.deleteMany({ where: { userId } });
    case "user_progress":
      return prisma.userProgress.deleteMany({ where: { userId } });
    case "user_learning_profiles":
      return prisma.userLearningProfile.deleteMany({ where: { userId } });
    default:
      throw new Error("Unknown progress table");
  }
}

function expectedCombined(table: Table) {
  switch (table) {
    case "daily_progress":
      return {
        brainPowerEarned: 10,
        correctAnswers: 10,
        energyAtEnd: 7,
        incorrectAnswers: 10,
        interactiveCompleted: 10,
        lessonsCompleted: 10,
        staticCompleted: 10,
        timeSpentSeconds: 10,
      };
    case "user_progress":
      return { currentEnergy: 7, lastActiveAt: LATER, totalBrainPower: 10n };
    case "user_learning_profiles":
      return {};
    default:
      throw new Error("Unknown progress table");
  }
}

async function assertCombined({ table, userId }: { table: Table; userId: string }) {
  await expect(read({ table, userId })).resolves.toMatchObject([expectedCombined(table)]);
}

describe("guest progress linking", () => {
  it.each(TABLES)("merges concurrent first %s rows atomically", async (table) => {
    const [account, first, second] = await Promise.all([
      createExistingAccount({ createdAt: DAY }),
      signInAsGuest(),
      signInAsGuest(),
    ]);

    await removeAccountRows({ table, userId: account.userId });
    const guestIds = [first.guestId, second.guestId];

    await Promise.all([
      seed({ table, userId: first.guestId, value: 3 }),
      seed({ table, userId: second.guestId, value: 7 }),
    ]);

    const lock = await holdRows({ table, userIds: guestIds });

    const transfers = Promise.allSettled(
      guestIds.map((guestUserId) =>
        prisma.$transaction((transaction) =>
          merge({ guestUserId, table, transaction, userId: account.userId }),
        ),
      ),
    );

    try {
      await waitForBlocked({ blocker: lock.blocker, count: 2 });
    } finally {
      lock.release.resolve(null);
      await lock.held;
    }

    await expect(transfers).resolves.toMatchObject([
      { status: "fulfilled" },
      { status: "fulfilled" },
    ]);

    await assertCombined({ table, userId: account.userId });

    await expect(
      Promise.all(guestIds.map((userId) => read({ table, userId }))),
    ).resolves.toStrictEqual([[], []]);
  });

  it.each(TABLES)(
    "merges a %s account row inserted while the guest transfer is waiting",
    async (table) => {
      const [account, guest] = await Promise.all([
        createExistingAccount({ createdAt: DAY }),
        signInAsGuest(),
      ]);

      await removeAccountRows({ table, userId: account.userId });
      const guestRow = await seed({ table, userId: guest.guestId, value: 3 });
      const lock = await holdRows({ table, userIds: [guest.guestId] });

      const transfer = Promise.allSettled([
        prisma.$transaction((transaction) =>
          merge({ guestUserId: guest.guestId, table, transaction, userId: account.userId }),
        ),
      ]);

      try {
        await waitForBlocked({ blocker: lock.blocker, count: 1 });
        await seed({ table, userId: account.userId, value: 7 });
      } finally {
        lock.release.resolve(null);
        await lock.held;
      }

      await expect(transfer).resolves.toMatchObject([{ status: "fulfilled" }]);
      await assertCombined({ table, userId: account.userId });
      await expect(read({ table, userId: guest.guestId })).resolves.toStrictEqual([]);
      const rows = await read({ table, userId: account.userId });
      expect(rows[0]?.id).not.toBe(guestRow.id);
    },
  );

  it.each(["daily_progress", "user_progress"] as const)(
    "keeps %s maxima written after the merge reads",
    async (table) => {
      const [account, guest] = await Promise.all([
        createExistingAccount({ createdAt: DAY }),
        signInAsGuest(),
      ]);

      await Promise.all([
        seed({ table, userId: account.userId, value: 3 }),
        seed({ table, userId: guest.guestId, value: 7 }),
      ]);

      const ready = Promise.withResolvers<number>();
      const write = Promise.withResolvers<null>();

      const held = prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          sql`SELECT id FROM ${sql([table])} WHERE user_id = ${account.userId}::uuid FOR UPDATE`,
        );

        const [backend] = await transaction.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;

        ready.resolve(backend!.pid);
        await write.promise;

        if (table === "daily_progress") {
          await transaction.dailyProgress.updateMany({
            data: { energyAtEnd: 99 },
            where: { userId: account.userId },
          });
        } else {
          await transaction.userProgress.update({
            data: { currentEnergy: 99, lastActiveAt: new Date("2026-09-03T00:00:00Z") },
            where: { userId: account.userId },
          });
        }
      });

      const blocker = await ready.promise;

      const transfer = prisma.$transaction((transaction) =>
        merge({ guestUserId: guest.guestId, table, transaction, userId: account.userId }),
      );

      try {
        await waitForBlocked({ blocker, count: 1 });
      } finally {
        write.resolve(null);
        await held;
      }

      await transfer;

      const energy =
        table === "daily_progress"
          ? await prisma.dailyProgress.findFirstOrThrow({ where: { userId: account.userId } })
          : await prisma.userProgress.findUniqueOrThrow({ where: { userId: account.userId } });

      const expected =
        table === "daily_progress"
          ? { energyAtEnd: 99 }
          : {
              currentEnergy: 99,
              lastActiveAt: new Date("2026-09-03T00:00:00Z"),
              totalBrainPower: 10n,
            };

      expect(energy).toMatchObject(expected);
    },
  );

  it("keeps a Buddy picked on the account while the guest profile is waiting", async () => {
    const [account, guest] = await Promise.all([
      createExistingAccount({ createdAt: DAY }),
      signInAsGuest(),
    ]);

    const table = "user_learning_profiles";

    await Promise.all([
      seed({ table, userId: account.userId, value: 7 }),
      seed({ table, userId: guest.guestId, value: 3 }),
    ]);

    await prisma.userLearningProfile.update({
      data: { buddyKind: null },
      where: { userId: account.userId },
    });

    const lock = await holdRows({ table, userIds: [guest.guestId] });

    const transfer = prisma.$transaction((transaction) =>
      mergeLearningProfile({ guestUserId: guest.guestId, transaction, userId: account.userId }),
    );

    try {
      await waitForBlocked({ blocker: lock.blocker, count: 1 });

      await prisma.userLearningProfile.update({
        data: {
          buddyGlasses: "retro",
          buddyKind: "otto",
          buddyName: "Picked now",
          dailyLimitMinutes: 99,
        },
        where: { userId: account.userId },
      });
    } finally {
      lock.release.resolve(null);
      await lock.held;
    }

    await transfer;

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: account.userId } }),
    ).resolves.toMatchObject({
      buddyGlasses: "retro",
      buddyKind: "otto",
      buddyName: "Picked now",
      dailyLimitMinutes: 99,
    });
  });

  it.each([
    { active: false, picked: false },
    { active: true, picked: false },
    { active: false, picked: true },
    { active: true, picked: true },
  ])(
    "keeps account settings and buddy (picked: $picked, guest goal: $active)",
    async ({ active, picked }) => {
      const [account, guest] = await Promise.all([
        createExistingAccount({ createdAt: DAY }),
        signInAsGuest(),
      ]);

      const table = "user_learning_profiles";

      const [accountRow, guestRow] = await Promise.all([
        seed({ table, userId: account.userId, value: 7 }),
        seed({ table, userId: guest.guestId, value: 3 }),
      ]);

      if (!active) {
        await prisma.userLearningProfile.update({
          data: { activeGoalId: null },
          where: { userId: guest.guestId },
        });
      }

      if (!picked) {
        await prisma.userLearningProfile.update({
          data: { buddyKind: null },
          where: { userId: account.userId },
        });
      }

      await prisma.$transaction((transaction) =>
        mergeLearningProfile({ guestUserId: guest.guestId, transaction, userId: account.userId }),
      );

      const profile = await prisma.userLearningProfile.findUniqueOrThrow({
        where: { userId: account.userId },
      });

      const guestGoalId = "activeGoalId" in guestRow ? guestRow.activeGoalId : null;
      const accountGoalId = "activeGoalId" in accountRow ? accountRow.activeGoalId : null;

      expect(profile).toMatchObject({
        ...accountRow,
        activeGoalId: active ? guestGoalId : accountGoalId,
        buddyGlasses: picked ? "round" : "star",
        buddyKind: "zu",
        buddyName: picked ? "Buddy 7" : "Buddy 3",
        updatedAt: expect.any(Date),
      });

      expect(profile.updatedAt.getTime()).toBeGreaterThan(DAY.getTime());
    },
  );

  it.each(TABLES)("preserves the guest's entire unique %s snapshot", async (table) => {
    const [account, guest] = await Promise.all([
      createExistingAccount({ createdAt: DAY }),
      signInAsGuest(),
    ]);

    await removeAccountRows({ table, userId: account.userId });
    const row = await seed({ table, userId: guest.guestId, value: 3 });

    await prisma.$transaction((transaction) =>
      merge({ guestUserId: guest.guestId, table, transaction, userId: account.userId }),
    );

    await expect(read({ table, userId: account.userId })).resolves.toStrictEqual([
      { ...row, userId: account.userId },
    ]);

    await expect(read({ table, userId: guest.guestId })).resolves.toStrictEqual([]);
  });

  it("links two full guest sessions with additive progress and account settings", async () => {
    const [account, first, second] = await Promise.all([
      createExistingAccount({ createdAt: DAY }),
      signInAsGuest(),
      signInAsGuest(),
    ]);

    await seed({ table: "user_progress", userId: account.userId, value: 0 });

    await Promise.all(
      TABLES.flatMap((table) => [
        seed({ table, userId: first.guestId, value: 3 }),
        seed({ table, userId: second.guestId, value: 7 }),
      ]),
    );

    const lock = await holdRows({
      table: "daily_progress",
      userIds: [first.guestId, second.guestId],
    });

    const links = Promise.allSettled(
      [first, second].map((guest) =>
        signInWithPassword({ email: account.email, headers: guest.headers }),
      ),
    );

    try {
      await waitForBlocked({ blocker: lock.blocker, count: 2 });
    } finally {
      lock.release.resolve(null);
      await lock.held;
    }

    await expect(links).resolves.toMatchObject([{ status: "fulfilled" }, { status: "fulfilled" }]);
    await Promise.all(TABLES.map((table) => assertCombined({ table, userId: account.userId })));

    await expect(
      prisma.user.count({ where: { id: { in: [first.guestId, second.guestId] } } }),
    ).resolves.toBe(0);
  });
});
