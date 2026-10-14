import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { lockCourseHome } from "@zoonk/db/course-home";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it, vi } from "vitest";
import {
  createExistingAccount,
  signInAsGuest,
  signInWithPassword,
} from "../../../../auth/src/guests/_test-utils/guest-auth";
import { linkGuestAccount } from "../../../../auth/src/guests/link-guest-account";
import { upsertDailyProgress } from "../../stats/daily-progress";
import { createLibraryChapter } from "../chapters/create-library-chapter";
import { findOrCreateGoalCourse } from "./find-or-create-goal-course";
import { setGoalPrimaryCourse } from "./goal-primary-course";

/** BotID classifies requests on Vercel; persistence and sign-in use their real implementations. */
vi.mock("../../../../auth/node_modules/botid/server", () => ({
  checkBotId: vi.fn().mockResolvedValue({ isBot: false }),
}));

const PRIVATE_COURSE = {
  language: "en",
  normalizedTitle: "existing private",
  slug: "existing-private",
  title: "Existing private",
  visibility: "private" as const,
};

const PROVENANCE = {
  generatedAt: new Date("2026-09-01T00:00:00Z"),
  model: "test",
  promptVersion: "test",
  runId: "test",
};

async function createPrivateCourse(ownerId: string) {
  return findOrCreateGoalCourse({
    format: "personalized",
    provenance: PROVENANCE,
    scope: { language: "en", ownerId, targetLanguage: null },
    title: "Late internal approval process",
  });
}

async function createLinkOwners() {
  const [account, guest] = await Promise.all([
    createExistingAccount({ createdAt: PROVENANCE.generatedAt }),
    signInAsGuest(),
  ]);

  return { account, guest };
}

async function holdCourseHome(homeId: string) {
  const release = Promise.withResolvers<null>();
  const ready = Promise.withResolvers<number>();

  const held = prisma.$transaction(
    async (transaction) => {
      await lockCourseHome({ homeId, transaction });

      const [session] = await transaction.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;

      ready.resolve(session?.pid ?? 0);
      await release.promise;
    },
    { timeout: 12_000 },
  );

  const pid = await ready.promise;
  return { held, pid, release: () => release.resolve(null) };
}

