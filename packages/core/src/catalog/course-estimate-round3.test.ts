import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { startCourseGoal } from "../goals/start-course-goal";
import { resolveMergedSkills } from "../plans/_utils/planner-inputs";
import { findBeyondNoticeSkillIds } from "../plans/planner/beyond-notice-skills";
import { loadCourseEstimateData } from "./_utils/course-estimate-data";
import { estimateCoursePlan } from "./course-estimate";

const NOW = new Date("2020-09-28T12:00:00Z");
const DAYS = [1, 2, 3, 4, 5];

/** A settled course with a lesson teaching three skills, as the real quantum outline does. */
async function sharedSkillCourse(withChapterTags = false) {
  const course = await courseFixture({
    isPublished: true,
    title: "Quantum physics",
    visibility: "public",
  });

  const chapters = await Promise.all(
    (["beginner", "intermediate", "advanced"] as const).map(async (level) => {
      const chapter = await libraryChapterFixture();

      await courseChapterFixture({
        chapterId: chapter.id,
        courseId: course.id,
        level,
        position: 0,
      });

      const lessons = await Promise.all(
        Array.from({ length: 10 }, async (_, position) => {
          const [lesson, ...skills] = await Promise.all([
            libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapter.id }),
            skillFixture(),
            skillFixture(),
            skillFixture(),
          ]);

          await Promise.all([
            chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
            ...skills.map((skill) =>
              lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
            ),
          ]);

          return lesson;
        }),
      );

      if (withChapterTags) {
        const linked = await prisma.lessonSkill.findFirstOrThrow({
          orderBy: { createdAt: "asc" },
          where: { lessonId: lessons[0]!.id },
        });

        await prisma.chapterSkill.create({
          data: { chapterId: chapter.id, skillId: linked.skillId },
        });
      }

      return { chapter, lessons };
    }),
  );

  return { chapters, course };
}

