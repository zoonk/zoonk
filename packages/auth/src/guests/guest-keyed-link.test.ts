import { randomUUID } from "node:crypto";
import { prisma, sql } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { waitForBlocked } from "./_test-utils/blocked-sessions";
import { createExistingAccount, signInAsGuest, signInWithPassword } from "./_test-utils/guest-auth";
import { createLesson, createSkill } from "./_test-utils/learner-data";
import { moveKeyedRows } from "./_utils/merge-keyed-rows";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

const OLDER = new Date("2026-09-01T00:00:00Z");

const insightDays = { seeded: 0 };

const TABLES = [
  "learner_skills",
  "milestones",
  "usage_records",
  "learner_sources",
  "memory_insights",
  "goal_understandings",
  "pronunciation_reviews",
  "step_example_lines",
] as const;

type KeyedTable = (typeof TABLES)[number];

async function seedSharedRows({ table, userIds }: { table: KeyedTable; userIds: string[] }) {
  const key = randomUUID();

  switch (table) {
    case "learner_skills": {
      const skill = await createSkill();

      return Promise.all(
        userIds.map((userId) =>
          prisma.learnerSkill.create({
            data: {
              createdAt: OLDER,
              difficulty: 4,
              due: OLDER,
              lapses: 1,
              lastReviewedAt: OLDER,
              recallDays: 3,
              reps: 7,
              skillId: skill.id,
              stability: 5,
              state: "solid",
              updatedAt: OLDER,
              userId,
            },
          }),
        ),
      );
    }
    case "milestones":
      return Promise.all(
        userIds.map((userId) =>
          prisma.milestone.create({
            data: { earnedAt: OLDER, key, kind: "glasses", shownAt: OLDER, userId },
          }),
        ),
      );
    case "usage_records":
      return Promise.all(
        userIds.map((userId) =>
          prisma.usageRecord.create({
            data: {
              costMicros: 123,
              createdAt: OLDER,
              generated: true,
              kind: "lessonStart",
              seconds: 17,
              targetId: key,
              userId,
            },
          }),
        ),
      );
    case "learner_sources": {
      const source = await prisma.source.create({
        data: {
          contentHash: key,
          fetchedAt: OLDER,
          identityKey: key,
          kind: "official",
          language: "en",
          title: "Shared source",
        },
      });

      return Promise.all(
        userIds.map((userId) =>
          prisma.learnerSource.create({
            data: { createdAt: OLDER, origin: "research", sourceId: source.id, userId },
          }),
        ),
      );
    }
    case "memory_insights": {
      insightDays.seeded += 1;
      const localDate = new Date(Date.UTC(2026, 0, insightDays.seeded));

      return Promise.all(
        userIds.map((userId) =>
          prisma.memoryInsight.create({
            data: { createdAt: OLDER, inputHash: key, localDate, userId },
          }),
        ),
      );
    }
    case "goal_understandings":
      return Promise.all(
        userIds.map((userId) =>
          prisma.goalUnderstanding.create({
            data: {
              createdAt: OLDER,
              generatedAt: OLDER,
              language: "en",
              normalizedPrompt: `learn ${key}`,
              result: { kind: "learn" },
              updatedAt: OLDER,
              userId,
            },
          }),
        ),
      );
    case "pronunciation_reviews": {
      const organization = await prisma.organization.create({
        data: { name: "Words", slug: `guest-link-words-${key}` },
      });

      const word = await prisma.word.create({
        data: { organizationId: organization.id, targetLanguage: "es", word: `hola-${key}` },
      });

      return Promise.all(
        userIds.map((userId) =>
          prisma.pronunciationReview.create({
            data: {
              createdAt: OLDER,
              dueAt: OLDER,
              language: "es",
              stage: 2,
              updatedAt: OLDER,
              userId,
              userLanguage: "en",
              wordId: word.id,
            },
          }),
        ),
      );
    }
    case "step_example_lines": {
      const lesson = await createLesson();

      const step = await prisma.step.create({
        data: {
          content: {},
          kind: "explanation",
          lessonId: lesson.id,
          model: "test-model",
          position: 0,
          promptVersion: "test",
          runId: key,
        },
      });

      return Promise.all(
        userIds.map((userId) =>
          prisma.stepExampleLine.create({
            data: {
              contextKey: key,
              createdAt: OLDER,
              generatedAt: OLDER,
              model: "test-model",
              promptVersion: "test",
              runId: key,
              stepId: step.id,
              text: "An example about the learner",
              updatedAt: OLDER,
              userId,
            },
          }),
        ),
      );
    }
    default:
      throw new Error("Unknown keyed table");
  }
}

