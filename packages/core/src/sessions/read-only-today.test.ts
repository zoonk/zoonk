import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  getLanguageTodayView,
  hidePatternCoveredByDay,
} from "../view-models/language/get-language-today-view";
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

/** A noticed pattern with a drill, so the day's missions can offer it (`languageCandidates`). */
function createDrillPattern({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.mistakePattern.create({
    data: {
      content: {
        contrast: [],
        drill: [
          {
            answer: "for",
            feedback: "Use for with a length of time.",
            options: ["for", "since"],
            sentence: "I've lived here ___ two years.",
          },
        ],
        examples: [],
        rule: "Use for with durations.",
      },
      createdAt: new Date(SESSION_NOW.getTime() - MS_PER_DAY),
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

  // The unopened day's missions exist only in Today's own read: the screen showing both composes
  // them, so the drill gets one entry without building the day twice.
  it.each([false, true])(
    "offers a pattern once beside the unopened day that picked its drill (earned elsewhere: %s)",
    async (earnedElsewhere) => {
      const { goal, user } = await languageGoalFixture();
      mockSession(user.id);

      const pattern = await createDrillPattern({ goalId: goal.id, userId: user.id });

      if (earnedElsewhere) {
        const otherGoal = await goalFixture({ userId: user.id });

        await studySessionFixture({
          fullMealAt: new Date(),
          goalId: otherGoal.id,
          userId: user.id,
        });
      }

      const [today, language] = await Promise.all([
        getTodayView({ goalId: goal.id, timeZone: "UTC" }),
        getLanguageTodayView({ goalId: goal.id }),
      ]);

      if (today.status !== "ready" || language.status !== "ready") {
        throw new Error(`Expected Today and its language section, got ${today.status}`);
      }

      // Both reads offer the drill: the day as one of its missions, the section as its card.
      expect(today.today.session.status).toBe("unstarted");

      expect(today.today.session.missions).toContainEqual(
        expect.objectContaining({ opens: { kind: "pattern", patternId: pattern.id } }),
      );

      expect(language.today.pattern).toMatchObject({ id: pattern.id });

      // An earned bonus replaces the missions' unfinished rows, so the card stays the drill's entry.
      expect(
        hidePatternCoveredByDay({ day: today.today.session, language: language.today }).pattern,
      ).toStrictEqual(earnedElsewhere ? language.today.pattern : null);
    },
  );
});