async function waitForBlocked({ count = 1, pid }: { count?: number; pid: number }) {
  return vi.waitFor(
    async () => {
      const waiting = await prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
      `;

      const [first] = waiting;

      if (!first || waiting.length < count) {
        throw new Error(`Expected ${count} writer(s) blocked by database session ${pid}.`);
      }

      return first.pid;
    },
    { interval: 10, timeout: 4000 },
  );
}

function goalData(userId: string) {
  return {
    dailyMinutes: 20,
    kind: "learn" as const,
    language: "en",
    prompt: "Learn internal approvals",
    title: "Approvals",
    userId,
  };
}

describe("guest linking during private curriculum persistence", () => {
  it("preserves a private course committed while linking waits for the destination home", async () => {
    const { account, guest } = await createLinkOwners();

    const existingCourse = await prisma.course.create({
      data: { ...PRIVATE_COURSE, userId: guest.guestId },
    });

    const goal = await prisma.goal.create({ data: goalData(guest.guestId) });
    const { held, pid, release } = await holdCourseHome(account.userId);

    const linking = Promise.allSettled([
      signInWithPassword({ email: account.email, headers: guest.headers }),
    ]);

    const writing = (async () => {
      try {
        await waitForBlocked({ pid });
        const { course } = await createPrivateCourse(guest.guestId);
        await setGoalPrimaryCourse({ courseId: course.id, goalId: goal.id });
        return course;
      } finally {
        release();
        await held;
      }
    })();

    const [course, linked] = await Promise.all([writing, linking]);

    expect(linked).toMatchObject([{ status: "fulfilled" }]);

    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();

    await expect(prisma.course.findUnique({ where: { id: course.id } })).resolves.toMatchObject({
      userId: account.userId,
    });

    await expect(
      prisma.course.findUnique({ where: { id: existingCourse.id } }),
    ).resolves.toMatchObject({ userId: account.userId });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: course.id,
      userId: account.userId,
    });
  });

  it("includes a course committed by an in-flight writer before linking acquires the guest row", async () => {
    const { account, guest } = await createLinkOwners();
    const release = Promise.withResolvers<null>();
    const ready = Promise.withResolvers<number>();

    /** Hold the same home lock and user FK that the curriculum writer uses until linking waits. */
    const writing = prisma.$transaction(
      async (transaction) => {
        await lockCourseHome({ homeId: guest.guestId, transaction });

        const course = await transaction.course.create({
          data: { ...PRIVATE_COURSE, userId: guest.guestId },
        });

        const goal = await transaction.goal.create({
          data: { ...goalData(guest.guestId), primaryCourseId: course.id },
        });

        const [session] = await transaction.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;

        ready.resolve(session?.pid ?? 0);
        await release.promise;
        return { course, goal };
      },
      { timeout: 12_000 },
    );

    const pid = await ready.promise;

    const linking = Promise.allSettled([
      signInWithPassword({ email: account.email, headers: guest.headers }),
    ]);

    try {
      await waitForBlocked({ pid });
    } finally {
      release.resolve(null);
    }

    const [saved, linked] = await Promise.all([writing, linking]);

    expect(linked).toMatchObject([{ status: "fulfilled" }]);

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: saved.course.id } }),
    ).resolves.toMatchObject({ userId: account.userId });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: saved.goal.id } }),
    ).resolves.toMatchObject({ primaryCourseId: saved.course.id, userId: account.userId });
  });

  it("safely refuses a late private chapter while holding a guest with no courses through deletion", async () => {
    const { account, guest } = await createLinkOwners();
    const release = Promise.withResolvers<null>();
    const ready = Promise.withResolvers<number>();
    const identityKey = scopeIdentityKey({ key: randomUUID(), ownerId: guest.guestId });

    /** Delay a later merger after all private-content ownership updates have run. */
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
        const linkPid = await waitForBlocked({ pid });

        const result = Promise.allSettled([
          createLibraryChapter({
            description: "A private workflow chapter",
            homeCourseId: null,
            identityKey,
            language: "en",
            level: "beginner",
            objectives: ["Follow internal approvals"],
            ownerId: guest.guestId,
            provenance: PROVENANCE,
            targetLanguage: null,
            title: "Internal approvals",
          }),
          createPrivateCourse(guest.guestId),
        ]);

        await waitForBlocked({ count: 2, pid: linkPid });
        release.resolve(null);
        await held;
        return await result;
      } finally {
        release.resolve(null);
        await held;
      }
    })();

    const [linked, written] = await Promise.all([linking, writing]);

    expect(linked).toMatchObject([{ status: "fulfilled" }]);

    expect(written).toMatchObject([
      { reason: { code: "P2003" }, status: "rejected" },
      { reason: { code: "P2003" }, status: "rejected" },
    ]);

    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();
    await expect(prisma.chapter.count({ where: { identityKey } })).resolves.toBe(0);
    await expect(createPrivateCourse(guest.guestId)).rejects.toMatchObject({ code: "P2003" });
  });

  it("allows simultaneous and repeated links of one guest without deleting an account", async () => {
    const { account, guest } = await createLinkOwners();

    const course = await prisma.course.create({
      data: { ...PRIVATE_COURSE, userId: guest.guestId },
    });

    const links = await Promise.allSettled([
      signInWithPassword({ email: account.email, headers: guest.headers }),
      signInWithPassword({ email: account.email, headers: guest.headers }),
    ]);

    expect(links).toMatchObject([{ status: "fulfilled" }, { status: "fulfilled" }]);

    await linkGuestAccount({ account: { id: account.userId }, guestUserId: guest.guestId });
    await linkGuestAccount({ account: { id: account.userId }, guestUserId: account.userId });

    await expect(prisma.user.findUnique({ where: { id: account.userId } })).resolves.not.toBeNull();
    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();

    await expect(prisma.course.findUnique({ where: { id: course.id } })).resolves.toMatchObject({
      userId: account.userId,
    });
  });

  it("retries the rolled-back transfer when a competing writer reverses the guest progress and FK lock order", async () => {
    const { account, guest } = await createLinkOwners();
    const ready = Promise.withResolvers<number>();
    const write = Promise.withResolvers<null>();

    const writing = prisma.$transaction(
      async (transaction) => {
        /** Make the linker detect this deliberate cycle first, so this case exercises its retry. */
        await transaction.$executeRaw`SET LOCAL deadlock_timeout = '5s'`;

        /** Settlements now lock the owner first; deliberately retain the old order to test retry. */
        await transaction.$queryRaw`
          SELECT id FROM user_progress WHERE user_id = ${guest.guestId}::uuid FOR UPDATE
        `;

        const progress = await transaction.userProgress.findUniqueOrThrow({
          where: { userId: guest.guestId },
        });

        const completionDate = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });

        const [session] = await transaction.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;

        ready.resolve(session?.pid ?? 0);
        await write.promise;

        await upsertDailyProgress(transaction, {
          clampedEnergy: progress.currentEnergy + 1,
          date: completionDate,
          durationSeconds: 21,
          field: "interactiveCompleted",
          lessonsCompleted: 1,
          score: { brainPower: 7, correctCount: 1, incorrectCount: 0 },
          userId: guest.guestId,
        });

        return completionDate;
      },
      { timeout: 12_000 },
    );

    const written = Promise.allSettled([writing]);
    const pid = await ready.promise;

    const linking = Promise.allSettled([
      signInWithPassword({ email: account.email, headers: guest.headers }),
    ]);

    try {
      /** The link holds the guest row and waits on progress before this writer inserts its day. */
      await waitForBlocked({ pid });
    } finally {
      write.resolve(null);
    }

    const results = await Promise.all([linking, written]);

    expect(results).toMatchObject([[{ status: "fulfilled" }], [{ status: "fulfilled" }]]);

    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();

    await expect(
      prisma.dailyProgress.findMany({ where: { userId: account.userId } }),
    ).resolves.toMatchObject([
      {
        brainPowerEarned: 7,
        correctAnswers: 1,
        interactiveCompleted: 1,
        lessonsCompleted: 1,
        timeSpentSeconds: 21,
      },
    ]);

    await expect(prisma.dailyProgress.count({ where: { userId: guest.guestId } })).resolves.toBe(0);
  });
});