function readRows({ table, userId }: { table: KeyedTable; userId: string }) {
  const where = { userId };

  switch (table) {
    case "learner_skills":
      return prisma.learnerSkill.findMany({ where });
    case "milestones":
      return prisma.milestone.findMany({ where });
    case "usage_records":
      return prisma.usageRecord.findMany({ where });
    case "learner_sources":
      return prisma.learnerSource.findMany({ where });
    case "memory_insights":
      return prisma.memoryInsight.findMany({ where });
    case "goal_understandings":
      return prisma.goalUnderstanding.findMany({ where });
    case "pronunciation_reviews":
      return prisma.pronunciationReview.findMany({ where });
    case "step_example_lines":
      return prisma.stepExampleLine.findMany({ where });
    default:
      throw new Error("Unknown keyed table");
  }
}

describe("guest keyed-row linking", () => {
  it.each(
    TABLES.flatMap((table) => [
      { direct: false, table },
      { direct: true, table },
    ]),
  )(
    "links concurrent guests sharing $table (direct transfer: $direct)",
    async ({ table, direct }) => {
      const [account, firstGuest, secondGuest] = await Promise.all([
        createExistingAccount({ createdAt: OLDER }),
        signInAsGuest(),
        signInAsGuest(),
      ]);

      const userIds = [firstGuest.guestId, secondGuest.guestId];
      const sourceRows = await seedSharedRows({ table, userIds });
      const release = Promise.withResolvers<null>();
      const ready = Promise.withResolvers<number>();

      const held = prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw(sql`
        SELECT id FROM ${sql([table])}
        WHERE user_id IN (${firstGuest.guestId}::uuid, ${secondGuest.guestId}::uuid)
        FOR UPDATE
      `);

          const [backend] = await transaction.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          ready.resolve(backend!.pid);
          await release.promise;
        },
        { timeout: 12_000 },
      );

      const blocker = await ready.promise;

      const linking = Promise.allSettled(
        [firstGuest, secondGuest].map((guest) =>
          direct
            ? prisma.$transaction((transaction) =>
                moveKeyedRows({ guestUserId: guest.guestId, transaction, userId: account.userId }),
              )
            : signInWithPassword({ email: account.email, headers: guest.headers }),
        ),
      );

      try {
        await waitForBlocked({ blocker, count: 2 });
      } finally {
        release.resolve(null);
        await held;
      }

      const outcomes = await linking;
      expect(outcomes).toMatchObject([{ status: "fulfilled" }, { status: "fulfilled" }]);
      const accountRows = await readRows({ table, userId: account.userId });
      expect(accountRows).toHaveLength(1);

      expect(sourceRows.map((row) => ({ ...row, userId: account.userId }))).toContainEqual(
        accountRows[0],
      );

      await expect(prisma.user.count({ where: { id: { in: userIds } } })).resolves.toBe(
        direct ? 2 : 0,
      );

      const remainingRows = await Promise.all(userIds.map((userId) => readRows({ table, userId })));
      expect(remainingRows).toStrictEqual([[], []]);
    },
  );

  it.each(TABLES)(
    "retains the account's full %s snapshot on collision and moves unique rows",
    async (table) => {
      const [account, guest] = await Promise.all([
        createExistingAccount({ createdAt: OLDER }),
        signInAsGuest(),
      ]);

      const [accountRow] = await seedSharedRows({
        table,
        userIds: [account.userId, guest.guestId],
      });

      const [uniqueRow] = await seedSharedRows({ table, userIds: [guest.guestId] });
      await signInWithPassword({ email: account.email, headers: guest.headers });
      const accountRows = await readRows({ table, userId: account.userId });
      expect(accountRows).toHaveLength(2);
      expect(accountRows).toContainEqual(accountRow);
      expect(accountRows).toContainEqual({ ...uniqueRow, userId: account.userId });
      await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();
    },
  );
});
