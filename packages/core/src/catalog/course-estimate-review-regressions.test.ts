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
import { loadCourseOutline, plansFromCourseOutline } from "../goals/_utils/course-outline";
import { startCourseGoal } from "../goals/start-course-goal";
import { getStartedCourseScope } from "../library/curriculum/course-start-graph";
import { loadGoalCurriculumInputs } from "../library/curriculum/goal-curriculum-inputs";
import { toGoalPlanGraph } from "../library/curriculum/goal-plan-graph";
import { findReusableCurriculum } from "../library/curriculum/reusable-curriculum";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import { type PlanGraph, parsePlanGraph } from "../plans/planner/plan-state";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { loadCourseEstimateData } from "./_utils/course-estimate-data";
import { estimateCoursePlan } from "./course-estimate";

const NOW = new Date("2020-09-28T12:00:00Z");
const DAYS = [1, 2, 3, 4, 5];
const TARGET_DATE = "2020-10-26";

/** Undefined is a published tag missing from the revised graph; null is a retained unknown. */
async function publicExamOutline({
  area = null,
  tagAreas = ["Math", undefined],
}: { area?: string | null; tagAreas?: readonly (string | null | undefined)[] } = {}) {
  const [course, chapter, blueprint, lessonSkill, ...tags] = await Promise.all([
    courseFixture({
      format: "exam",
      isPublished: true,
      title: "Public exam",
      visibility: "public",
    }),
    libraryChapterFixture(),
    examBlueprintFixture(),
    skillFixture({ name: "Apply the chapter's concepts" }),
    ...tagAreas.map((_, position) => skillFixture({ name: `Published chapter tag ${position}` })),
  ]);

  const lesson = await libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapter.id });

  await Promise.all([
    courseChapterFixture({ area, chapterId: chapter.id, courseId: course.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: lessonSkill.id }),
    ...tags.map((skill) =>
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
    ),
  ]);

  const graph: PlanGraph = {
    phases: [{ milestone: null, name: "Exam subjects" }],
    skills: tags.flatMap((skill, position) =>
      tagAreas[position] === undefined
        ? []
        : [
            {
              area: tagAreas[position]!,
              courseIds: [course.id],
              lessons: 1,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: 1,
            },
          ],
    ),
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

  return { chapter, course, graph, lesson, stored, tags };
}

