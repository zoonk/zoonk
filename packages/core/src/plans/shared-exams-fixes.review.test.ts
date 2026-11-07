import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { setupPlayableLesson } from "../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { mergeSkillForAdmin } from "../library/skills/merge-skill";
import { getSession } from "../users/get-session";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { loadGoalPlannerLessons } from "./_utils/planner-lessons";
import { parsePlanGraph } from "./planner/plan-state";

function graph(skillId: string, courseIds?: string[]) {
  return {
    phases: [{ name: "Reading" }],
    skills: [{ area: "Reading", courseIds, lessons: 1, name: "Reading", phase: 0, skillId }],
  };
}

describe("shared exam fixes adversarial review", () => {
  it.each([
    { courses: ["a", "b"], other: ["b", "a"], shared: true },
    { courses: ["a"], other: ["a", "b"], shared: false },
    { courses: undefined, other: undefined, shared: true },
    { courses: [], other: undefined, shared: true },
    { courses: ["a"], other: undefined, shared: false },
  ])("compares course scope $courses to $other", async ({ courses, other, shared }) => {
    const [user, skill, firstCourse, secondCourse] = await Promise.all([
      userFixture(),
      skillFixture(),
      courseFixture(),
      courseFixture(),
    ]);

    const courseId = (key: string) => (key === "a" ? firstCourse.id : secondCourse.id);

    const [first, second] = await Promise.all([
      goalFixture({ kind: "exam", userId: user.id }),
      goalFixture({ kind: "exam", userId: user.id }),
    ]);

    await Promise.all([
      planFixture({
        goalId: first.id,
        graph: graph(
          skill.id,
          courses?.map((key) => courseId(key)),
        ),
      }),
      planFixture({
        goalId: second.id,
        graph: graph(
          skill.id,
          other?.map((key) => courseId(key)),
        ),
      }),
    ]);

    mockSession(user.id);
    const result = await getSyllabusView({ goalId: first.id });

    expect(result).toMatchObject({
      status: "ready",
      syllabus: { sharedExams: shared ? [{ goalId: second.id }] : [] },
    });
  });

  it("does not promise shared credit after two separately planned skills merge", async () => {
    const { lesson, skill, user } = await setupPlayableLesson({
      steps: ["explanation", "summary"],
    });

    const [second, duplicate, course, admin] = await Promise.all([
      playableLessonFixture({ steps: ["explanation", "summary"] }),
      skillFixture(),
      catalogCourseFixture({ lessonCounts: [0] }),
      userFixture({ role: "admin" }),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: second.lesson.id, skillId: duplicate.id }),
      chapterLessonFixture({ chapterId: course.chapters[0]!.id, lessonId: lesson.id }),
      chapterLessonFixture({
        chapterId: course.chapters[0]!.id,
        lessonId: second.lesson.id,
        position: 1,
      }),
    ]);

    const [firstGoal, secondGoal] = await Promise.all([
      goalFixture({ kind: "exam", userId: user.id }),
      goalFixture({ kind: "exam", userId: user.id }),
    ]);

    const [firstPlan, secondPlan] = await Promise.all([
      planFixture({
        goalId: firstGoal.id,
        graph: graph(skill.id, [course.course.id]),
        items: [{ lessonId: lesson.id, skillId: skill.id }],
      }),
      planFixture({
        goalId: secondGoal.id,
        graph: graph(duplicate.id, [course.course.id]),
        items: [{ lessonId: second.lesson.id, skillId: duplicate.id }],
      }),
    ]);

    mockSession(admin.id);
    const session = await getSession();

    if (!session) {
      throw new Error("Expected the admin session");
    }

    vi.mocked(getSession).mockResolvedValue({
      ...session,
      user: { ...session.user, role: "admin" },
    });

    await expect(
      mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: skill.id }),
    ).resolves.toMatchObject({ status: "merged" });

    mockSession(user.id);
    const syllabus = await getSyllabusView({ goalId: firstGoal.id });
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

    const [firstItem, otherItem] = await Promise.all([
      prisma.planItem.findUniqueOrThrow({ where: { id: firstPlan.items[0]!.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: secondPlan.items[0]!.id } }),
    ]);

    expect(firstItem.status).toBe("done");
    expect(otherItem.status).toBe("todo");
    expect(syllabus).toMatchObject({ status: "ready", syllabus: { sharedExams: [] } });
  });

  it("does not promise shared credit when unscoped graphs inherit different primary courses", async () => {
    const { lesson, skill, user } = await setupPlayableLesson({
      steps: ["explanation", "summary"],
    });

    const [second, firstCourse, secondCourse] = await Promise.all([
      playableLessonFixture({ steps: ["explanation", "summary"] }),
      catalogCourseFixture({ lessonCounts: [0] }),
      catalogCourseFixture({ lessonCounts: [0] }),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: second.lesson.id, skillId: skill.id }),
      chapterLessonFixture({ chapterId: firstCourse.chapters[0]!.id, lessonId: lesson.id }),
      chapterLessonFixture({ chapterId: secondCourse.chapters[0]!.id, lessonId: second.lesson.id }),
    ]);

    const [firstGoal, secondGoal] = await Promise.all([
      goalFixture({ kind: "exam", primaryCourseId: firstCourse.course.id, userId: user.id }),
      goalFixture({ kind: "exam", primaryCourseId: secondCourse.course.id, userId: user.id }),
    ]);

    const [firstPlan, secondPlan] = await Promise.all([
      planFixture({
        goalId: firstGoal.id,
        graph: graph(skill.id),
        items: [{ lessonId: lesson.id, skillId: skill.id }],
      }),
      planFixture({
        goalId: secondGoal.id,
        graph: graph(skill.id),
        items: [{ lessonId: second.lesson.id, skillId: skill.id }],
      }),
    ]);

    const selected = await Promise.all([
      loadGoalPlannerLessons({
        goal: firstGoal,
        graph: parsePlanGraph(firstPlan.graph),
        userId: user.id,
      }),
      loadGoalPlannerLessons({
        goal: secondGoal,
        graph: parsePlanGraph(secondPlan.graph),
        userId: user.id,
      }),
    ]);

    expect(selected.map((lessons) => lessons.map((row) => row.lessonId))).toStrictEqual([
      [lesson.id],
      [second.lesson.id],
    ]);

    const syllabus = await getSyllabusView({ goalId: firstGoal.id });
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

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: secondPlan.items[0]!.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    expect(syllabus).toMatchObject({ status: "ready", syllabus: { sharedExams: [] } });
  });
});
