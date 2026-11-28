import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { levelTestQuestions } from "@zoonk/testing/fixtures/level-tests";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag, revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getGoalsCacheTag } from "../../cache/tags";
import { answerLanguageLevelTest } from "../../language/level-test/answer-language-level-test";
import { startLanguageLevelTest } from "../../language/level-test/start-language-level-test";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { coursePlacementSitting } from "../_test-utils/course-placement-sitting";
import { learnerGoalFixture } from "../_test-utils/learner-goal";

async function readPlanRow(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error(result.status);
  }

  return result.plan.placementTest;
}

/** Vitest has no private Next cache. Keep the Plan until a write expires a tag from the real read. */
async function cachedPlanRow(goalId: string, userId: string) {
  vi.mocked(cacheTag).mockClear();
  const row = await readPlanRow(goalId);
  const tags = vi.mocked(cacheTag).mock.calls.flat();
  expect(tags).toContain(getGoalsCacheTag(userId));
  vi.mocked(revalidateTag).mockClear();

  return () =>
    vi.mocked(revalidateTag).mock.calls.some(([tag]) => tags.includes(tag))
      ? readPlanRow(goalId)
      : Promise.resolve(row);
}

describe("returning to the Plan after answering a test question", () => {
  it("shows the next question of the course test", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [5],
      userId: user.id,
    });

    mockSession(user.id);

    const sitting = await coursePlacementSitting(
      goal.id,
      skills.map((skill) => skill.id),
    );

    const row = await cachedPlanRow(goal.id, user.id);
    await expect(row()).resolves.toMatchObject({ attempt: { answered: 0 }, kind: "learn" });
    await sitting.answerNext(sitting.first);
    expect(revalidateTag).toHaveBeenCalledWith(getGoalsCacheTag(user.id), { expire: 0 });
    await expect(row()).resolves.toMatchObject({ attempt: { answered: 1 }, kind: "learn" });
  });

  it("shows the next question of the language level test", async () => {
    const { goal, user } = await languageGoalFixture();
    const pair = { language: "pt", targetLanguage: "en" };

    const content = {
      confirmations: [],
      questions: levelTestQuestions(["A1", "A2", "B1"]),
      speaking: [],
    };

    await prisma.languageLevelTest.upsert({
      create: { ...pair, content, model: "test", promptVersion: "test", runId: "test" },
      update: { content },
      where: { languagePair: pair },
    });

    mockSession(user.id);
    const started = await startLanguageLevelTest({ goalId: goal.id });

    if (
      started.status !== "ready" ||
      started.test.status !== "ready" ||
      started.test.next.kind !== "question"
    ) {
      throw new Error("Expected the first language question");
    }

    const row = await cachedPlanRow(goal.id, user.id);
    await expect(row()).resolves.toMatchObject({ answered: 0, kind: "language" });

    await answerLanguageLevelTest({
      goalId: goal.id,
      input: {
        answerIndex: null,
        attemptId: started.test.attemptId!,
        questionId: started.test.next.question.id,
      },
    });

    expect(revalidateTag).toHaveBeenCalledWith(getGoalsCacheTag(user.id), { expire: 0 });
    await expect(row()).resolves.toMatchObject({ answered: 1, kind: "language" });
  });
});
