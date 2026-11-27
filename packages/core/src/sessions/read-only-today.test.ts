import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLanguageTodayView } from "../view-models/language/get-language-today-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";

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

function createPattern({ goalId, userId }: { goalId: string; userId: string }) {
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

  it("reads a language goal's Today and its sidebar without opening or extending today's session", async () => {
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

  it("shows a language learner's fresh pattern in no notice or mission, and words to say again in its notice", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);
    await createPattern({ goalId: goal.id, userId: user.id });

    const read = async () => {
      const result = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

      if (result.status !== "ready") {
        throw new Error(`Expected Today, got ${result.status}`);
      }

      return result.today;
    };

    const quiet = await read();
    expect(quiet.notice).toBeNull();
    expect(quiet.session.missions.map((mission) => mission.kind)).not.toContain("pattern");

    const organization = await organizationFixture();
    const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });
    await pronunciationReviewFixture({ dueAt: SESSION_NOW, userId: user.id, wordId: word.id });

    await expect(read()).resolves.toMatchObject({ notice: "practice" });
  });
});
