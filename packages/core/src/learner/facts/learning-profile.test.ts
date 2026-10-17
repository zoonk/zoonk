import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture, memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession, mockSessionFailure } from "../../_test-utils/mock-session";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getActiveGoalId } from "../../goals/get-active-goal-id";
import { listCurrentUserGoals } from "../../goals/list-current-user-goals";
import { loadMemoryExport } from "../../memory/_utils/memory-export";
import { getCurrentUserMemory } from "../../memory/get-current-user-memory";
import { getCurrentMemoryInsight } from "../../memory/insights/get-current-memory-insight";
import { findLearningProfileView } from "../../profile/_utils/learning-profile-view";
import { getLearningProfile } from "../../profile/get-learning-profile";
import * as profileFacts from "./learning-profile";
import { readActiveGoal, readLearningProfile } from "./learning-profile";
import * as requestClock from "./request-instant";

describe("learning profile request facts", () => {
  beforeEach(() => {
    mockSession(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns one complete actor-owned profile without loading that actor's goals", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const profile = await learningProfileFixture({
      dailyLimitMinutes: 30,
      instructions: "Use concrete examples",
      interests: ["music"],
      memoryEnabled: false,
      soundsEnabled: false,
      userId: owner.id,
    });

    const fact = await countDatabaseStatements(() => readLearningProfile(owner.id));

    expect(fact).toStrictEqual({ result: profile, statements: 1, writes: 0 });
    await expect(readLearningProfile(other.id)).resolves.toBeNull();

    mockSession(owner.id);

    const view = await countDatabaseStatements(getLearningProfile);

    expect(view).toMatchObject({
      result: { activeGoalId: null, dailyLimitMinutes: 30, soundsEnabled: false },
      statements: 2,
      writes: 0,
    });
  });

  it.each(["active", "paused", "completed", "archived"] as const)(
    "keeps the owned stored %s selection rather than falling back to another active goal",
    async (status) => {
      const user = await userFixture();

      const [fallback, selected] = await Promise.all([
        goalFixture({ createdAt: new Date("2026-01-01"), userId: user.id }),
        goalFixture({ createdAt: new Date("2026-02-01"), status, userId: user.id }),
      ]);

      await learningProfileFixture({ activeGoalId: selected.id, userId: user.id });
      mockSession(user.id);

      await expect(getActiveGoalId()).resolves.toBe(selected.id);
      await expect(readActiveGoal(user.id)).resolves.toStrictEqual(selected);
      expect(selected.id).not.toBe(fallback.id);

      const list = await countDatabaseStatements(listCurrentUserGoals);

      assertReadBudget(list, 6);
      expect(list.result?.activeGoalId).toBe(selected.id);

      expect(list.result?.goals.some((goal) => goal.id === selected.id)).toBe(
        status !== "archived",
      );
    },
  );

  it("rejects a stored goal owned by another learner without using the active fallback", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const [selected] = await Promise.all([
      goalFixture({ userId: owner.id }),
      goalFixture({ userId: owner.id }),
    ]);

    if (!selected) {
      throw new Error("Missing selected fixture");
    }

    await learningProfileFixture({ activeGoalId: selected.id, userId: owner.id });
    await prisma.goal.update({ data: { userId: other.id }, where: { id: selected.id } });
    mockSession(owner.id);

    await expect(getActiveGoalId()).resolves.toBeNull();
    await expect(readActiveGoal(owner.id)).resolves.toBeNull();

    const list = await countDatabaseStatements(listCurrentUserGoals);

    assertReadBudget(list, 6);
    expect(list.result?.activeGoalId).toBeNull();
    expect(list.result?.goals.some((goal) => goal.id === selected.id)).toBe(false);
  });

  it("falls back to the earliest owned active goal only without a stored selection", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const [first] = await Promise.all([
      goalFixture({ createdAt: new Date("2026-02-01"), userId: owner.id }),
      goalFixture({ createdAt: new Date("2026-03-01"), userId: owner.id }),
      goalFixture({ createdAt: new Date("2026-01-01"), status: "paused", userId: owner.id }),
      goalFixture({ createdAt: new Date("2025-01-01"), userId: other.id }),
    ]);

    mockSession(owner.id);
    await expect(getActiveGoalId()).resolves.toBe(first.id);
    await expect(getLearningProfile()).resolves.toMatchObject({ activeGoalId: null });
    await learningProfileFixture({ activeGoalId: null, userId: owner.id });
    await expect(getActiveGoalId()).resolves.toBe(first.id);

    const list = await countDatabaseStatements(listCurrentUserGoals);

    assertReadBudget(list, 6);
    expect(list.result?.activeGoalId).toBe(first.id);
  });

  it("keeps visitors query-free, supports guests, and propagates session failures", async () => {
    const visitor = await countDatabaseStatements(() =>
      Promise.all([getActiveGoalId(), getLearningProfile(), listCurrentUserGoals()]),
    );

    expect(visitor).toStrictEqual({ result: [null, null, null], statements: 0, writes: 0 });

    const guest = await userFixture();
    mockGuestSession(guest.id);
    await expect(getActiveGoalId()).resolves.toBeNull();
    const goal = await goalFixture({ userId: guest.id });
    await expect(getActiveGoalId()).resolves.toBe(goal.id);
    const error = new Error("session unavailable");
    mockSessionFailure(error);
    await expect(getActiveGoalId()).rejects.toBe(error);
    await expect(getLearningProfile()).rejects.toBe(error);
    await expect(listCurrentUserGoals()).rejects.toBe(error);
  });

  it("projects a supplied GET profile while keeping the omitted write-response lookup fresh", async () => {
    const user = await userFixture();
    const profile = await learningProfileFixture({ soundsEnabled: false, userId: user.id });

    const supplied = await countDatabaseStatements(() =>
      findLearningProfileView(user.id, Promise.resolve(profile)),
    );

    expect(supplied).toMatchObject({ result: { soundsEnabled: false }, statements: 1, writes: 0 });

    await prisma.userLearningProfile.update({
      data: { soundsEnabled: true },
      where: { userId: user.id },
    });

    const fresh = await countDatabaseStatements(() => findLearningProfileView(user.id));

    expect(fresh).toMatchObject({ result: { soundsEnabled: true }, statements: 2, writes: 0 });
  });

  it("keeps write helpers independent of a previously loaded GET fact", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const profile = await learningProfileFixture({ soundsEnabled: false, userId: user.id });
    vi.spyOn(profileFacts, "readLearningProfile").mockResolvedValue(profile);

    await prisma.userLearningProfile.update({
      data: { activeGoalId: goal.id, soundsEnabled: true },
      where: { userId: user.id },
    });

    await expect(findActiveGoalId(user.id)).resolves.toBe(goal.id);

    await expect(findLearningProfileView(user.id)).resolves.toMatchObject({
      activeGoalId: goal.id,
      soundsEnabled: true,
    });
  });

  it("uses the same GET instant for memory expiry, insight recency and export time", async () => {
    const user = await userFixture();
    const instant = new Date("2026-07-12T12:00:00Z");

    const [fact, insight] = await Promise.all([
      memoryFactFixture({ expiresAt: new Date("2026-07-13T12:00:00Z"), userId: user.id }),
      memoryInsightFixture({
        createdAt: new Date("2026-07-11T12:00:00Z"),
        kind: "scheduleIdea",
        message: "Study at 8 pm?",
        userId: user.id,
      }),
    ]);

    mockSession(user.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    vi.spyOn(requestClock, "getRequestInstant").mockResolvedValue(instant);

    const reads = await countDatabaseStatements(() =>
      Promise.all([getCurrentUserMemory(), getCurrentMemoryInsight({}), loadMemoryExport(user.id)]),
    );

    expect(reads.writes).toBe(0);
    const [memory, current, exported] = reads.result;
    expect(memory?.facts.map((row) => row.id)).toStrictEqual([fact.id]);
    expect(current).toMatchObject({ insight: { id: insight.id }, status: "ready" });
    expect(exported.exportedAt).toStrictEqual(instant);
  });
});
