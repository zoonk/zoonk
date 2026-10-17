import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonsFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureQuickLessons } from "../library/quick-lessons/quick-lessons";
import { buildPlan } from "../plans/planner/build-plan";
import { daysBetween } from "../plans/planner/plan-calendar";
import { type PlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { loadCourseEstimateData } from "./_utils/course-estimate-data";
import { summarizeCourseEstimate } from "./_utils/summarize-course-estimate";
import { estimateCoursePlan } from "./course-estimate";

const TODAY = "2020-09-28";
const NOW = new Date(`${TODAY}T12:00:00Z`);
const DAYS = [1, 2, 3, 4, 5];

async function examOutline() {
  const [course, blueprint, base, target] = await Promise.all([
    courseFixture({ format: "exam", isPublished: true, visibility: "public" }),
    examBlueprintFixture({
      structure: {
        formats: [],
        rules: [],
        subjects: [
          { name: "Math", topics: [] },
          { name: "Science", topics: [] },
        ],
      },
    }),
    skillFixture(),
    skillFixture(),
  ]);

  const chapters = await Promise.all(
    [base, target].map(async (skill, position) => {
      const chapter = await libraryChapterFixture();

      const lessons = await libraryLessonsFixture(12, {
        estimatedMinutes: 5,
        homeChapterId: chapter.id,
      });

      await Promise.all([
        courseChapterFixture({
          area: position === 0 ? "Math" : "Science",
          chapterId: chapter.id,
          courseId: course.id,
          position,
        }),
        chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
        ...lessons.flatMap((lesson, lessonPosition) => [
          chapterLessonFixture({
            chapterId: chapter.id,
            lessonId: lesson.id,
            position: lessonPosition,
          }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
        ]),
      ]);

      return chapter;
    }),
  );

  const graph: PlanGraph = {
    phases: [{ milestone: null, name: "Subjects" }],
    skills: [base, target].map((skill, position) => ({
      area: position === 0 ? "Math" : "Science",
      courseIds: [course.id],
      lessons: 12,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      topics: position === 0 ? [] : ["Target topic"],
      weight: 1,
    })),
  };

  const stored = await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: NOW,
      graph,
      model: "fixture",
      primaryCourseId: course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  await prisma.skillPrerequisite.create({ data: { prerequisiteId: base.id, skillId: target.id } });
  return { base, chapters, course, graph, stored, target };
}

describe("course estimate chapter work", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([true, false])(
    "dates a base chapter covered by its quick replacement (written %s)",
    async (written) => {
      const { base, chapters, course } = await examOutline();

      if (written) {
        const quickLessons = await ensureQuickLessons({ skillIds: [base.id] });
        const quick = quickLessons.get(base.id)!;

        await prisma.lesson.update({
          data: { estimatedMinutes: 2 },
          where: { id: quick.lessonId },
        });
      }

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes: 15,
        studyDays: DAYS,
        targetDate: "2020-10-07",
      });

      if (!estimate || !("fittingLessons" in estimate)) {
        throw new Error("Expected dated estimate");
      }

      const area = estimate.areas.find((row) => row.area === "Math")!;
      expect(area.plannedMinutes).toBeGreaterThan(0);
      expect(written ? area.quickLessons : area.unwrittenMinutes).toBeGreaterThan(0);

      expect(estimate.chapters.find((row) => row.chapterId === chapters[0]!.id)).toMatchObject({
        endWeek: written ? 1 : null,
        lessonsInPlan: 0,
        week: 1,
        workKinds: [written ? "quick" : "unwritten"],
      });
    },
  );

  it("links unwritten work by exact chapter skills without filling unrelated chapters in its area", async () => {
    const { course, graph, stored } = await examOutline();

    const [missing, unrelated, missingChapter, unrelatedChapter] = await Promise.all([
      skillFixture(),
      skillFixture(),
      libraryChapterFixture(),
      libraryChapterFixture(),
    ]);

    await Promise.all([
      courseChapterFixture({
        area: "Math",
        chapterId: missingChapter.id,
        courseId: course.id,
        position: 2,
      }),
      courseChapterFixture({
        area: "Math",
        chapterId: unrelatedChapter.id,
        courseId: course.id,
        position: 3,
      }),
      chapterSkillFixture({ chapterId: missingChapter.id, skillId: missing.id }),
      chapterSkillFixture({ chapterId: unrelatedChapter.id, skillId: unrelated.id }),
      prisma.examSkillGraph.update({
        data: {
          graph: {
            ...graph,
            skills: [
              ...graph.skills,
              {
                area: "Math",
                courseIds: [course.id],
                lessons: 3,
                name: missing.name,
                phase: 0,
                skillId: missing.id,
                topics: ["Missing concept"],
                weight: 1,
              },
            ],
          },
        },
        where: { id: stored.id },
      }),
    ]);

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 240,
      studyDays: DAYS,
      targetDate: "2020-10-26",
    });

    if (!estimate || !("fittingLessons" in estimate)) {
      throw new Error("Expected dated estimate");
    }

    expect(estimate.chapters.find((row) => row.chapterId === missingChapter.id)).toMatchObject({
      endWeek: null,
      lessonsInPlan: 0,
      week: expect.any(Number),
      workKinds: ["unwritten"],
    });

    expect(estimate.chapters.find((row) => row.chapterId === unrelatedChapter.id)).toMatchObject({
      endWeek: null,
      lessonsInPlan: 0,
      week: null,
      workKinds: [],
    });
  });

  it("keeps calendar weeks and exposes a chapter continuing through a week with no chapter start", async () => {
    const { base, chapters, course } = await examOutline();
    const data = await loadCourseEstimateData(course.id, TODAY);

    if (!data) {
      throw new Error("Expected public planner data");
    }

    const built = buildPlan({
      courseStart: true,
      goal: { dailyMinutes: 10, kind: "learn", targetDate: null },
      graph: data.graph,
      items: [],
      lessons: data.lessons,
      mockMinutes: data.facts.mockMinutes,
      mode: "forced",
      paceFactor: data.pace.factor,
      prerequisites: data.prerequisites,
      readiness: new Map(),
      settings: parsePlanSettings({
        baseChoices: [{ choice: "deep", skillId: base.id }],
        startDate: TODAY,
        weekdayMinutes: [0, 10, 10, 10, 10, 10, 0],
      }),
      today: new Date(TODAY),
    });

    const original = built.items.filter(
      (item) =>
        item.kind === "lesson" &&
        item.lessonId &&
        data.chapters[0]!.lessonIds.includes(item.lessonId),
    );

    const first = Math.min(
      ...original.map(
        (item) => Math.floor(daysBetween(new Date(TODAY), item.scheduledFor!) / 7) + 1,
      ),
    );

    const last = Math.max(
      ...original.map(
        (item) => Math.floor(daysBetween(new Date(TODAY), item.scheduledFor!) / 7) + 1,
      ),
    );

    expect(last).toBeGreaterThan(first);
    const summary = summarizeCourseEstimate({ built, data, today: new Date(TODAY) });
    expect(summary.chapters.some((row) => row.week === first + 1)).toBe(false);

    expect(
      original.some(
        (item) =>
          Math.floor(daysBetween(new Date(TODAY), item.scheduledFor!) / 7) + 1 === first + 1,
      ),
    ).toBe(true);

    expect(summary.chapters.find((row) => row.chapterId === chapters[0]!.id)).toMatchObject({
      endWeek: last,
      lessonsInPlan: 12,
      week: first,
      workKinds: ["original"],
    });

    expect(summary.fittingLessons).toBe(24);
  });
});
