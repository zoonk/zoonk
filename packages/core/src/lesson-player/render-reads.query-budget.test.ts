import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { getChallengeTeam } from "../library/challenges/get-challenge-team";
import { getLessonGenerationState } from "../library/generation/lesson-generation-state";
import { getLessonWaitingState } from "../lookahead/get-lesson-waiting-state";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getLessonProgress } from "./get-lesson-progress";
import { getLessonSupport } from "./get-lesson-support";
import { getLibraryLessonOutline, getPlayableLibraryLesson } from "./get-playable-library-lesson";

describe("lesson render read budgets", () => {
  it.each([
    "playable",
    "outline",
    "support",
    "progress",
    "generation",
    "stored team",
    "derived team",
  ] as const)("reads %s", async (name) => {
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

    const budgets = {
      "derived team": 4,
      generation: 1,
      outline: 11,
      playable: 14,
      progress: 2,
      "stored team": 4,
      support: 3,
    };

    assertReadBudget(counts, budgets[name]);

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

  it("reads alternatives while a lesson has not been generated", async () => {
    await signedInCourseGoal();
    const lesson = await libraryLessonFixture();

    const counts = await countDatabaseStatements(() =>
      getLessonWaitingState({ lessonId: lesson.id }),
    );

    assertReadBudget(counts, 5);
    expect(counts.result).toMatchObject({ state: { status: "notStarted" }, status: "ready" });
  });
});
