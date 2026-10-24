import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
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
import { changeGoalPlan } from "../plans/change-goal-plan";
import { estimateCoursePlan } from "./course-estimate";

const NOW = new Date("2020-09-28T12:00:00Z");

async function orderedCourse(exam: boolean) {
  const [course, skills] = await Promise.all([
    courseFixture({ isPublished: true, visibility: "public" }),
    Promise.all(Array.from({ length: 5 }, () => skillFixture())),
  ]);

  const levels = ["beginner", "beginner", "beginner", "intermediate", "advanced"] as const;

  const chapters = await Promise.all(
    levels.map(async (level, position) => {
      const chapter = await libraryChapterFixture();

      const lesson = await libraryLessonFixture({
        estimatedMinutes: 60,
        homeChapterId: chapter.id,
      });

      const skillIds = [
        skills[position]!.id,
        ...([2, 3].includes(position) ? [skills[0]!.id] : []),
      ];

      await Promise.all([
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level, position }),
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
        ...skillIds.map((skillId) => lessonSkillFixture({ lessonId: lesson.id, skillId })),
      ]);

      return { chapter, lesson };
    }),
  );

  await prisma.skillPrerequisite.create({
    data: { prerequisiteId: skills[0]!.id, skillId: skills[1]!.id },
  });

  if (exam) {
    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [],
        rules: [],
        subjects: [
          { name: "Writing", topics: [] },
          { name: "Reading", topics: [] },
        ],
      },
    });

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: NOW,
        graph: {
          phases: [{ milestone: null, name: "Grammar" }],
          skills: skills.map((skill, index) => ({
            area: index === 2 ? "Reading" : "Writing",
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: index === 2 ? 5 : 1,
          })),
        },
        model: "fixture",
        primaryCourseId: course.id,
        promptVersion: "fixture",
        runId: "fixture",
      },
    });
  }

  return { chapters, course };
}

describe("published course study order", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([false, true])(
    "keeps undated chapter weeks and level phases in published order (exam-linked: %s)",
    async (exam) => {
      const [{ course, chapters }, user] = await Promise.all([orderedCourse(exam), userFixture()]);

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes: 15,
        studyDays: [1, 2, 3, 4, 5],
      });

      if (!estimate || !("firstDay" in estimate)) {
        throw new Error("Expected undated course estimate");
      }

      const weeks = estimate.chapters.map((chapter) => chapter.week);
      expect(weeks).toStrictEqual(weeks.toSorted((a, b) => (a ?? Infinity) - (b ?? Infinity)));

      mockSession(user.id);

      const started = await startCourseGoal({
        courseId: course.id,
        input: { dailyMinutes: 15, studyDays: [1, 2, 3, 4, 5] },
      });

      if (started.status !== "created") {
        throw new Error("Expected course start");
      }

      const plan = await prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { goalId: started.goal.id },
      });

      const lessons = plan.items.filter((item) => item.kind === "lesson");

      expect(lessons.map((item) => item.lessonId)).toStrictEqual(
        chapters.map(({ lesson }) => lesson.id),
      );

      expect(lessons.map((item) => item.phase)).toStrictEqual([0, 0, 0, 1, 2]);

      await expect(
        changeGoalPlan({
          goalId: started.goal.id,
          input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
        }),
      ).resolves.toMatchObject({ status: "applied" });

      const replanned = await prisma.planItem.findMany({
        orderBy: { position: "asc" },
        where: { kind: "lesson", planId: plan.id },
      });

      expect(replanned.map((item) => item.lessonId)).toStrictEqual(
        chapters.map(({ lesson }) => lesson.id),
      );

      expect(replanned.map((item) => item.phase)).toStrictEqual([0, 0, 0, 1, 2]);
    },
  );
});
