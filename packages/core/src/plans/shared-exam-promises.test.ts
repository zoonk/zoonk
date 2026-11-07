import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { setupPlayableLesson } from "../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { loadGoalPlannerLessons } from "./_utils/planner-lessons";
import { parsePlanGraph } from "./planner/plan-state";

async function twoExamsTeachingOneSkill({ sameCourse }: { sameCourse: boolean }) {
  const { lesson, skill, user } = await setupPlayableLesson({ steps: ["explanation", "summary"] });

  const second = await playableLessonFixture({ steps: ["explanation", "summary"] });
  await lessonSkillFixture({ lessonId: second.lesson.id, skillId: skill.id });

  const [firstCourse, secondCourse] = await Promise.all([
    catalogCourseFixture({ lessonCounts: [0] }),
    catalogCourseFixture({ lessonCounts: [0] }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId: firstCourse.chapters[0]!.id, lessonId: lesson.id }),
    chapterLessonFixture({ chapterId: secondCourse.chapters[0]!.id, lessonId: second.lesson.id }),
  ]);

  const graphFor = (courseId: string) => ({
    phases: [{ name: "Reading" }],
    skills: [
      {
        area: "Reading",
        courseIds: [courseId],
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
      },
    ],
  });

  const otherCourse = sameCourse ? firstCourse : secondCourse;
  const otherLesson = sameCourse ? lesson : second.lesson;

  const [firstGoal, secondGoal] = await Promise.all([
    goalFixture({ kind: "exam", title: "Chamber", userId: user.id }),
    goalFixture({ kind: "exam", title: "CGU", userId: user.id }),
  ]);

  const [firstPlan, secondPlan] = await Promise.all([
    planFixture({
      goalId: firstGoal.id,
      graph: graphFor(firstCourse.course.id),
      items: [{ lessonId: lesson.id, skillId: skill.id }],
    }),
    planFixture({
      goalId: secondGoal.id,
      graph: graphFor(otherCourse.course.id),
      items: [{ lessonId: otherLesson.id, skillId: skill.id }],
    }),
  ]);

  const selected = await Promise.all(
    [
      { goal: firstGoal, plan: firstPlan },
      { goal: secondGoal, plan: secondPlan },
    ].map(({ goal, plan }) =>
      loadGoalPlannerLessons({ goal, graph: parsePlanGraph(plan.graph), userId: user.id }),
    ),
  );

  expect(selected.map((lessons) => lessons.map((row) => row.lessonId))).toStrictEqual([
    [lesson.id],
    [otherLesson.id],
  ]);

  return { firstGoal, firstPlan, lesson, secondGoal, secondPlan };
}

describe("shared exam promises", () => {
  it("doesn't promise studying a skill once when the other exam teaches it in another course", async () => {
    const { firstGoal } = await twoExamsTeachingOneSkill({ sameCourse: false });

    await expect(getSyllabusView({ goalId: firstGoal.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: { sharedExams: [], subjects: [{ name: "Reading", sharedWith: [] }] },
    });
  });

  it("credits both exams when they teach a shared skill in the same course", async () => {
    const { firstGoal, firstPlan, lesson, secondGoal, secondPlan } = await twoExamsTeachingOneSkill(
      { sameCourse: true },
    );

    await expect(getSyllabusView({ goalId: firstGoal.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: { sharedExams: [{ goalId: secondGoal.id, name: "CGU" }] },
    });

    const started = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

    if (started.status !== "started") {
      throw new Error(started.status);
    }

    await expect(
      completeLibraryLesson({
        input: { runId: started.run.runId, timeZone: "UTC" },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ status: "completed" });

    const [source, other] = await Promise.all([
      prisma.planItem.findUniqueOrThrow({ where: { id: firstPlan.items[0]?.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: secondPlan.items[0]?.id } }),
    ]);

    expect(source.status).toBe("done");
    expect(other.status).toBe("done");
  });

  it("does not expose another learner's shared exam or authorize their plan", async () => {
    const { lesson, skill, user } = await setupPlayableLesson({
      steps: ["explanation", "summary"],
    });

    const stranger = await userFixture();

    const [ownGoal, foreignGoal] = await Promise.all([
      goalFixture({ kind: "exam", userId: user.id }),
      goalFixture({ kind: "exam", title: "PRIVATE EXAM NAME", userId: stranger.id }),
    ]);

    await Promise.all([
      planFixture({ goalId: ownGoal.id, items: [{ lessonId: lesson.id, skillId: skill.id }] }),
      planFixture({ goalId: foreignGoal.id, items: [{ lessonId: lesson.id, skillId: skill.id }] }),
    ]);

    mockSession(user.id);

    await expect(getSyllabusView({ goalId: ownGoal.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: { sharedExams: [] },
    });

    await expect(getSyllabusView({ goalId: foreignGoal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockGuestSession(stranger.id);

    await expect(getSyllabusView({ goalId: ownGoal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(getSyllabusView({ goalId: ownGoal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("ignores explain goals and absent plans or graphs, and falls back after blueprint deletion", async () => {
    const { lesson, skill, user } = await setupPlayableLesson({
      steps: ["explanation", "summary"],
    });

    const blueprint = await examBlueprintFixture();

    const [own, explain, absentPlan, absentGraph, deletedBlueprint] = await Promise.all([
      goalFixture({ kind: "exam", userId: user.id }),
      goalFixture({ kind: "explain", userId: user.id }),
      goalFixture({ kind: "exam", userId: user.id }),
      goalFixture({ kind: "exam", userId: user.id }),
      goalFixture({
        examBlueprintId: blueprint.id,
        kind: "exam",
        title: "Retained exam title",
        userId: user.id,
      }),
    ]);

    await Promise.all([
      ...[own, explain, deletedBlueprint].map((goal) =>
        planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id, skillId: skill.id }] }),
      ),
      planFixture({ goalId: absentGraph.id }),
    ]);

    await prisma.examBlueprint.delete({ where: { id: blueprint.id } });

    await expect(getSyllabusView({ goalId: own.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: { sharedExams: [{ goalId: deletedBlueprint.id, name: "Retained exam title" }] },
    });

    await expect(getSyllabusView({ goalId: explain.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: { sharedExams: [] },
    });

    await expect(getSyllabusView({ goalId: absentPlan.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getSyllabusView({ goalId: absentGraph.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: { sharedExams: [] },
    });
  });
});
