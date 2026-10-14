import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageTodayView } from "./get-language-today-view";

function createPattern({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.mistakePattern.create({
    data: {
      content: { contrast: [], drill: [], examples: [], rule: "Use for with durations." },
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

async function setup(missionPattern: "same" | "other", done = false) {
  const { goal, user } = await languageGoalFixture();
  mockSession(user.id);

  const pattern = await createPattern({ goalId: goal.id, userId: user.id });

  await studySessionFixture({
    goalId: goal.id,
    localDate: getDateInTimeZone({ date: new Date(), timeZone: goal.timezone ?? "UTC" }),
    missions: {
      picks: [
        {
          anchor: { patternId: missionPattern === "same" ? pattern.id : "another-pattern" },
          done: done ? 1 : 0,
          kind: "pattern",
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

describe("Today's pattern prompt", () => {
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

    await expect(getLanguageTodayView({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
      today: { pattern: { id: pattern.id } },
    });

    await expect(prisma.studySession.count({ where })).resolves.toBe(0);

    await expect(
      prisma.goal.findUniqueOrThrow({
        include: { plan: { include: { items: { orderBy: { position: "asc" } } } } },
        where: { id: goal.id },
      }),
    ).resolves.toStrictEqual(before);
  });

  it.each([false, true])(
    "does not repeat the day's same pattern mission (done: %s)",
    async (done) => {
      const { goal } = await setup("same", done);
      const result = await getLanguageTodayView({ goalId: goal.id });
      expect(result).toMatchObject({ status: "ready", today: { pattern: null } });
    },
  );

  it("keeps the drill's entry when another goal's earned bonus hides these mission rows", async () => {
    const { goal, pattern, user } = await setup("same");
    const otherGoal = await goalFixture({ userId: user.id });
    await studySessionFixture({ fullMealAt: new Date(), goalId: otherGoal.id, userId: user.id });
    const result = await getLanguageTodayView({ goalId: goal.id });
    expect(result).toMatchObject({ status: "ready", today: { pattern: { id: pattern.id } } });
  });

  it("keeps a suggestion for a different pattern", async () => {
    const { goal, pattern } = await setup("other");
    const result = await getLanguageTodayView({ goalId: goal.id });
    expect(result).toMatchObject({ status: "ready", today: { pattern: { id: pattern.id } } });
  });
});
