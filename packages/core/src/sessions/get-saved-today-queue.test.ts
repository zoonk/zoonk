import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSavedTodayQueue } from "./get-saved-today-queue";

/** Next has no request context in Vitest; keep real authentication and database persistence. */
vi.unmock("../users/get-session");
vi.mock("@zoonk/auth", () => import("../../../auth/src/testing"));

const NOW = new Date("2026-03-10T12:00:00.000Z");
const TODAY = new Date("2026-03-10T00:00:00.000Z");

async function signIn(user: Awaited<ReturnType<typeof userFixture>>) {
  const result = await auth.api.signInEmail({
    body: { email: user.email, password: user.password },
    returnHeaders: true,
  });

  const cookie = result.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));
}

async function learner() {
  const user = await userFixture();
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  await signIn(user);
  return { goal, user };
}

async function savedDay({
  goalId,
  localDate = TODAY,
  startedAt = null,
  userId,
}: {
  goalId: string;
  localDate?: Date;
  startedAt?: Date | null;
  userId: string;
}) {
  const day = await studySessionFixture({ goalId, localDate, startedAt, userId });

  await studySessionBlockFixture({
    estimatedMinutes: 12,
    payload: { title: "Saved lesson" },
    sessionId: day.id,
  });

  return day;
}

describe(getSavedTodayQueue, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns no queue without an authenticated session", async () => {
    await expect(getSavedTodayQueue()).resolves.toBeNull();
  });

  it("propagates request identity failures", async () => {
    const error = new Error("Request headers unavailable");
    vi.mocked(headers).mockRejectedValueOnce(error);

    await expect(getSavedTodayQueue()).rejects.toBe(error);
  });

  it("leaves an unsaved day and overdue plan work untouched", async () => {
    const { goal, user } = await learner();
    const plan = await planFixture({ goalId: goal.id });

    const item = await planItemFixture({
      planId: plan.id,
      scheduledFor: new Date("2026-03-09T00:00:00.000Z"),
    });

    await expect(getSavedTodayQueue()).resolves.toBeNull();

    const [sessions, currentPlan, currentItem, changes] = await Promise.all([
      prisma.studySession.findMany({ where: { userId: user.id } }),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
      prisma.planChange.findMany({ where: { planId: plan.id } }),
    ]);

    expect(sessions).toStrictEqual([]);
    expect(currentPlan).toStrictEqual(plan);
    expect(currentItem).toStrictEqual(item);
    expect(changes).toStrictEqual([]);
  });

  it("reads saved counts and prefers a later active block without updating any blocks", async () => {
    const { goal, user } = await learner();
    const day = await savedDay({ goalId: goal.id, userId: user.id });

    await Promise.all([
      studySessionBlockFixture({ position: 1, sessionId: day.id, status: "completed" }),
      studySessionBlockFixture({ position: 2, sessionId: day.id, status: "skipped" }),
      studySessionBlockFixture({
        estimatedMinutes: 7,
        kind: "practice",
        payload: { title: "Later practice" },
        position: 3,
        sessionId: day.id,
        status: "active",
      }),
    ]);

    const before = await prisma.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { sessionId: day.id },
    });

    await expect(getSavedTodayQueue()).resolves.toStrictEqual({
      blocksLeft: 2,
      next: { minutes: 7, sessionId: day.id, title: "Later practice" },
    });

    await expect(
      prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { sessionId: day.id },
      }),
    ).resolves.toStrictEqual(before);
  });

  it("never reads a different learner's selected goal", async () => {
    const { user } = await learner();
    const other = await userFixture();
    const goal = await goalFixture({ userId: other.id });
    await savedDay({ goalId: goal.id, userId: other.id });

    await prisma.userLearningProfile.update({
      data: { activeGoalId: goal.id },
      where: { userId: user.id },
    });

    await expect(getSavedTodayQueue()).resolves.toBeNull();
  });

  it.each(["paused", "completed", "archived"] as const)(
    "omits saved queues for a %s goal",
    async (status) => {
      const { goal, user } = await learner();
      await savedDay({ goalId: goal.id, userId: user.id });
      await prisma.goal.update({ data: { status }, where: { id: goal.id } });

      await expect(getSavedTodayQueue()).resolves.toBeNull();
    },
  );

  it("omits a quick explanation and a learner without a goal", async () => {
    const user = await userFixture();
    await signIn(user);
    await expect(getSavedTodayQueue()).resolves.toBeNull();

    await goalFixture({ kind: "explain", userId: user.id });
    await expect(getSavedTodayQueue()).resolves.toBeNull();
  });

  it("uses the goal's local date rather than the UTC date", async () => {
    vi.setSystemTime(new Date("2026-03-10T01:15:00.000Z"));
    const { goal, user } = await learner();
    await prisma.goal.update({ data: { timezone: "America/Los_Angeles" }, where: { id: goal.id } });

    const local = await savedDay({
      goalId: goal.id,
      localDate: new Date("2026-03-09T00:00:00.000Z"),
      userId: user.id,
    });

    await savedDay({ goalId: goal.id, userId: user.id });

    const queue = await getSavedTodayQueue();
    expect(queue?.next?.sessionId).toBe(local.id);
  });

  it("keeps a recently active carried day until the new day starts", async () => {
    vi.setSystemTime(new Date("2026-03-11T00:10:00.000Z"));
    const { goal, user } = await learner();

    const carried = await savedDay({
      goalId: goal.id,
      startedAt: new Date("2026-03-10T23:55:00.000Z"),
      userId: user.id,
    });

    const today = await savedDay({
      goalId: goal.id,
      localDate: new Date("2026-03-11T00:00:00.000Z"),
      userId: user.id,
    });

    const carriedQueue = await getSavedTodayQueue();
    expect(carriedQueue?.next?.sessionId).toBe(carried.id);

    await prisma.studySession.update({ data: { startedAt: new Date() }, where: { id: today.id } });
    const todayQueue = await getSavedTodayQueue();
    expect(todayQueue?.next?.sessionId).toBe(today.id);
  });
});