describe("course estimate privacy and area evidence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { targetDate: undefined, visibility: "private" },
    { targetDate: TARGET_DATE, visibility: "private" },
    { targetDate: TARGET_DATE, visibility: "public" },
  ] as const)(
    "checks a $visibility course referenced only by an option before pinning (date $targetDate)",
    async ({ targetDate, visibility }) => {
      const [{ course, graph, stored }, missing, option, optionCourse] = await Promise.all([
        publicExamOutline({ tagAreas: ["Math"] }),
        skillFixture(),
        skillFixture(),
        courseFixture({ visibility }),
      ]);

      const original: PlanGraph = {
        ...graph,
        optionSkills: [
          {
            after: graph.skills[0]!.skillId,
            area: "Elective",
            courseIds: [optionCourse.id],
            lessons: 1,
            name: option.name,
            phase: 0,
            skillId: option.id,
            weight: 1,
          },
        ],
        skills: [
          ...graph.skills,
          {
            area: "Math",
            courseIds: [course.id],
            lessons: 1,
            name: missing.name,
            phase: 0,
            skillId: missing.id,
            weight: 1,
          },
        ],
      };

      await prisma.examSkillGraph.update({ data: { graph: original }, where: { id: stored.id } });

      expect(original.skills.every((skill) => !skill.courseIds?.includes(optionCourse.id))).toBe(
        true,
      );

      expect(
        plansFromCourseOutline({
          chapterId: null,
          chapters: await loadCourseOutline({ courseId: course.id, userId: null }),
          courseFormat: course.format,
          courseId: course.id,
          examGraph: original,
          outlineStatus: course.outlineStatus,
        }),
      ).toBe(false);

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes: 240,
        studyDays: DAYS,
        ...(targetDate ? { targetDate } : {}),
      });

      expect(estimate === null).toBe(visibility === "private");
    },
  );

  it.each([
    { area: null, expected: null, name: "missing published tag", tagAreas: ["Math", undefined] },
    { area: null, expected: null, name: "retained unknown tag", tagAreas: ["Math", null] },
    { area: null, expected: null, name: "mixed mapped tags", tagAreas: ["Math", "Humanities"] },
    { area: null, expected: "Math", name: "complete consistent tags", tagAreas: ["Math", "Math"] },
    {
      area: "Humanities",
      expected: "Humanities",
      name: "persisted area with a missing tag",
      tagAreas: ["Math", undefined],
    },
  ])(
    "reports conservative chapter and area totals for $name",
    async ({ area, tagAreas, expected }) => {
      const { chapter, course, graph, tags } = await publicExamOutline({ area, tagAreas });
      const outline = await loadCourseOutline({ courseId: course.id, userId: null });

      expect(outline[0]).toMatchObject({
        area,
        tags: expect.arrayContaining(tags.map(({ id, name }) => ({ id, name }))),
      });

      expect(outline[0]!.tags).toHaveLength(tags.length);
      expect(graph.skills).toHaveLength(tagAreas.filter((value) => value !== undefined).length);

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes: 240,
        studyDays: DAYS,
        targetDate: TARGET_DATE,
      });

      expect(estimate).not.toBeNull();

      if (!estimate || !("areas" in estimate)) {
        throw new Error("Expected a dated public exam estimate");
      }

      expect(estimate.chapters).toStrictEqual([
        expect.objectContaining({ area: expected, chapterId: chapter.id }),
      ]);

      expect(estimate.areas).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ area: expected, fitting: estimate.fittingLessons, total: 1 }),
        ]),
      );
    },
  );

  it("still rejects an ordinary partial outline and a public course with no outline", async () => {
    const [{ course }, noOutline] = await Promise.all([
      publicExamOutline({ tagAreas: ["Math"] }),
      courseFixture({ isPublished: true, visibility: "public" }),
    ]);

    await prisma.examSkillGraph.deleteMany({ where: { primaryCourseId: course.id } });
    await prisma.course.update({ data: { format: "core" }, where: { id: course.id } });

    const estimates = await Promise.all(
      [course, noOutline].map((entry) =>
        estimateCoursePlan({ courseId: entry.id, dailyMinutes: 30, studyDays: DAYS }),
      ),
    );

    expect(estimates).toStrictEqual([null, null]);
  });

  it("covers every chapter placement of a reused lesson while counting it once per area and plan", async () => {
    const { chapter, course, lesson, tags } = await publicExamOutline({ tagAreas: ["Math"] });
    const alternate = await libraryChapterFixture();

    await Promise.all([
      courseChapterFixture({ chapterId: alternate.id, courseId: course.id, position: 1 }),
      chapterLessonFixture({ chapterId: alternate.id, lessonId: lesson.id, position: 0 }),
      prisma.chapterSkill.create({ data: { chapterId: alternate.id, skillId: tags[0]!.id } }),
    ]);

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 240,
      studyDays: DAYS,
      targetDate: TARGET_DATE,
    });

    expect(estimate).not.toBeNull();

    if (!estimate || !("areas" in estimate)) {
      throw new Error("Expected a dated public exam estimate");
    }

    expect(estimate.fittingLessons).toBe(1);

    expect(estimate.chapters).toStrictEqual([
      expect.objectContaining({ area: "Math", chapterId: chapter.id, lessonsInPlan: 1, week: 1 }),
      expect.objectContaining({ area: "Math", chapterId: alternate.id, lessonsInPlan: 1, week: 1 }),
    ]);

    expect(estimate.areas).toMatchObject([
      { area: "Math", fitting: 1, plannedMinutes: 3, total: 1 },
    ]);

    const undated = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 240,
      studyDays: DAYS,
    });

    expect(undated).toMatchObject({
      chapters: [
        { chapterId: chapter.id, week: 1 },
        { chapterId: alternate.id, week: 1 },
      ],
    });
  });

  it.each(["Science", null])(
    "partitions original lesson time across Math and %s without duplicating global minutes",
    async (secondArea) => {
      const { chapter, course, lesson, tags } = await publicExamOutline({
        area: "Math",
        tagAreas: ["Math"],
      });

      const [scienceChapter, scienceSkill] = await Promise.all([
        libraryChapterFixture(),
        skillFixture(),
      ]);

      await prisma.lessonSkill.deleteMany({ where: { lessonId: lesson.id } });

      await Promise.all([
        lessonSkillFixture({ lessonId: lesson.id, skillId: tags[0]!.id }),
        courseChapterFixture({
          area: secondArea,
          chapterId: scienceChapter.id,
          courseId: course.id,
          position: 1,
        }),
        chapterLessonFixture({ chapterId: scienceChapter.id, lessonId: lesson.id, position: 0 }),
        prisma.chapterSkill.create({
          data: { chapterId: scienceChapter.id, skillId: scienceSkill.id },
        }),
      ]);

      const estimate = await estimateCoursePlan({
        courseId: course.id,
        dailyMinutes: 240,
        studyDays: DAYS,
        targetDate: TARGET_DATE,
      });

      if (!estimate || !("areas" in estimate)) {
        throw new Error("Expected a dated public exam estimate");
      }

      expect(estimate.fittingLessons).toBe(1);

      expect(estimate.chapters).toMatchObject([
        { area: "Math", chapterId: chapter.id, lessonsInPlan: 1, week: 1 },
        { area: secondArea, chapterId: scienceChapter.id, lessonsInPlan: 1, week: 1 },
      ]);

      expect(estimate.areas).toMatchObject([
        { area: "Math", fitting: 1, plannedMinutes: 1.5, total: 1, unwrittenMinutes: 0 },
        { area: secondArea, fitting: 1, plannedMinutes: 1.5, total: 1, unwrittenMinutes: 0 },
      ]);

      expect(estimate.workload.lessonMinutes).toBe(3);
      expect(estimate.workload.unwrittenLessonMinutes).toBe(0);

      expect(estimate.areas.reduce((sum, area) => sum + area.plannedMinutes, 0)).toBeCloseTo(
        estimate.workload.lessonMinutes + estimate.workload.unwrittenLessonMinutes,
        1,
      );
    },
  );

  it("a return to a real course-start plan reports zero shared-skill feasibility when no study day remains before its date", async () => {
    const [{ course, lesson, tags }, user] = await Promise.all([
      publicExamOutline({ tagAreas: ["Math", "Math", "Math"] }),
      userFixture(),
    ]);

    await prisma.lessonSkill.deleteMany({ where: { lessonId: lesson.id } });

    await Promise.all(
      tags.map((skill) => lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id })),
    );

    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });

    const started = await startCourseGoal({
      courseId: course.id,
      input: {
        dailyMinutes: 15,
        level: "none",
        studyDays: [5],
        targetDate: "2020-09-30",
        timeZone: "UTC",
      },
    });

    if (started.status !== "created") {
      throw new Error("Expected a real course-start plan");
    }

    /** The first day always permits study, even on a rest weekday; the learner missed it. */
    const returnedAt = new Date("2020-09-29T12:00:00Z");
    vi.setSystemTime(returnedAt);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-29T00:00:00Z"),
      currentInstant: returnedAt,
      timeZone: "UTC",
    });

    await refreshGoalPlan({ goalId: started.goal.id });

    const [stored, viewed] = await Promise.all([
      prisma.plan.findUniqueOrThrow({
        include: { items: true },
        where: { goalId: started.goal.id },
      }),
      getGoalPlan(started.goal.id),
    ]);

    expect(stored.coveredShare).toBe(0);

    expect(
      stored.items
        .filter((item) => item.kind === "lesson")
        .every((item) => item.lessonId === lesson.id),
    ).toBe(true);

    expect(viewed).toMatchObject({
      plan: { feasibility: { coveredShare: 0, fits: false } },
      status: "ready",
    });
  });

  it("filters an earlier merged optional alias before resolving its required survivor, like a real reused course start", async () => {
    const { chapter, course, lesson, stored, tags } = await publicExamOutline({
      area: "Math",
      tagAreas: ["Math"],
    });

    const survivor = tags[0]!;

    const [alias, missing, user] = await Promise.all([
      /** Admin merges leave the stored JSON graph unchanged and record this public survivor. */
      skillFixture({ mergedIntoId: survivor.id, name: "Read graphs in optional Physics" }),
      skillFixture({ name: "Required equations not outlined yet" }),
      userFixture(),
    ]);

    const graph: PlanGraph = {
      phases: [{ milestone: null, name: "Exam subjects" }],
      skills: [
        {
          area: "Physics",
          courseIds: [course.id],
          lessons: 1,
          name: alias.name,
          phase: 0,
          skillId: alias.id,
          topics: ["Read graphs"],
          weight: 1,
        },
        {
          area: "Math",
          courseIds: [course.id],
          lessons: 1,
          name: survivor.name,
          phase: 0,
          skillId: survivor.id,
          topics: ["Read graphs"],
          weight: 1,
        },
        {
          area: "Math",
          courseIds: [course.id],
          lessons: 2,
          name: missing.name,
          phase: 0,
          skillId: missing.id,
          topics: ["Solve equations"],
          weight: 1,
        },
      ],
    };

    const citation = {
      passage: "Required Math with one science elective",
      sourceId: "fixture-notice",
    };

    const structure = examStructureSchema.parse({
      formats: [],
      mock: null,
      rules: [],
      subjects: [
        {
          citation,
          name: "Math",
          questions: null,
          topics: ["Read graphs", "Solve equations"],
          weight: null,
        },
        {
          choiceGroup: "Elective",
          citation,
          name: "Physics",
          questions: null,
          topics: ["Read graphs"],
          weight: null,
        },
        {
          choiceGroup: "Elective",
          citation,
          name: "Chemistry",
          questions: null,
          topics: ["Chemical reactions"],
          weight: null,
        },
      ],
    });

    await prisma.lessonSkill.deleteMany({ where: { lessonId: lesson.id } });

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: survivor.id }),
      prisma.examSkillGraph.update({ data: { graph }, where: { id: stored.id } }),
      prisma.examBlueprint.update({ data: { structure }, where: { id: stored.examBlueprintId } }),
    ]);

    expect(
      plansFromCourseOutline({
        chapterId: null,
        chapters: await loadCourseOutline({ courseId: course.id, userId: null }),
        courseFormat: course.format,
        courseId: course.id,
        examGraph: graph,
        outlineStatus: course.outlineStatus,
      }),
    ).toBe(false);

    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });

    const started = await startCourseGoal({
      courseId: course.id,
      input: {
        dailyMinutes: 240,
        level: "none",
        studyDays: DAYS,
        targetDate: TARGET_DATE,
        timeZone: "UTC",
      },
    });

    if (started.status !== "created") {
      throw new Error("Expected an incomplete public course start");
    }

    const inputs = await loadGoalCurriculumInputs(started.goal.id);

    if (!inputs?.startedCourse) {
      throw new Error("Expected the real course-start curriculum inputs");
    }

    const reused = await findReusableCurriculum({
      inputs,
      scope: getStartedCourseScope({ course: inputs.startedCourse, goal: inputs.goal }),
    });

    if (!reused) {
      throw new Error("Expected the stored public curriculum to be reusable");
    }

    await expect(
      createGoalPlan({ goalId: started.goal.id, graph: toGoalPlanGraph(reused) }),
    ).resolves.toMatchObject({ status: "created" });

    const plan = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { goalId: started.goal.id },
    });

    const actualSkills = parsePlanGraph(plan.graph).skills.map(({ area, skillId }) => ({
      area,
      skillId,
    }));

    expect(actualSkills).toStrictEqual([
      { area: "Math", skillId: survivor.id },
      { area: "Math", skillId: missing.id },
    ]);

    expect(
      plan.items
        .filter(
          (item) => item.kind === "lesson" && item.lessonId !== null && item.status === "todo",
        )
        .map((item) => item.lessonId),
    ).toStrictEqual([lesson.id]);

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 240,
      studyDays: DAYS,
      targetDate: TARGET_DATE,
    });

    expect(estimate).toMatchObject({
      chapters: [{ area: "Math", chapterId: chapter.id, lessonsInPlan: 1 }],
      fittingLessons: 1,
    });

    const estimated = await loadCourseEstimateData(course.id, "2020-09-28");

    expect(estimated?.graph.skills.map(({ area, skillId }) => ({ area, skillId }))).toStrictEqual(
      actualSkills,
    );
  });
});
