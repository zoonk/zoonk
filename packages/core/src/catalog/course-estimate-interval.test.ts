import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTargetDateBounds } from "../plans/target-date-range";
import { estimateCoursePlan } from "./course-estimate";

async function publicOpeningCourse(openingMinutes: number) {
  const [course, chapter, skill] = await Promise.all([
    courseFixture({ format: "core", isPublished: true, visibility: "public" }),
    libraryChapterFixture(),
    skillFixture(),
  ]);

  const lesson = await libraryLessonFixture({
    estimatedMinutes: openingMinutes,
    homeChapterId: chapter.id,
  });

  await Promise.all([
    courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    }),
    prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
  ]);

  await Promise.all(
    (["intermediate", "advanced"] as const).map(async (level) => {
      const [nextChapter, nextSkill] = await Promise.all([libraryChapterFixture(), skillFixture()]);

      const nextLesson = await libraryLessonFixture({
        estimatedMinutes: 1,
        homeChapterId: nextChapter.id,
      });

      await Promise.all([
        courseChapterFixture({
          chapterId: nextChapter.id,
          courseId: course.id,
          level,
          position: 0,
        }),
        prisma.chapterSkill.create({ data: { chapterId: nextChapter.id, skillId: nextSkill.id } }),
        chapterLessonFixture({ chapterId: nextChapter.id, lessonId: nextLesson.id, position: 0 }),
      ]);
    }),
  );

  return { chapter, course, lesson };
}

describe("written course lesson interval workload", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("refuses a target beyond the shared horizon before planning or writing", async () => {
    const { course } = await publicOpeningCourse(20);
    const { max } = getTargetDateBounds("2020-09-28");

    const afterMax = new Date(Date.parse(`${max}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);

    await expect(
      estimateCoursePlan({
        courseId: course.id,
        dailyMinutes: 15,
        studyDays: [1, 2, 3, 4, 5],
        targetDate: afterMax,
      }),
    ).rejects.toMatchObject({
      issues: [{ params: { bound: "latest", limit: max }, path: ["targetDate"] }],
      name: "InputRangeError",
    });

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
  });

  it("accepts tomorrow and the last calendar day in the shared horizon", async () => {
    const { course } = await publicOpeningCourse(20);
    const { max, min } = getTargetDateBounds("2020-09-28");

    const estimates = await Promise.all(
      [min, max].map((targetDate) =>
        estimateCoursePlan({
          courseId: course.id,
          dailyMinutes: 15,
          studyDays: [1, 2, 3, 4, 5],
          targetDate,
        }),
      ),
    );

    expect(estimates.map((estimate) => estimate?.numbers.context.targetDate)).toStrictEqual([
      min,
      max,
    ]);

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
  });

  it("includes practice consumed after the first course day without changing the written duration or placement", async () => {
    const { chapter, course, lesson } = await publicOpeningCourse(20);

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 15,
      studyDays: [0, 1, 2, 3, 4, 5, 6],
    });

    if (!estimate || !("firstDay" in estimate)) {
      throw new Error("Expected an undated written-course estimate");
    }

    expect(estimate.firstDay).toStrictEqual([
      {
        chapterId: chapter.id,
        dayMinutes: 15,
        estimatedMinutes: 20,
        lessonId: lesson.id,
        title: lesson.title,
      },
    ]);

    expect(estimate.chapters).toHaveLength(3);
    expect(estimate.chapters[0]).toMatchObject({ chapterId: chapter.id, endWeek: 1, week: 1 });
    expect(estimate.endDate).toBe("2020-10-04");

    expect(estimate.workload).toMatchObject({
      checkpointMinutes: 45,
      lessonMinutes: 22,
      practiceMinutes: 7,
      unwrittenLessonMinutes: 0,
    });
  });

  it("spans a written opening chapter through its actual teaching end across weeks", async () => {
    const { chapter, course, lesson } = await publicOpeningCourse(20);

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 5,
      studyDays: [1, 2],
    });

    if (!estimate || !("firstDay" in estimate)) {
      throw new Error("Expected the complete public course estimate");
    }

    expect
      .soft(estimate.firstDay)
      .toMatchObject([{ dayMinutes: 5, estimatedMinutes: 20, lessonId: lesson.id }]);

    expect
      .soft(estimate.chapters[0])
      .toMatchObject({ chapterId: chapter.id, endWeek: 6, week: 1, workKinds: ["original"] });
  });
});
