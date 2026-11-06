import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { getChallengeTeam } from "../library/challenges/get-challenge-team";
import { getLessonGenerationState } from "../library/generation/lesson-generation-state";
import { getLessonWaitingState } from "../lookahead/get-lesson-waiting-state";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { setupPlayableLesson } from "./_test-utils/playable-lesson-setup";
import { getLessonProgress } from "./get-lesson-progress";
import { getLessonSupport } from "./get-lesson-support";
import { getLibraryLessonOutline, getPlayableLibraryLesson } from "./get-playable-library-lesson";

describe("lesson render reads", () => {
  it.each([
    "playable",
    "outline",
    "support",
    "progress",
    "generation",
    "stored team",
    "derived team",
  ] as const)("reads %s without writing", async (name) => {
    const { plan, skills } = await signedInCourseGoal();
    const { lesson } = await playableLessonFixture();

    await Promise.all([
      planItemFixture({ lessonId: lesson.id, planId: plan.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[0]!.id }),
    ]);

    if (name === "stored team") {
      await prisma.plan.update({
        data: {
          settings: { team: { language: "en", members: [{ name: "Sam" }, { name: "Alex" }] } },
        },
        where: { id: plan.id },
      });
    }

    const input = { lessonId: lesson.id };

    const readers = {
      "derived team": () => getChallengeTeam(input),
      generation: () => getLessonGenerationState(lesson.id),
      outline: () => getLibraryLessonOutline(input),
      playable: () => getPlayableLibraryLesson(input),
      progress: () => getLessonProgress(input),
      "stored team": () => getChallengeTeam(input),
      support: () => getLessonSupport(input),
    };

    const counts = await countDatabaseStatements<unknown>(readers[name]);
    expect(counts.writes).toBe(0);

    const expected = {
      "derived team": expect.objectContaining({ status: "ready" }),
      generation: { status: "ready" },
      outline: expect.objectContaining({ id: lesson.id }),
      playable: expect.objectContaining({ status: "ready" }),
      progress: expect.any(Array),
      "stored team": expect.objectContaining({ status: "ready" }),
      support: "explanationFirst",
    };

    expect(counts.result).toStrictEqual(expected[name]);
  });

  it("reads alternatives and the goal's warm-up deck without writing while a lesson has not been generated", async () => {
    await signedInCourseGoal();
    const lesson = await libraryLessonFixture();

    const counts = await countDatabaseStatements(() =>
      getLessonWaitingState({ lessonId: lesson.id }),
    );

    expect(counts.writes).toBe(0);
    expect(counts.result).toMatchObject({ state: { status: "notStarted" }, status: "ready" });
  });

  it("reads a language lesson with what the chosen goal skips", async () => {
    const { lesson, user } = await setupPlayableLesson({
      steps: ["explanation", "typedAnswer", "summary"],
    });

    const [goal] = await Promise.all([
      goalFixture({ kind: "language", language: "pt", targetLanguage: "en", userId: user.id }),
      prisma.lesson.update({
        data: { language: "pt", targetLanguage: "en" },
        where: { id: lesson.id },
      }),
    ]);

    await Promise.all([
      planFixture({ goalId: goal.id, settings: { skippedActivities: ["writing"] } }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    const counts = await countDatabaseStatements(() =>
      getPlayableLibraryLesson({ lessonId: lesson.id }),
    );

    expect(counts.writes).toBe(0);

    expect(
      counts.result?.status === "ready"
        ? counts.result.lesson.steps.map((step) => step.kind)
        : null,
    ).toStrictEqual(["explanation", "summary"]);
  });
});
