import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { getTodayView } from "../today/get-today-view";

function createPattern({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.mistakePattern.create({
    data: {
      content: { contrast: [], drill: [], examples: [], rule: "Use for with durations." },
      createdAt: new Date(SESSION_NOW.getTime() - MS_PER_DAY),
      goalId,
      kind: "pattern",
      language: "en",
      model: "test",
      promptVersion: "test",
      runId: "test",
      title: "since and for",
      userId,
    },
  });
}

async function readTodayPattern(goalId: string) {
  const result = await getTodayView({ goalId, timeZone: "UTC" });

  if (result.status !== "ready") {
    throw new Error(`Expected Today, got ${result.status}`);
  }

  return result.today.pattern;
}

async function setup(missionPattern: "same" | "other", done = false) {
  const { goal, user } = await languageGoalFixture();
  mockSession(user.id);

  const pattern = await createPattern({ goalId: goal.id, userId: user.id });
  const patternId = missionPattern === "same" ? pattern.id : "another-pattern";

  await studySessionFixture({
    goalId: goal.id,
    localDate: getDateInTimeZone({ date: new Date(), timeZone: goal.timezone ?? "UTC" }),
    missions: {
      picks: [
        {
          anchor: { patternId },
          done: done ? 1 : 0,
          kind: "pattern",
          opens: { kind: "pattern", patternId },
          total: 1,
        },
      ],
      version: 1,
    },
    startedAt: new Date(),
    userId: user.id,
  });

  return { goal, pattern, user };
}

describe("Today's pattern card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps an unopened day's pattern without saving a session or changing its plan", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const pattern = await createPattern({ goalId: goal.id, userId: user.id });
    const where = { userId: user.id };

    const before = await prisma.goal.findUniqueOrThrow({
      include: { plan: { include: { items: { orderBy: { position: "asc" } } } } },
      where: { id: goal.id },
    });

    await expect(prisma.studySession.count({ where })).resolves.toBe(0);
    await expect(readTodayPattern(goal.id)).resolves.toMatchObject({ id: pattern.id });
    await expect(prisma.studySession.count({ where })).resolves.toBe(0);

    await expect(
      prisma.goal.findUniqueOrThrow({
        include: { plan: { include: { items: { orderBy: { position: "asc" } } } } },
        where: { id: goal.id },
      }),
    ).resolves.toStrictEqual(before);
  });

  it.each([false, true])(
    "does not repeat the saved day's same pattern mission (done: %s)",
    async (done) => {
      const { goal } = await setup("same", done);
      await expect(readTodayPattern(goal.id)).resolves.toBeNull();
    },
  );

  it("keeps the drill's entry when another goal's earned bonus hides these mission rows", async () => {
    const { goal, pattern, user } = await setup("same");
    const otherGoal = await goalFixture({ userId: user.id });
    await studySessionFixture({ fullMealAt: new Date(), goalId: otherGoal.id, userId: user.id });
    await expect(readTodayPattern(goal.id)).resolves.toMatchObject({ id: pattern.id });
  });

  it("keeps a suggestion for a different pattern", async () => {
    const { goal, pattern } = await setup("other");
    await expect(readTodayPattern(goal.id)).resolves.toMatchObject({ id: pattern.id });
  });
});
