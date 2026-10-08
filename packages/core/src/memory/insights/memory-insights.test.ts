import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getGoalsCacheTag, getMemoryCacheTag } from "../../cache/tags";
import { getCurrentMemoryInsight } from "./get-current-memory-insight";
import { respondToMemoryInsight } from "./respond-to-memory-insight";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

const DAY_MS = 86_400_000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** An adult, whose memory is on until they turn it off; a minor's starts off. */
async function learnerWithGoal() {
  const user = await userFixture();

  const [goal] = await Promise.all([
    goalFixture({ studyTime: "07:00", userId: user.id }),
    learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: user.id }),
  ]);

  mockSession(user.id);
  return { goal, user };
}

describe(getCurrentMemoryInsight, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("needs a session", async () => {
    await expect(getCurrentMemoryInsight({})).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("shows the newest insight for the goal until the learner answers it", async () => {
    const { goal, user } = await learnerWithGoal();

    const insight = await memoryInsightFixture({
      goalId: goal.id,
      kind: "scheduleIdea",
      message: "Want to study at 8 pm?",
      payload: { studyTime: "20:00" },
      userId: user.id,
    });

    await expect(getCurrentMemoryInsight({ goalId: goal.id })).resolves.toStrictEqual({
      insight: {
        createdAt: insight.createdAt,
        goalId: goal.id,
        id: insight.id,
        kind: "scheduleIdea",
        message: "Want to study at 8 pm?",
        planChange: null,
        status: "pending",
        studyTime: "20:00",
      },
      status: "ready",
    });

    await respondToMemoryInsight({ input: { status: "dismissed" }, insightId: insight.id });

    await expect(getCurrentMemoryInsight({ goalId: goal.id })).resolves.toStrictEqual({
      insight: null,
      status: "ready",
    });
  });

  it("never brings back an older insight once a newer one was answered", async () => {
    const { user } = await learnerWithGoal();

    await Promise.all([
      memoryInsightFixture({
        createdAt: daysAgo(1),
        localDate: utcDay(daysAgo(1)),
        message: "Older tip",
        userId: user.id,
      }),
      memoryInsightFixture({ message: "Newer tip", status: "accepted", userId: user.id }),
    ]);

    await expect(getCurrentMemoryInsight({})).resolves.toMatchObject({ insight: null });
  });

  it("skips checks with nothing to say, stale insights, other goals and memory that is off", async () => {
    const { goal, user } = await learnerWithGoal();
    const otherGoal = await goalFixture({ userId: user.id });

    await Promise.all([
      memoryInsightFixture({ kind: null, message: null, userId: user.id }),
      memoryInsightFixture({
        createdAt: daysAgo(3),
        localDate: utcDay(daysAgo(3)),
        message: "Stale tip",
        userId: user.id,
      }),
      memoryInsightFixture({
        goalId: otherGoal.id,
        localDate: utcDay(daysAgo(1)),
        message: "Other goal",
        userId: user.id,
      }),
    ]);

    await expect(getCurrentMemoryInsight({ goalId: goal.id })).resolves.toMatchObject({
      insight: null,
    });

    await expect(getCurrentMemoryInsight({ goalId: otherGoal.id })).resolves.toMatchObject({
      insight: { message: "Other goal" },
    });

    await learningProfileFixture({ memoryEnabled: false, userId: user.id });

    await expect(getCurrentMemoryInsight({ goalId: otherGoal.id })).resolves.toMatchObject({
      insight: null,
    });
  });
});

describe(respondToMemoryInsight, () => {
  it("accepting a schedule idea moves the goal's study time", async () => {
    const { goal, user } = await learnerWithGoal();

    const insight = await memoryInsightFixture({
      goalId: goal.id,
      kind: "scheduleIdea",
      message: "Want to study at 8 pm?",
      payload: { studyTime: "20:00" },
      userId: user.id,
    });

    const result = await respondToMemoryInsight({
      input: { status: "accepted" },
      insightId: insight.id,
    });

    expect(result).toMatchObject({
      insight: { id: insight.id, status: "accepted" },
      status: "updated",
    });

    const updated = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(updated.studyTime).toBe("20:00");

    expect(revalidateTag).toHaveBeenCalledWith(getMemoryCacheTag(user.id), { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(getGoalsCacheTag(user.id), { expire: 0 });
  });

  it("dismissing changes nothing else, and an insight is answered once", async () => {
    const { goal, user } = await learnerWithGoal();

    const insight = await memoryInsightFixture({
      goalId: goal.id,
      kind: "scheduleIdea",
      message: "Want to study at 8 pm?",
      payload: { studyTime: "20:00" },
      userId: user.id,
    });

    await expect(
      respondToMemoryInsight({ input: { status: "dismissed" }, insightId: insight.id }),
    ).resolves.toMatchObject({ insight: { status: "dismissed" }, status: "updated" });

    await expect(
      respondToMemoryInsight({ input: { status: "accepted" }, insightId: insight.id }),
    ).resolves.toStrictEqual({ status: "alreadyAnswered" });

    const unchanged = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(unchanged.studyTime).toBe("07:00");
  });

  it("can't answer another learner's insight or a check with nothing to say", async () => {
    const [owner, { user }] = await Promise.all([userFixture(), learnerWithGoal()]);

    const [theirs, empty] = await Promise.all([
      memoryInsightFixture({ userId: owner.id }),
      memoryInsightFixture({ kind: null, message: null, userId: user.id }),
    ]);

    await expect(
      respondToMemoryInsight({ input: { status: "accepted" }, insightId: theirs.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      respondToMemoryInsight({ input: { status: "accepted" }, insightId: empty.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      respondToMemoryInsight({ input: { status: "accepted" }, insightId: "not-a-uuid" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
