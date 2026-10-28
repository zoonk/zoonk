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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCourseEstimateData } from "./_utils/course-estimate-data";
import { estimateCoursePlan } from "./course-estimate";

const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";
const WEEKDAYS = [1, 2, 3, 4, 5];

const TARGET = "2020-10-22";

const ENEM_STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [],
    timeLimitMinutes: 330,
    totalQuestions: 90,
  },
  rules: [],
  subjects: [],
};

const LONG_TARGET = "2020-12-17";
const LONG_BUDGET = 57 * 60 + 15;

const AREAS = ["Linguagens", "Ciências Humanas", "Ciências da Natureza", "Matemática"];

async function partialExamCourse({ lessonsPerArea = 5 }: { lessonsPerArea?: number } = {}) {
  const [course, blueprint, missing] = await Promise.all([
    courseFixture({ format: "exam", isPublished: true, language: "pt", title: "ENEM" }),
    examBlueprintFixture({ language: "pt", structure: ENEM_STRUCTURE }),
    skillFixture({ language: "pt" }),
  ]);

  const rows = await Promise.all(
    AREAS.map(async (area, position) => {
      const [chapter, skill] = await Promise.all([
        libraryChapterFixture({ language: "pt" }),
        skillFixture({ language: "pt" }),
      ]);

      await courseChapterFixture({ area, chapterId: chapter.id, courseId: course.id, position });

      await Promise.all(
        Array.from({ length: lessonsPerArea }, async (_, lessonPosition) => {
          const lesson = await libraryLessonFixture({ estimatedMinutes: 6, language: "pt" });

          await Promise.all([
            chapterLessonFixture({
              chapterId: chapter.id,
              lessonId: lesson.id,
              position: lessonPosition,
            }),
            lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
          ]);
        }),
      );

      return { area, skill };
    }),
  );

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: NOW,
      graph: {
        phases: [{ milestone: null, name: "ENEM" }],
        skills: [
          ...rows.map(({ area, skill }) => ({
            area,
            courseIds: [course.id],
            lessons: lessonsPerArea,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: 1,
          })),
          {
            area: "Matemática",
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
      runId: crypto.randomUUID(),
    },
  });

  return course;
}

function sumWorkload(workload: {
  checkpointMinutes: number;
  lessonMinutes: number;
  practiceMinutes: number;
  unwrittenLessonMinutes: number;
}): number {
  return (
    workload.checkpointMinutes +
    workload.lessonMinutes +
    workload.practiceMinutes +
    workload.unwrittenLessonMinutes
  );
}

describe("a dated course estimate's study time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { budget: 17 * 15 + 15, dailyMinutes: 15 },
    { budget: 17 * 30 + 15, dailyMinutes: 30 },
    { budget: 17 * 45 + 15, dailyMinutes: 45 },
    { budget: 17 * 60 + 15, dailyMinutes: 60 },
  ])(
    "plans no more than the $budget minutes $dailyMinutes minutes a weekday give before the exam",
    async ({ budget, dailyMinutes }) => {
      const course = await partialExamCourse();
      const data = await loadCourseEstimateData(course.id, TODAY);

      expect(data?.facts).toMatchObject({ fullMockMinutes: 330, mockMinutes: 165 });

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes,
        studyDays: WEEKDAYS,
        targetDate: TARGET,
      });

      if (!estimate) {
        throw new Error("Expected a dated estimate");
      }

      expect(sumWorkload(estimate.workload)).toBeLessThanOrEqual(budget + 0.1);

      expect(estimate.workload.checkpointMinutes).toBe(dailyMinutes === 15 ? 45 : 45 + 165);
    },
  );

  it("funds the final stretch's whole-day mock from the days before it, at its real length", async () => {
    const course = await partialExamCourse({ lessonsPerArea: 40 });

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 60,
      studyDays: WEEKDAYS,
      targetDate: LONG_TARGET,
    });

    if (!estimate) {
      throw new Error("Expected a dated estimate");
    }

    expect(estimate.workload.checkpointMinutes).toBeGreaterThanOrEqual(330 + 165);
    expect(sumWorkload(estimate.workload)).toBeLessThanOrEqual(LONG_BUDGET + 0.1);
  });
});