describe("honest course estimates", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("does not invent unwritten lessons for skills already taught by shared outline lessons", async () => {
    const [{ course }, user] = await Promise.all([sharedSkillCourse(), userFixture()]);
    mockSession(user.id);

    const started = await startCourseGoal({
      courseId: course.id,
      input: { dailyMinutes: 15, level: "none", targetDate: null, timeZone: "UTC" },
    });

    expect(started.status).toBe("created");

    const plan = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { goalId: started.status === "created" ? started.goal.id : "" },
    });

    const lessons = plan.items.filter((item) => item.kind === "lesson");
    expect(lessons).toHaveLength(30);
    expect(lessons.every((item) => item.lessonId !== null)).toBe(true);
  });

  it("does not invent work when chapter tags also teach the lessons' own skills", async () => {
    const [{ course }, user] = await Promise.all([sharedSkillCourse(true), userFixture()]);
    mockSession(user.id);

    const started = await startCourseGoal({
      courseId: course.id,
      input: { dailyMinutes: 15, level: "none", targetDate: null, timeZone: "UTC" },
    });

    expect(started.status).toBe("created");

    const plan = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { goalId: started.status === "created" ? started.goal.id : "" },
    });

    const lessons = plan.items.filter((item) => item.kind === "lesson");
    expect(lessons).toHaveLength(30);
    expect(lessons.every((item) => item.lessonId !== null)).toBe(true);
  });

  it("retains unwritten curriculum when an outlined skill merges into a partly outlined skill", async () => {
    const survivor = await skillFixture();
    const merged = await skillFixture({ mergedIntoId: survivor.id });

    const graph = await resolveMergedSkills({
      phases: [{ milestone: null, name: "Course" }],
      skills: [merged, survivor].map((skill, index) => ({
        area: "Math",
        lessons: 10,
        name: skill.name,
        outlined: index === 0,
        phase: 0,
        skillId: skill.id,
        weight: 1,
      })),
    });

    expect(graph.skills).toHaveLength(1);
    expect(graph.skills[0]!.outlined).not.toBe(true);
  });

  it.each([
    { dailyMinutes: 10, lessons: 3 },
    { dailyMinutes: 15, lessons: 5 },
  ])(
    "fills the first day's $dailyMinutes minutes with available three-minute lessons",
    async ({ dailyMinutes, lessons }) => {
      const { course } = await sharedSkillCourse();

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes,
        studyDays: DAYS,
      });

      expect(estimate).not.toBeNull();

      if (!estimate || !("firstDay" in estimate)) {
        throw new Error("Expected an undated course estimate");
      }

      expect(estimate.firstDay).toHaveLength(lessons);

      expect(estimate.firstDay.reduce((total, lesson) => total + lesson.estimatedMinutes, 0)).toBe(
        lessons * 3,
      );
    },
  );

  it("explains the additional practice/checkpoint time without claiming unwritten outline lessons", async () => {
    const { course } = await sharedSkillCourse();

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 15,
      studyDays: DAYS,
    });

    expect(estimate).toHaveProperty("workload.lessonMinutes", 90);
    expect(estimate).toHaveProperty("workload.unwrittenLessonMinutes", 0);
    expect(estimate).toHaveProperty("workload.practiceMinutes");
    expect(estimate).toHaveProperty("workload.checkpointMinutes");
  });

  it("shows lesson durations at the same sampled pace that determines the calendar", async () => {
    vi.setSystemTime(new Date("2000-09-28T12:00:00Z"));
    const [{ chapters, course }, user] = await Promise.all([sharedSkillCourse(), userFixture()]);
    const lesson = chapters[0]!.lessons[0]!;

    await Promise.all(
      Array.from({ length: 20 }, () =>
        learningEventFixture({
          contentIds: { lessonId: lesson.id },
          endedAt: new Date("2000-09-27T12:00:00Z"),
          seconds: 360,
          userId: user.id,
        }),
      ),
    );

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 15,
      studyDays: DAYS,
    });

    expect(estimate).not.toBeNull();

    if (!estimate || !("firstDay" in estimate)) {
      throw new Error("Expected an undated course estimate");
    }

    expect(estimate.firstDay).toHaveLength(2);
    expect(estimate.firstDay.map((entry) => entry.estimatedMinutes)).toStrictEqual([6, 6]);
  });

  it("estimates an incomplete exam outline from its full stored graph, with real areas and unwritten work", async () => {
    const course = await courseFixture({
      format: "exam",
      isPublished: true,
      language: "pt",
      title: "ENEM",
      visibility: "public",
    });

    const blueprint = await examBlueprintFixture({ language: "pt" });
    const areas = ["Linguagens", "Humanas", "Natureza", "Matemática", "Redação"];

    const rows = await Promise.all(
      areas.map(async (area, position) => {
        const [chapter, skill] = await Promise.all([
          libraryChapterFixture({ language: "pt" }),
          skillFixture({ language: "pt" }),
        ]);

        await Promise.all([
          courseChapterFixture({
            area,
            chapterId: chapter.id,
            courseId: course.id,
            level: "beginner",
            position,
          }),
          prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
          ...Array.from({ length: 5 }, async (_, lessonPosition) => {
            const lesson = await libraryLessonFixture({
              estimatedMinutes: 3,
              homeChapterId: chapter.id,
              language: "pt",
            });

            await chapterLessonFixture({
              chapterId: chapter.id,
              lessonId: lesson.id,
              position: lessonPosition,
            });
          }),
        ]);

        const examSkill = area === "Matemática" ? await skillFixture({ language: "pt" }) : skill;
        return { area, chapter, examSkill, skill };
      }),
    );

    const missing = await skillFixture({ language: "pt" });

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: NOW,
        graph: {
          phases: [{ milestone: null, name: "ENEM" }],
          skills: [
            ...rows.map(({ area, examSkill: skill }) => ({
              area,
              courseIds: [course.id],
              lessons: 5,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              topics: ["A topic in this area's notice"],
              weight: 1,
            })),
            {
              area: "Natureza",
              courseIds: [course.id],
              lessons: 10,
              name: missing.name,
              phase: 0,
              skillId: missing.id,
              weight: 1,
            },
          ],
        },
        model: "fixture",
        primaryCourseId: course.id,
        promptVersion: "fixture",
        runId: "fixture",
      },
    });

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 240,
      studyDays: DAYS,
      targetDate: "2020-10-26",
    });

    expect(estimate).not.toBeNull();
    const inputs = await loadCourseEstimateData(course.id, "2020-09-28");
    expect(inputs).not.toBeNull();
    expect(findBeyondNoticeSkillIds(inputs!.graph).has(rows[3]!.skill.id)).toBe(false);

    if (!estimate || !("areas" in estimate)) {
      throw new Error("Expected a dated exam estimate");
    }

    expect(estimate.areas.map((entry) => entry.area)).toStrictEqual(areas);

    expect(estimate.areas.find((entry) => entry.area === "Matemática")).toMatchObject({
      fitting: 5,
      total: 5,
    });

    expect(estimate.workload.unwrittenLessonMinutes).toBeGreaterThan(0);

    expect(estimate.areas.find((entry) => entry.area === "Natureza")).toHaveProperty(
      "unwrittenMinutes",
    );

    expect(estimate.areas.find((entry) => entry.area === "Matemática")).toHaveProperty(
      "plannedMinutes",
    );

    expect(estimate.chapters.every((chapter) => chapter.area !== "ENEM")).toBe(true);
  });
});
