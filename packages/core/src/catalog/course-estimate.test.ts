import { type CourseFormat, type CourseLevel, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCourseCacheTag, getCourseCurriculumCacheTag } from "../cache/tags";
import { startCourseGoal } from "../goals/start-course-goal";
import { ensureQuickLessons } from "../library/quick-lessons/quick-lessons";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { loadCourseEstimateData } from "./_utils/course-estimate-data";
import { estimateCoursePlan } from "./course-estimate";
import { coursePlanEstimateSchema } from "./course-estimate-contract";

const NOW = new Date("2020-09-28T12:00:00Z");
const DAYS = [1, 2, 3, 4, 5];
const LESSONS_PER_CHAPTER = 12;

const CHAPTER_LEVELS = ["beginner", "beginner", "intermediate", "advanced"] as const;

async function outlinedCourse({
  format = "core",
  levels = CHAPTER_LEVELS,
}: { format?: CourseFormat; levels?: readonly CourseLevel[] } = {}) {
  const course = await courseFixture({
    format,
    isPublished: true,
    title: "Robotics",
    visibility: "public",
  });

  const chapters = await Promise.all(
    [0, 1, 2, 3].map(async (position) => {
      const [chapter, skill] = await Promise.all([
        libraryChapterFixture({ title: `Chapter ${position + 1}` }),
        skillFixture({ name: `Build part ${position + 1}` }),
      ]);

      await Promise.all([
        courseChapterFixture({
          chapterId: chapter.id,
          courseId: course.id,
          level: levels[position],
          position: levels.slice(0, position).filter((level) => level === levels[position]).length,
        }),
        prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
        ...Array.from({ length: LESSONS_PER_CHAPTER }, async (_, lessonPosition) => {
          const lesson = await libraryLessonFixture({
            estimatedMinutes: 5,
            homeChapterId: chapter.id,
            title: `Part ${position + 1}, lesson ${lessonPosition + 1}`,
          });

          await chapterLessonFixture({
            chapterId: chapter.id,
            lessonId: lesson.id,
            position: lessonPosition,
          });
        }),
      ]);

      return { chapter, skill };
    }),
  );

  return { chapters, course };
}

async function examCourse() {
  const outlined = await outlinedCourse();

  const blueprint = await examBlueprintFixture({
    structure: {
      formats: [],
      rules: [],
      subjects: [
        { name: "Math", topics: [] },
        { name: "Science", topics: [] },
      ],
    },
  });

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: NOW,
      graph: {
        phases: [{ milestone: null, name: "Foundations" }],
        skills: outlined.chapters.map(({ skill }, index) => ({
          area: index % 2 === 0 ? "Math" : "Science",
          lessons: LESSONS_PER_CHAPTER,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: 1,
        })),
      },
      model: "fixture",
      primaryCourseId: outlined.course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  return { ...outlined, blueprint };
}

