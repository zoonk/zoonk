import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLanguageTodayView } from "../view-models/language/get-language-today-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";

/** A page or prefetch must leave every learner-owned action and plan row unchanged. */
async function readLearnerState({ goalId, userId }: { goalId: string; userId: string }) {
  const [goal, plan, changes, sessions, activity, progress] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
      where: { goalId },
    }),
    prisma.planChange.findMany({ orderBy: { id: "asc" }, where: { plan: { goalId } } }),
    prisma.studySession.findMany({
      include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
      orderBy: { id: "asc" },
      where: { goalId, userId },
    }),
    prisma.learningEvent.findMany({ orderBy: { id: "asc" }, where: { userId } }),
    prisma.dailyProgress.findMany({ orderBy: { id: "asc" }, where: { userId } }),
  ]);

  return { activity, changes, goal, plan, progress, sessions };
}

describe("Today reads without learner actions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an unopened study day without saving a session or changing the plan", async () => {
    const user = await userFixture();
    const { goal, lessons } = await sessionGoalFixture({ userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const input = { goalId: goal.id, userId: user.id };
    const before = await readLearnerState(input);
    expect(before.sessions).toStrictEqual([]);
    expect(before.plan.items.map((item) => item.lessonId)).toContain(lessons[0]?.id);

    const result = await getTodayView({ goalId: goal.id, timeZone: "UTC" });
    expect(result.status).toBe("ready");

    await expect(readLearnerState(input)).resolves.toStrictEqual(before);
  });

  it("reads a language sidebar pattern without opening or extending today's session", async () => {
    const { goal, items, user } = await languageGoalFixture();
    mockSession(user.id);

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: { contrast: [], drill: [], examples: [], rule: "Use for with durations." },
        goalId: goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "Since and for",
        userId: user.id,
      },
    });

    const input = { goalId: goal.id, userId: user.id };
    const before = await readLearnerState(input);
    expect(before.sessions).toStrictEqual([]);
    expect(before.plan.items.map((item) => item.id)).toStrictEqual(items.map((item) => item.id));
    expect(pattern.goalId).toBe(goal.id);

    const result = await getLanguageTodayView({ goalId: goal.id });
    expect(result.status).toBe("ready");

    await expect(readLearnerState(input)).resolves.toStrictEqual(before);
  });
});
