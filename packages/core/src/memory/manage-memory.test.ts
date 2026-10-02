import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture, memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getMemoryCacheTag } from "../cache/tags";
import { deleteMemoryFact } from "./delete-memory-fact";
import { exportCurrentUserMemory } from "./export-current-user-memory";
import { getCurrentUserMemory } from "./get-current-user-memory";
import { undoMemoryChanges } from "./undo-memory-changes";
import { updateMemoryFact } from "./update-memory-fact";
import { updateMemorySettings } from "./update-memory-settings";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

// The sensitivity check is a paid model call; its behavior is covered by the memory-gate eval.
vi.mock("@zoonk/ai/tasks/v2/memory/gate", () => ({ gateMemoryFact: vi.fn() }));

const ADULT_BIRTH = { birthMonth: 5, birthYear: 1990 };
const DAY_MS = 86_400_000;

async function useAdult() {
  const user = await userFixture();
  await learningProfileFixture({ ...ADULT_BIRTH, userId: user.id });
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
    const user = await useAdult();

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

    expect(memory).toMatchObject({
      categories: ["goals", "background", "routine", "preferences", "learning", "context"],
      enabled: true,
    });

    expect(memory?.facts.map((fact) => fact.id)).toStrictEqual([newer.id, older.id]);

    expect(memory?.facts[0]).toMatchObject({
      category: "preferences",
      source: { id: null, kind: "chat" },
      statement: "Likes football examples",
    });
  });

  it("shows minors and learners of unknown age only goals and learning facts", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all([
      memoryFactFixture({ category: "learning", statement: "Mixes up fractions", userId: user.id }),
      memoryFactFixture({ category: "context", statement: "Lives in Recife", userId: user.id }),
    ]);

    const memory = await getCurrentUserMemory();

    expect(memory?.categories).toStrictEqual(["goals", "learning"]);
    expect(memory?.facts.map((fact) => fact.statement)).toStrictEqual(["Mixes up fractions"]);
  });
});

describe(updateMemorySettings, () => {
  it("turns memory off and on without touching the facts", async () => {
    const user = await useAdult();
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
  it("corrects a fact in place and makes it something the learner said", async () => {
    const user = await useAdult();

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
  });

  it("flags a correction that reveals something sensitive, after the response", async () => {
    const user = await useAdult();
    const fact = await memoryFactFixture({ category: "background", userId: user.id });

    vi.mocked(gateMemoryFact).mockResolvedValue({ decision: "keep", sensitive: true } as Awaited<
      ReturnType<typeof gateMemoryFact>
    >);

    await updateMemoryFact({ factId: fact.id, input: { statement: "Has diabetes" } });

    const [[check]] = vi.mocked(after).mock.calls as [[() => Promise<void>]];
    await check();

    expect(gateMemoryFact).toHaveBeenCalledExactlyOnceWith({
      allowSensitive: true,
      candidate: { category: "background", evidence: "Has diabetes", statement: "Has diabetes" },
    });

    const flagged = await prisma.memoryFact.findUniqueOrThrow({ where: { id: fact.id } });
    expect(flagged).toMatchObject({ sensitive: true, statement: "Has diabetes" });
  });

  it("refuses a category a minor's memory can't hold", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const fact = await memoryFactFixture({ category: "learning", userId: user.id });

    await expect(
      updateMemoryFact({ factId: fact.id, input: { category: "context" } }),
    ).resolves.toStrictEqual({ status: "categoryNotAllowed" });
  });

  it("never reveals or changes another learner's fact", async () => {
    const [owner] = await Promise.all([userFixture(), useAdult()]);
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

describe(deleteMemoryFact, () => {
  it("deletes a fact with the facts it replaced, and undo brings them all back", async () => {
    const user = await useAdult();
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
    const [owner, learner] = await Promise.all([userFixture(), useAdult()]);

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
    const user = await useAdult();
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
    const user = await useAdult();

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
  });

  it("never touches another learner's facts", async () => {
    const [owner] = await Promise.all([userFixture(), useAdult()]);
    const theirs = await memoryFactFixture({ userId: owner.id });

    await expect(
      undoMemoryChanges({ changes: [{ factId: theirs.id, previousFactId: null }] }),
    ).resolves.toStrictEqual({ status: "conflict" });

    const untouched = await prisma.memoryFact.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(untouched.status).toBe("active");
  });
});

describe(exportCurrentUserMemory, () => {
  it("exports every stored fact with its history and the insights shown", async () => {
    const user = await useAdult();
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
