import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { cacheTag, revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { setupPlayableLesson } from "../../lesson-player/_test-utils/playable-lesson-setup";
import { getPlayableLibraryLesson } from "../../lesson-player/get-playable-library-lesson";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { updateLearningProfile } from "../../profile/update-learning-profile";
import { getChallengeTeam } from "../challenges/get-challenge-team";

async function setup() {
  const { lesson, user } = await setupPlayableLesson({
    steps: ["explanation", "typedAnswer", "summary"],
  });

  const [language, other] = await Promise.all([
    goalFixture({ kind: "language", language: "pt", targetLanguage: "en", userId: user.id }),
    goalFixture({ userId: user.id }),
    prisma.lesson.update({
      data: { language: "pt", targetLanguage: "en" },
      where: { id: lesson.id },
    }),
  ]);

  await Promise.all([
    planFixture({ goalId: language.id }),
    planFixture({ goalId: other.id }),
    prisma.userLearningProfile.create({ data: { activeGoalId: language.id, userId: user.id } }),
  ]);

  return { language, lesson, other };
}

type Setup = Awaited<ReturnType<typeof setup>>;

const reads = {
  "challenge team": ({ lesson }: Setup) => getChallengeTeam({ lessonId: lesson.id }),
  lesson: ({ lesson }: Setup) => getPlayableLibraryLesson({ lessonId: lesson.id }),
};

const writes = {
  "a plan change": async ({ language }: Setup) => {
    const result = await changeGoalPlan({
      goalId: language.id,
      input: { operations: [{ activities: ["writing"], kind: "skipActivities" }] },
    });

    expect(result.status).toBe("applied");
  },
  "an active goal switch": async ({ other }: Setup) => {
    const result = await updateLearningProfile({ activeGoalId: other.id });
    expect(result.status).toBe("updated");
  },
};

const cases = Object.keys(reads).flatMap((read) =>
  Object.keys(writes).map((write) => [read, write] as [keyof typeof reads, keyof typeof writes]),
);

describe("reads that pick the learner's lesson plan", () => {
  it.each(cases)("keep the %s under a tag %s expires", async (read, write) => {
    const state = await setup();

    vi.mocked(cacheTag).mockClear();
    await reads[read](state);
    const readTags = vi.mocked(cacheTag).mock.calls.flat();

    vi.mocked(revalidateTag).mockClear();
    await writes[write](state);
    const expiredTags = new Set(vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag));

    expect(
      readTags.filter((tag) => expiredTags.has(tag)),
      `read tags: ${readTags.join(", ")}; expired tags: ${[...expiredTags].join(", ")}`,
    ).not.toStrictEqual([]);
  });
});
