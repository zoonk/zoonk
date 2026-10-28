import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
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

/**
 * A noticed pattern, `daysAgo` before now. With a drill, the day's missions can offer it
 * (`languageCandidates`); without one, only Today's card can.
 */
function createPattern({
  daysAgo = 1,
  drill = true,
  goalId,
  userId,
}: {
  daysAgo?: number;
  drill?: boolean;
  goalId: string;
  userId: string;
}) {
  return prisma.mistakePattern.create({
    data: {
      content: {
        contrast: [],
        drill: drill
          ? [
              {
                answer: "for",
                feedback: "Use for with a length of time.",
                options: ["for", "since"],
                sentence: "I've lived here ___ two years.",
              },
            ]
          : [],
        examples: [],
        rule: "Use for with durations.",
      },
      createdAt: new Date(SESSION_NOW.getTime() - daysAgo * MS_PER_DAY),
      goalId,
      kind: "pattern",
      language: "en",
      model: "test",
      promptVersion: "test",
      runId: "test",
      title: "Since and for",
      userId,
    },
  });
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

  it("reads a language goal's Today, its pattern and its sidebar without opening or extending today's session", async () => {
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

    expect(before.plan.items.map((item) => item.id)).toStrictEqual(
      expect.arrayContaining(items.map((item) => item.id)),
    );

    expect(pattern.goalId).toBe(goal.id);

    const [today, language] = await Promise.all([
      getTodayView({ goalId: goal.id, timeZone: "UTC" }),
      getLanguageTodayView({ goalId: goal.id }),
    ]);

    expect([today.status, language.status]).toStrictEqual(["ready", "ready"]);
    await expect(readLearnerState(input)).resolves.toStrictEqual(before);
  });

  // The unopened day's missions exist only in Today's own read, so Today composes its card with
  // them: the drill gets one entry, and the API's Today says so, without building the day twice.
  it.each([false, true])(
    "offers a pattern once beside the unopened day that picked its drill (earned elsewhere: %s)",
    async (earnedElsewhere) => {
      const { goal, user } = await languageGoalFixture();
      mockSession(user.id);

      const pattern = await createPattern({ goalId: goal.id, userId: user.id });

      if (earnedElsewhere) {
        const otherGoal = await goalFixture({ userId: user.id });

        await studySessionFixture({
          fullMealAt: new Date(),
          goalId: otherGoal.id,
          userId: user.id,
        });
      }

      const result = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

      if (result.status !== "ready") {
        throw new Error(`Expected Today, got ${result.status}`);
      }

      // The day's missions offer the drill.
      expect(result.today.session.status).toBe("unstarted");

      expect(result.today.session.missions).toContainEqual(
        expect.objectContaining({ opens: { kind: "pattern", patternId: pattern.id } }),
      );

      // An earned bonus replaces the missions' unfinished rows: the card stays the drill's entry.
      expect(result.today.pattern).toStrictEqual(
        earnedElsewhere ? { id: pattern.id, kind: "pattern", title: "Since and for" } : null,
      );
    },
  );

  it("keeps the card for a newer pattern the unopened day's missions don't offer", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const [drilled, newer] = await Promise.all([
      createPattern({ daysAgo: 2, goalId: goal.id, userId: user.id }),
      createPattern({ drill: false, goalId: goal.id, userId: user.id }),
    ]);

    const result = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (result.status !== "ready") {
      throw new Error(`Expected Today, got ${result.status}`);
    }

    expect(result.today.session.missions).toContainEqual(
      expect.objectContaining({ opens: { kind: "pattern", patternId: drilled.id } }),
    );

    expect(result.today.pattern).toMatchObject({ id: newer.id });
  });
});
