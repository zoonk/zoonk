import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture, memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getMemoryCacheTag } from "../cache/tags";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { deleteMemoryFact } from "./delete-memory-fact";
import { exportCurrentUserMemory } from "./export-current-user-memory";
import { getCurrentUserMemory } from "./get-current-user-memory";
import { undoMemoryChanges } from "./undo-memory-changes";
import { updateMemoryFact } from "./update-memory-fact";
import { updateMemorySettings } from "./update-memory-settings";

const DAY_MS = 86_400_000;
const TOTAL_PAIRS = 20;
/** Eight transactions leave room in the ten-connection pool for post-commit queries. */
const CONCURRENT_PAIRS = 4;

/** Observe the real waiting lock, rather than guessing when a write reached the learner row. */
async function waitForBlockedBy(holderPID: number): Promise<void> {
  await vi.waitFor(async () => {
    const [row] = await prisma.$queryRaw<{ blocked: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity AS backend
        WHERE ${holderPID}::int = ANY(pg_blocking_pids(backend.pid))
      ) AS blocked
    `;

    expect(row?.blocked).toBe(true);
  });
}

async function useLearner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

describe(getCurrentUserMemory, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("needs a session", async () => {
    await expect(getCurrentUserMemory()).resolves.toBeNull();
  });

  it("lists active, unexpired facts newest first with where each came from", async () => {
    const user = await useLearner();

    const older = await memoryFactFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      sourceRef: { id: null, kind: "onboarding" },
      statement: "Needs 700+ in the essay",
      userId: user.id,
    });

    const newer = await memoryFactFixture({
      category: "preferences",
      sourceRef: { id: null, kind: "chat" },
      statement: "Likes football examples",
      userId: user.id,
    });

    await Promise.all([
      memoryFactFixture({ statement: "Wants Medicine", status: "superseded", userId: user.id }),
      memoryFactFixture({ deletedAt: new Date(), status: "deleted", userId: user.id }),
      memoryFactFixture({ expiresAt: new Date(Date.now() - DAY_MS), userId: user.id }),
    ]);

    const memory = await getCurrentUserMemory();

    expect(memory?.enabled).toBe(true);
    expect(memory?.facts.map((fact) => fact.id)).toStrictEqual([newer.id, older.id]);

    expect(memory?.facts[0]).toMatchObject({
      category: "preferences",
      source: { id: null, kind: "chat" },
      statement: "Likes football examples",
    });
  });
});

describe(updateMemorySettings, () => {
  it("takes the learner's lock before an existing profile, beside a user-first writer", async () => {
    const user = await useLearner();
    await learningProfileFixture({ memoryEnabled: true, userId: user.id });
    const locked = Promise.withResolvers<number>();
    const resume = Promise.withResolvers<null>();

    const first = prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      locked.resolve(backend?.pid ?? 0);
      await resume.promise;

      await tx.userLearningProfile.update({
        data: { soundsEnabled: false },
        where: { userId: user.id },
      });
    });

    let settled: Promise<unknown> = Promise.allSettled([first]);
    let memory: ReturnType<typeof updateMemorySettings> | undefined;

    void first.catch((error: unknown) => locked.reject(error));

    try {
      const pid = await locked.promise;
      memory = updateMemorySettings({ enabled: false });
      settled = Promise.allSettled([first, memory]);
      await waitForBlockedBy(pid);
    } finally {
      resume.resolve(null);
      await settled;
    }

    await expect(first).resolves.toBeUndefined();
    await expect(memory).resolves.toStrictEqual({ enabled: false, status: "updated" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ memoryEnabled: false, soundsEnabled: false });
  });

  it("turns memory off and on without touching the facts", async () => {
    const user = await useLearner();
    await memoryFactFixture({ userId: user.id });

    await expect(updateMemorySettings({ enabled: false })).resolves.toStrictEqual({
      enabled: false,
      status: "updated",
    });

    expect(revalidateTag).toHaveBeenCalledWith(getMemoryCacheTag(user.id), { expire: 0 });
    const off = await getCurrentUserMemory();

    expect(off?.enabled).toBe(false);
    expect(off?.facts).toHaveLength(1);

    await updateMemorySettings({ enabled: true });
    await expect(getCurrentUserMemory()).resolves.toMatchObject({ enabled: true });

    // Turning on what's already on changes nothing.
    await expect(updateMemorySettings({ enabled: true })).resolves.toStrictEqual({
      enabled: true,
      status: "updated",
    });
  });

  it("changes nothing for a learner without a profile who keeps memory on", async () => {
    await useLearner();

    await expect(updateMemorySettings({ enabled: true })).resolves.toStrictEqual({
      enabled: true,
      status: "updated",
    });
  });

  it("creates the profile for a learner who has none yet", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await updateMemorySettings({ enabled: false });

    const profile = await prisma.userLearningProfile.findUnique({ where: { userId: user.id } });
    expect(profile?.memoryEnabled).toBe(false);
  });
});

describe(updateMemoryFact, () => {
  it("rolls back its marks when the fact is deactivated while the learner lock waits", async () => {
    const user = await useLearner();
    const fact = await memoryFactFixture({ statement: "Original", userId: user.id });
    const locked = Promise.withResolvers<number>();
    const resume = Promise.withResolvers<null>();

    const first = prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      locked.resolve(backend?.pid ?? 0);
      await resume.promise;
      await tx.memoryFact.update({ data: { status: "deleted" }, where: { id: fact.id } });
    });

    let settled: Promise<unknown> = Promise.allSettled([first]);
    let memory: ReturnType<typeof updateMemoryFact> | undefined;

    void first.catch((error: unknown) => locked.reject(error));

    try {
      const pid = await locked.promise;
      memory = updateMemoryFact({ factId: fact.id, input: { statement: "Changed" } });
      settled = Promise.allSettled([first, memory]);
      await waitForBlockedBy(pid);
    } finally {
      resume.resolve(null);
      await settled;
    }

    await expect(first).resolves.toBeUndefined();
    await expect(memory).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } }),
    ).resolves.toMatchObject({ statement: "Original", status: "deleted" });

    expect(revalidateTag).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("does not bump an already inactive fact", async () => {
    const user = await useLearner();
    const fact = await memoryFactFixture({ status: "superseded", userId: user.id });

    await expect(
      updateMemoryFact({ factId: fact.id, input: { category: "context" } }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("corrects a fact in place and makes it something the learner said", async () => {
    const user = await useLearner();

    const fact = await memoryFactFixture({
      category: "routine",
      confidence: 0.6,
      origin: "noticed",
      statement: "Studies after 8 pm",
      userId: user.id,
    });

    const result = await updateMemoryFact({
      factId: fact.id,
      input: { statement: "Studies after 9 pm on weekdays" },
    });

    expect(result).toMatchObject({
      fact: {
        category: "routine",
        confidence: 1,
        id: fact.id,
        origin: "said",
        statement: "Studies after 9 pm on weekdays",
      },
      status: "updated",
    });

    await expect(prisma.memoryFact.count({ where: { userId: user.id } })).resolves.toBe(1);

    await updateMemoryFact({ factId: fact.id, input: { category: "preferences" } });

    // Saving the same correction again changes nothing.
    await expect(
      updateMemoryFact({
        factId: fact.id,
        input: { category: "preferences", statement: "Studies after 9 pm on weekdays" },
      }),
    ).resolves.toMatchObject({
      fact: { category: "preferences", statement: "Studies after 9 pm on weekdays" },
      status: "updated",
    });
  });

  it("flags a correction that reveals something sensitive, after the response", async () => {
    const user = await useLearner();
    const fact = await memoryFactFixture({ category: "background", userId: user.id });

    vi.mocked(gateMemoryFact).mockResolvedValue({ decision: "keep", sensitive: true } as Awaited<
      ReturnType<typeof gateMemoryFact>
    >);

    await updateMemoryFact({ factId: fact.id, input: { statement: "Has diabetes" } });

    const [[check]] = vi.mocked(after).mock.calls as [[() => Promise<void>]];
    await check();

    expect(gateMemoryFact).toHaveBeenCalledExactlyOnceWith({
      candidate: { category: "background", evidence: "Has diabetes", statement: "Has diabetes" },
    });

    const flagged = await prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } });
    expect(flagged).toMatchObject({ sensitive: true, statement: "Has diabetes" });
  });

  it("never reveals or changes another learner's fact", async () => {
    const [owner] = await Promise.all([userFixture(), useLearner()]);
    const fact = await memoryFactFixture({ statement: "Owner's fact", userId: owner.id });

    await expect(
      updateMemoryFact({ factId: fact.id, input: { statement: "Changed" } }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      updateMemoryFact({ factId: "not-a-uuid", input: { statement: "Changed" } }),
    ).resolves.toStrictEqual({ status: "notFound" });

    const unchanged = await prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } });
    expect(unchanged.statement).toBe("Owner's fact");
  });
});

describe("memory and answer transaction lock order", () => {
  it.each(["settings", "fact"] as const)(
    "serializes 20 %s saves with 20 real answer transactions",
    async (kind) => {
      const user = await useLearner();
      const skill = await skillFixture();
      const goal = await goalFixture({ userId: user.id });
      const plan = await planFixture({ goalId: goal.id });

      const [item, fact] = await Promise.all([
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        memoryFactFixture({ userId: user.id }),
        learnerSkillFixture({
          difficulty: 5,
          lastReviewedAt: new Date(Date.now() - DAY_MS),
          reps: 1,
          skillId: skill.id,
          stability: 3,
          state: "learning",
          userId: user.id,
        }),
        learningProfileFixture({ userId: user.id }),
      ]);

      // Each batch asks for the other value: its first save changes it, the rest find it already
      // so and roll their marks back, all still taking the learner's lock first.
      const saveMemory = (batch: number) =>
        kind === "settings"
          ? updateMemorySettings({ enabled: batch % 2 === 1 })
          : updateMemoryFact({
              factId: fact.id,
              input: { category: batch % 2 === 0 ? "preferences" : "routine" },
            });

      const saveAnswer = () =>
        recordLearnerAnswer({
          answer: { selectedIndex: 0 },
          graded: { durationMs: 1000, isCorrect: true },
          itemId: item.id,
          language: "en",
          purpose: "learning",
          skillId: skill.id,
          timeZone: "UTC",
          userId: user.id,
        });

      for (let start = 0; start < TOTAL_PAIRS; start += CONCURRENT_PAIRS) {
        const writes = Array.from(
          { length: Math.min(CONCURRENT_PAIRS, TOTAL_PAIRS - start) },
          (_, offset) =>
            (start + offset) % 2 === 0
              ? [saveMemory(start / CONCURRENT_PAIRS), saveAnswer()]
              : [saveAnswer(), saveMemory(start / CONCURRENT_PAIRS)],
        ).flat();

        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Bound concurrent admission to the real pool, keeping every pair concurrent.
          await Promise.all(writes);
        } finally {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Drain every started leaf before a failure can leave the test.
          await Promise.allSettled(writes);
        }
      }

      // One per answer, and one per batch of memory saves.

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ inputVersion: 20 });

      await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(20);

      await expect(
        prisma.learnerSkill.findUniqueOrThrow({
          where: { userSkill: { skillId: skill.id, userId: user.id } },
        }),
      ).resolves.toMatchObject({ reps: 21 });
    },
  );
});

describe(deleteMemoryFact, () => {
  it("deletes a fact with the facts it replaced, and undo brings them all back", async () => {
    const user = await useLearner();
    const current = await memoryFactFixture({ statement: "Wants Law", userId: user.id });

    const replaced = await memoryFactFixture({
      statement: "Wants Medicine",
      status: "superseded",
      supersededById: current.id,
      userId: user.id,
    });

    const result = await deleteMemoryFact(current.id);

    expect(result).toMatchObject({
      change: { action: "removed", fact: null, previous: { id: current.id } },
      status: "deleted",
    });

    const deleted = await prisma.memoryFact.findMany({
      orderBy: { statement: "asc" },
      where: { id: { in: [current.id, replaced.id] } },
    });

    expect(deleted.map((fact) => fact.status)).toStrictEqual(["deleted", "deleted"]);
    expect(deleted[0]?.deletedAt).toStrictEqual(deleted[1]?.deletedAt);

    await expect(
      undoMemoryChanges({ changes: [{ factId: null, previousFactId: current.id }] }),
    ).resolves.toMatchObject({
      removedFactIds: [],
      restored: [{ id: current.id }],
      status: "undone",
    });

    const restored = await prisma.memoryFact.findMany({
      orderBy: { statement: "asc" },
      where: { id: { in: [current.id, replaced.id] } },
    });

    expect(restored.map((fact) => [fact.status, fact.deletedAt])).toStrictEqual([
      ["active", null],
      ["superseded", null],
    ]);
  });

  it("can't delete another learner's fact or one that is already deleted", async () => {
    const [owner, learner] = await Promise.all([userFixture(), useLearner()]);

    const [theirs, deleted] = await Promise.all([
      memoryFactFixture({ userId: owner.id }),
      memoryFactFixture({ deletedAt: new Date(), status: "deleted", userId: learner.id }),
    ]);

    await expect(deleteMemoryFact(theirs.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(deleteMemoryFact(deleted.id)).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(undoMemoryChanges, () => {
  it("takes back an added fact and puts a replaced fact back in its place", async () => {
    const user = await useLearner();
    const previous = await memoryFactFixture({ statement: "Wants Medicine", userId: user.id });

    const [replacement, added] = await Promise.all([
      memoryFactFixture({ statement: "Wants Law", userId: user.id }),
      memoryFactFixture({ category: "preferences", statement: "Likes football", userId: user.id }),
    ]);

    await prisma.memoryFact.update({
      data: { status: "superseded", supersededById: replacement.id },
      where: { id: previous.id },
    });

    const result = await undoMemoryChanges({
      changes: [
        { factId: replacement.id, previousFactId: previous.id },
        { factId: added.id, previousFactId: null },
      ],
    });

    expect(result).toMatchObject({
      removedFactIds: [added.id, replacement.id],
      restored: [{ id: previous.id, statement: "Wants Medicine" }],
      status: "undone",
    });

    const memory = await getCurrentUserMemory();
    expect(memory?.facts.map((fact) => fact.statement)).toStrictEqual(["Wants Medicine"]);
  });

  it("undoes nothing when one change can't be undone anymore", async () => {
    const user = await useLearner();

    const [added, alreadyDeleted] = await Promise.all([
      memoryFactFixture({ statement: "Likes chess", userId: user.id }),
      memoryFactFixture({ deletedAt: new Date(), status: "deleted", userId: user.id }),
    ]);

    await expect(
      undoMemoryChanges({
        // Undone newest first, so the valid change is applied before the other one fails.
        changes: [
          { factId: alreadyDeleted.id, previousFactId: null },
          { factId: added.id, previousFactId: null },
        ],
      }),
    ).resolves.toStrictEqual({ status: "conflict" });

    const untouched = await prisma.memoryFact.findUniqueOrThrow({ where: { id: added.id } });
    expect(untouched.status).toBe("active");
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("never touches another learner's facts", async () => {
    const [owner] = await Promise.all([userFixture(), useLearner()]);
    const theirs = await memoryFactFixture({ userId: owner.id });

    await expect(
      undoMemoryChanges({ changes: [{ factId: theirs.id, previousFactId: null }] }),
    ).resolves.toStrictEqual({ status: "conflict" });

    const untouched = await prisma.memoryFact.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(untouched.status).toBe("active");
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("bumps a guest once when several added facts are taken back", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    mockGuestSession(guest.id);

    const facts = await Promise.all([
      memoryFactFixture({ userId: guest.id }),
      memoryFactFixture({ userId: guest.id }),
    ]);

    await expect(
      undoMemoryChanges({
        changes: facts.map((fact) => ({ factId: fact.id, previousFactId: null })),
      }),
    ).resolves.toMatchObject({ status: "undone" });

    await expect(
      prisma.memoryFact.count({ where: { status: "deleted", userId: guest.id } }),
    ).resolves.toBe(2);
  });

  it("does not bump an empty undo or an unauthenticated attempt", async () => {
    await useLearner();

    await expect(undoMemoryChanges({ changes: [] })).resolves.toStrictEqual({
      removedFactIds: [],
      restored: [],
      status: "undone",
    });

    mockSession(null);

    await expect(undoMemoryChanges({ changes: [] })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});

describe(exportCurrentUserMemory, () => {
  it("exports every stored fact with its history and the insights shown", async () => {
    const user = await useLearner();
    const current = await memoryFactFixture({ statement: "Wants Law", userId: user.id });

    await Promise.all([
      memoryFactFixture({
        statement: "Wants Medicine",
        status: "superseded",
        supersededById: current.id,
        userId: user.id,
      }),
      memoryFactFixture({ deletedAt: new Date(), status: "deleted", userId: user.id }),
      memoryInsightFixture({ message: "Try a short break.", userId: user.id }),
      memoryInsightFixture({
        kind: null,
        localDate: new Date(Date.UTC(2020, 0, 1)),
        message: null,
        userId: user.id,
      }),
    ]);

    const exported = await exportCurrentUserMemory();

    expect(exported?.enabled).toBe(true);

    expect(exported?.facts.map((fact) => [fact.statement, fact.status]).toSorted()).toStrictEqual([
      ["Wants Law", "active"],
      ["Wants Medicine", "superseded"],
      ["Wants to pass a test exam", "deleted"],
    ]);

    expect(exported?.insights).toMatchObject([{ kind: "tip", message: "Try a short break." }]);
  });

  it("needs a session", async () => {
    mockSession(null);
    await expect(exportCurrentUserMemory()).resolves.toBeNull();
  });
});
