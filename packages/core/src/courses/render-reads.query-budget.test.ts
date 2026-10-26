import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { estimateCoursePlan } from "../catalog/course-estimate";
import { getCourseExamDays } from "../catalog/course-exam-days";
import { getCourseExamDaysByRoute } from "../catalog/course-exam-days-by-route";
import { getLibraryCourse } from "../library/courses/get-library-course";
import { getPublicLibraryLesson } from "../library/lessons/get-public-library-lesson";
import { getChapterHomeRoute, getLessonHomeRoute } from "../library/routes/get-home-route";
import { countCatalogCourses } from "./count-catalog-courses";
import { getCourse } from "./get-course-by-slug";
import { listCourses } from "./list-courses";
import { listPublishedCourseEditions } from "./list-published-course-editions";

describe("public catalog render read budgets", () => {
  it.each([
    "outline",
    "lesson",
    "count",
    "list",
    "editions",
    "exam days",
    "course",
    "estimate",
    "chapter home",
    "lesson home",
    "course exam days",
  ] as const)("reads %s", async (name) => {
    const language = randomUUID().slice(0, 10);
    const family = await prisma.courseFamily.create({ data: {} });

    const { chapters, course, organization, lessons } = await catalogCourseFixture({
      familyId: family.id,
      language,
      lessonCounts: name === "estimate" ? [2, 1, 1] : [2, 1],
    });

    if (name === "estimate") {
      const levels = ["beginner", "intermediate", "advanced"] as const;

      await Promise.all(
        chapters.map(async (chapter, index) => {
          const skill = await skillFixture();
          await prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } });

          await prisma.courseChapter.updateMany({
            data: { level: levels[index] },
            where: { chapterId: chapter.id, courseId: course.id },
          });
        }),
      );
    }

    if (name === "exam days" || name === "course exam days") {
      freezeClock();
      vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));

      const blueprint = await examBlueprintFixture({
        edition: {
          citations: [],
          dates: [
            {
              citation: { passage: "Exam day", sourceId: "notice" },
              date: "2026-12-18",
              kind: "exam",
              label: "Exam",
            },
          ],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: "UTC",
          year: 2026,
        },
      });

      await prisma.course.update({ data: { format: "exam" }, where: { id: course.id } });

      await prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: new Date(),
          graph: { phases: [], skills: [] },
          model: "fixture",
          primaryCourseId: course.id,
          promptVersion: "fixture",
          runId: "fixture",
        },
      });
    }

    mockSession(null);

    const readers = {
      "chapter home": () => getChapterHomeRoute({ chapterId: chapters[0]!.id }),
      count: () => countCatalogCourses({ language }),
      course: () => getCourse({ brandSlug: organization.slug, courseSlug: course.slug }),
      "course exam days": () => getCourseExamDays(course.id),
      editions: () => listPublishedCourseEditions({ courseId: course.id }),
      estimate: () =>
        estimateCoursePlan({ courseId: course.id, dailyMinutes: 30, studyDays: [1, 2, 3, 4, 5] }),
      "exam days": () =>
        getCourseExamDaysByRoute({ brandSlug: organization.slug, courseSlug: course.slug }),
      lesson: () => getPublicLibraryLesson({ lessonId: lessons[0]![0]!.id }),
      "lesson home": () => getLessonHomeRoute({ lessonId: lessons[0]![0]!.id }),
      list: () => listCourses({ language }),
      outline: () => getLibraryCourse({ courseId: course.id }),
    };

    const counts = await countDatabaseStatements<unknown>(readers[name]);

    const budgets = {
      "chapter home": 3,
      count: 2,
      course: 3,
      "course exam days": 3,
      editions: 3,
      estimate: 38,
      "exam days": 4,
      lesson: 2,
      "lesson home": 4,
      // The courses, their brands, their first categories (each card's subject) and their totals.
      list: 4,
      outline: 5,
    };

    assertReadBudget(counts, budgets[name]);

    const expected = {
      "chapter home": { chapterSlug: chapters[0]!.slug, courseSlug: course.slug },
      count: { total: 1 },
      course: { id: course.id },
      "course exam days": { days: ["2026-12-18"], estimated: false },
      editions: [{ id: course.id }],
      estimate: expect.any(Object),
      "exam days": { days: ["2026-12-18"], estimated: false },
      lesson: { id: lessons[0]![0]!.id },
      "lesson home": { courseSlug: course.slug, lessonSlug: lessons[0]![0]!.slug },
      list: [{ id: course.id }],
      outline: { id: course.id },
    };

    expect(counts.result).toMatchObject(expected[name]);
  });
});