describe(estimateCoursePlan, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("finishes in fewer weeks with more daily time and gives the first day's real lessons", async () => {
    const { course, chapters } = await outlinedCourse();

    const [slow, fast] = await Promise.all(
      [15, 60].map((dailyMinutes) =>
        estimateCoursePlan({ courseId: course.id, dailyMinutes, studyDays: DAYS }),
      ),
    );

    expect(slow).not.toBeNull();
    expect(fast).not.toBeNull();

    if (!slow || !("weeks" in slow) || !fast || !("weeks" in fast)) {
      throw new Error("Expected whole-course estimates");
    }

    expect(fast.weeks).toBeLessThan(slow.weeks);
    expect(Date.parse(fast.endDate ?? "")).toBeLessThan(Date.parse(slow.endDate ?? ""));
    expect(slow.firstDay.length).toBeGreaterThan(0);

    expect(slow.firstDay[0]).toMatchObject({
      chapterId: chapters[0]?.chapter.id,
      estimatedMinutes: 5,
    });

    expect(slow.chapters.map((chapter) => chapter.chapterId)).toStrictEqual(
      chapters.map(({ chapter }) => chapter.id),
    );

    expect(coursePlanEstimateSchema.parse(slow)).toStrictEqual(slow);

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseCacheTag(course.id),
      getCourseCurriculumCacheTag(course.id),
    );
  });

  it("counts only lessons fitting before the date and marks partial and excluded chapters", async () => {
    const { course } = await outlinedCourse();

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 15,
      studyDays: DAYS,
      targetDate: "2020-10-05",
    });

    expect(estimate).not.toBeNull();

    if (!estimate || !("fittingLessons" in estimate)) {
      throw new Error("Expected deadline estimate");
    }

    expect(estimate.fittingLessons).toBeGreaterThan(0);
    expect(estimate.fittingLessons).toBeLessThan(4 * LESSONS_PER_CHAPTER);

    expect(
      estimate.chapters.some((chapter) => chapter.lessonsInPlan === 0 && chapter.week === null),
    ).toBe(true);

    expect(
      estimate.chapters.some(
        (chapter) => chapter.lessonsInPlan > 0 && chapter.lessonsInPlan < LESSONS_PER_CHAPTER,
      ),
    ).toBe(true);

    expect(estimate.chapters.reduce((sum, chapter) => sum + chapter.lessonsInPlan, 0)).toBe(
      estimate.fittingLessons,
    );

    expect(estimate.areas).toMatchObject([
      { area: "Robotics", fitting: estimate.fittingLessons, total: 4 * LESSONS_PER_CHAPTER },
    ]);
  });

  it("returns null for a course whose outline misses a band", async () => {
    const { course } = await outlinedCourse({
      levels: ["beginner", "beginner", "beginner", "beginner"],
    });

    await expect(
      estimateCoursePlan({ courseId: course.id, dailyMinutes: 30, studyDays: DAYS }),
    ).resolves.toBeNull();
  });

  it("returns null for a course without an outline", async () => {
    const course = await courseFixture({ isPublished: true });

    await expect(
      estimateCoursePlan({ courseId: course.id, dailyMinutes: 30, studyDays: DAYS }),
    ).resolves.toBeNull();
  });

  it("does not promise a finish date when a low-time one-day schedule leaves course lessons out", async () => {
    const { course } = await outlinedCourse();

    await expect(
      estimateCoursePlan({ courseId: course.id, dailyMinutes: 5, studyDays: [1] }),
    ).resolves.toBeNull();
  });

  it("counts public exam challenges and tool-only chapters in the total even when they are not planned", async () => {
    const { chapters, course } = await examCourse();
    const [first, second] = chapters;

    const challenge = await libraryLessonFixture({
      homeChapterId: first!.chapter.id,
      identityKey: `challenge:${first!.chapter.id}`,
    });

    await Promise.all([
      chapterLessonFixture({ chapterId: first!.chapter.id, lessonId: challenge.id, position: 12 }),
      prisma.chapter.update({
        data: { tools: [{ essential: true, name: "Spreadsheet" }] },
        where: { id: second!.chapter.id },
      }),
    ]);

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 60,
      studyDays: DAYS,
      targetDate: "2020-10-12",
    });

    if (!estimate || !("areas" in estimate)) {
      throw new Error("Expected deadline estimate");
    }

    expect(estimate.areas.map((area) => ({ area: area.area, total: area.total }))).toStrictEqual([
      { area: "Math", total: 25 },
      { area: "Science", total: 24 },
    ]);
  });

  it("never estimates a private course, even for its owner, and excludes unpublished courses", async () => {
    const [owner, { course }] = await Promise.all([userFixture(), outlinedCourse()]);

    await prisma.course.update({
      data: { userId: owner.id, visibility: "private" },
      where: { id: course.id },
    });

    const input = { courseId: course.id, dailyMinutes: 30, studyDays: DAYS };
    await expect(estimateCoursePlan(input)).resolves.toBeNull();
    mockSession(owner.id);
    await expect(estimateCoursePlan(input)).resolves.toBeNull();

    await prisma.course.update({
      data: { isPublished: false, visibility: "public" },
      where: { id: course.id },
    });

    await expect(estimateCoursePlan(input)).resolves.toBeNull();
  });

  it("reads exam areas through chapter skills without writing a goal or changing the outline", async () => {
    const { course, chapters } = await examCourse();
    const before = await prisma.goal.count({ where: { primaryCourseId: course.id } });

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 30,
      studyDays: DAYS,
      targetDate: "2020-10-12",
    });

    expect(estimate).not.toBeNull();

    if (!estimate || !("areas" in estimate)) {
      throw new Error("Expected deadline estimate");
    }

    expect(estimate.areas.map((area) => ({ area: area.area, total: area.total }))).toStrictEqual([
      { area: "Math", total: 24 },
      { area: "Science", total: 24 },
    ]);

    expect(estimate.areas.reduce((sum, area) => sum + area.fitting, 0)).toBe(
      estimate.fittingLessons,
    );

    expect(
      estimate.chapters.find((chapter) => chapter.chapterId === chapters[1]?.chapter.id)?.area,
    ).toBe("Science");

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(
      before,
    );
  });

  it("finds the exam through its question bank when the shared graph starts on an area course", async () => {
    const [{ blueprint, chapters, course }, areaCourse] = await Promise.all([
      examCourse(),
      courseFixture({ isPublished: true }),
    ]);

    await Promise.all([
      prisma.course.update({ data: { format: "exam" }, where: { id: course.id } }),
      prisma.examSkillGraph.update({
        data: { primaryCourseId: areaCourse.id },
        where: { examBlueprintId: blueprint.id },
      }),
      itemFixture({ examBlueprintId: blueprint.id, skillId: chapters[0]!.skill.id }),
    ]);

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 30,
      studyDays: DAYS,
      targetDate: "2020-10-12",
    });

    expect(estimate).not.toBeNull();

    if (!estimate || !("areas" in estimate)) {
      throw new Error("Expected exam estimate");
    }

    expect(estimate.areas.map((area) => area.area)).toStrictEqual(["Math", "Science"]);
  });

  it("includes newly available quick lessons in the fresh cache inputs and reports them separately", async () => {
    const { blueprint, chapters, course } = await examCourse();
    const [base, target] = chapters;

    const stored = await prisma.examSkillGraph.findUniqueOrThrow({
      where: { examBlueprintId: blueprint.id },
    });

    const graph = parsePlanGraph(stored.graph);

    await Promise.all([
      prisma.courseChapter.deleteMany({
        where: {
          chapterId: { in: chapters.slice(2).map(({ chapter }) => chapter.id) },
          courseId: course.id,
        },
      }),
      prisma.skillPrerequisite.create({
        data: { prerequisiteId: base!.skill.id, skillId: target!.skill.id },
      }),
      prisma.examSkillGraph.update({
        data: {
          graph: {
            ...graph,
            skills: graph.skills
              .slice(0, 2)
              .map((skill, index) => ({ ...skill, topics: index === 0 ? [] : ["Target topic"] })),
          },
        },
        where: { id: stored.id },
      }),
    ]);

    const input = {
      courseId: course.id,
      dailyMinutes: 15,
      studyDays: DAYS,
      targetDate: "2020-10-07",
    };

    const before = await estimateCoursePlan(input);
    const beforeInputs = await loadCourseEstimateData(course.id, "2020-09-28");
    expect(beforeInputs?.quickLessons.size).toBe(0);
    const quickLessons = await ensureQuickLessons({ skillIds: [base!.skill.id] });
    const quick = quickLessons.get(base!.skill.id);

    if (!quick) {
      throw new Error("Expected quick outline");
    }

    await prisma.lesson.update({ data: { estimatedMinutes: 2 }, where: { id: quick.lessonId } });
    const after = await estimateCoursePlan(input);
    const afterInputs = await loadCourseEstimateData(course.id, "2020-09-28");

    expect(afterInputs?.quickLessons.get(base!.skill.id)).toMatchObject({
      lessonId: quick.lessonId,
      minutes: 2,
    });

    if (!before || !("fittingLessons" in before) || !after || !("fittingLessons" in after)) {
      throw new Error("Expected deadline estimates");
    }

    expect(after.fittingLessons).toBeGreaterThanOrEqual(before.fittingLessons);

    expect(after.areas.reduce((sum, area) => sum + area.quickLessons, 0)).toBeGreaterThan(
      before.areas.reduce((sum, area) => sum + area.quickLessons, 0),
    );
  });

  it.each(["core", "exam"] as const)(
    "matches a new %s course start's planner end and first day for a learner starting from scratch",
    async (format) => {
      const [{ course }, user] = await Promise.all([outlinedCourse({ format }), userFixture()]);

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes: 30,
        studyDays: DAYS,
      });

      mockSession(user.id);

      const started = await startCourseGoal({
        courseId: course.id,
        input: { dailyMinutes: 30, level: "basic", studyDays: DAYS, timeZone: "UTC" },
      });

      expect(started.status).toBe("created");

      if (started.status !== "created" || !estimate || !("endDate" in estimate)) {
        throw new Error("Expected a course plan and estimate");
      }

      const plan = await prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { goalId: started.goal.id },
      });

      const dates = plan.items
        .flatMap((item) => item.scheduledFor?.toISOString().slice(0, 10) ?? [])
        .toSorted();

      expect(estimate.endDate).toBe(dates.at(-1));

      const first = plan.items.filter(
        (item) =>
          item.kind === "lesson" && item.scheduledFor?.toISOString().slice(0, 10) === "2020-09-28",
      );

      expect(estimate.firstDay.map((lesson) => lesson.lessonId)).toStrictEqual(
        first.map((item) => item.lessonId),
      );
    },
  );
});
