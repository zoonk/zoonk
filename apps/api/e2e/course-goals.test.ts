import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { getTargetDateBounds } from "@zoonk/core/plans/target-date-range";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseBandsFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { courseEstimateResponseSchema } from "../src/lib/openapi/schemas/course-estimates";
import { goalSchema } from "../src/lib/openapi/schemas/goals";
import { onboardingResponseSchema } from "../src/lib/openapi/schemas/onboarding";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

/** A published course with two Beginner chapters of two one-skill lessons each. */
async function createOutlinedCourse({
  everyBand = false,
  lessonsPerChapter = 2,
}: {
  /** Every band of the course written, so a whole-course start plans from this outline. */
  everyBand?: boolean;
  lessonsPerChapter?: number;
} = {}) {
  const course = await courseFixture({
    isPublished: true,
    title: `Robotics ${randomUUID()}`,
    visibility: "public",
  });

  const chapters = await Promise.all(
    ["What robots are made of", "How robots decide"].map(async (title, position) => {
      const chapter = await libraryChapterFixture({ title });
      await courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position });
      return chapter;
    }),
  );

  if (everyBand) {
    await courseBandsFixture({ courseId: course.id, levels: ["intermediate", "advanced"] });
  }

  await Promise.all(
    chapters.flatMap((chapter, chapterIndex) =>
      Array.from({ length: lessonsPerChapter }, (_, position) => position).map(async (position) => {
        const [lesson, skill] = await Promise.all([
          libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapter.id }),
          skillFixture({ name: `Skill ${chapterIndex + 1}.${position + 1}` }),
        ]);

        await Promise.all([
          chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
        ]);
      }),
    ),
  );

  return { chapters, course };
}

async function countPlanLessons(goalId: string) {
  return prisma.planItem.count({ where: { kind: "lesson", plan: { goalId } } });
}

test.describe("Course goals API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("estimates a public course signed out, counts what fits and writes no goal", async () => {
    const [anonymous, { course }, partial] = await Promise.all([
      request.newContext({ baseURL }),
      createOutlinedCourse({ everyBand: true, lessonsPerChapter: 12 }),
      createOutlinedCourse({ lessonsPerChapter: 12 }),
    ]);

    const query = "dailyMinutes=30&studyDays=1,2,3,4,5";

    // A course missing a band is planned from the learner's own graph: no estimate of its chapters.
    await expect(
      readBody({
        response: await anonymous.get(`/v1/courses/${partial.course.id}/estimate?${query}`),
        schema: courseEstimateResponseSchema,
      }),
    ).resolves.toBeNull();

    const estimate = await readBody({
      response: await anonymous.get(`/v1/courses/${course.id}/estimate?${query}`),
      schema: courseEstimateResponseSchema,
    });

    expect(estimate).not.toBeNull();

    if (!estimate || !("weeks" in estimate)) {
      throw new Error("Expected a course estimate");
    }

    expect(estimate.firstDay.length).toBeGreaterThan(0);
    expect(estimate.firstDay.every((lesson) => lesson.dayMinutes > 0)).toBe(true);
    expect(estimate.workload.lessonMinutes).toBeGreaterThan(0);
    expect(estimate.workload.unwrittenLessonMinutes).toBe(0);
    expect(estimate.workload.practiceMinutes).toBeGreaterThan(0);
    expect(estimate.workload.checkpointMinutes).toBeGreaterThan(0);
    expect(estimate.numbers.workload).toEqual(estimate.workload);

    expect(estimate.numbers.scheduledMinutes).toBe(
      Object.values(estimate.workload).reduce((sum, minutes) => sum + minutes, 0),
    );

    expect(estimate.numbers).toMatchObject({
      availableBeforeDeadlineMinutes: null,
      context: { dailyMinutes: 30, targetDate: null, weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] },
      coverage: null,
    });

    expect(estimate.publishedContent.lessons).toBe(26);
    // Its two beginner chapters and one in each later band.
    expect(estimate.chapters).toHaveLength(4);
    const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

    const dated = await readBody({
      response: await anonymous.get(
        `/v1/courses/${course.id}/estimate?${query}&targetDate=${date}`,
      ),
      schema: courseEstimateResponseSchema,
    });

    if (!dated || !("fittingLessons" in dated)) {
      throw new Error("Expected deadline estimate");
    }

    expect(dated.fittingLessons).toBeLessThan(26);
    expect(dated.areas.reduce((sum, area) => sum + area.total, 0)).toBe(26);
    expect(dated.publishedContent).toEqual(estimate.publishedContent);
    expect(dated.numbers.context.targetDate).toBe(date);
    expect(dated.numbers.workload).toEqual(dated.workload);

    expect(dated.numbers.beforeDeadlineMinutes! + dated.numbers.afterDeadlineMinutes!).toBeCloseTo(
      dated.numbers.scheduledMinutes,
    );

    expect(dated.numbers.availableBeforeDeadlineMinutes).toBeGreaterThan(0);

    expect(dated.numbers.coverage).toMatchObject({
      basis: "selected",
      scope: "selectedCurriculum",
    });

    expect(
      dated.areas.every((area) => area.plannedMinutes >= 0 && area.unwrittenMinutes >= 0),
    ).toBe(true);

    expect(dated.areas.every((area) => Number.isInteger(area.quickLessons))).toBe(true);

    expect(dated.chapters.reduce((sum, chapter) => sum + chapter.lessonsInPlan, 0)).toBe(
      dated.fittingLessons,
    );

    const { max } = getTargetDateBounds(new Date().toISOString().slice(0, 10));

    const afterMax = new Date(Date.parse(`${max}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);

    const invalidDate = await anonymous.get(
      `/v1/courses/${course.id}/estimate?${query}&targetDate=${afterMax}`,
    );

    expect(invalidDate.status()).toBe(400);
    expect(await invalidDate.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
    await anonymous.dispose();
  });

  test("returns null for private, unpublished and outline-free courses and rejects invalid pace", async () => {
    const [anonymous, owner] = await Promise.all([request.newContext({ baseURL }), userFixture()]);

    const courses = await Promise.all([
      courseFixture({ isPublished: true }),
      courseFixture({ isPublished: false }),
      courseFixture({ isPublished: true, userId: owner.id, visibility: "private" }),
    ]);

    await Promise.all(
      courses.map(async (course) => {
        await readBody({
          response: await anonymous.get(
            `/v1/courses/${course.id}/estimate?dailyMinutes=30&studyDays=1,2,3`,
          ),
          schema: courseEstimateResponseSchema,
        }).then((result) => expect(result).toBeNull());
      }),
    );

    const course = courses[0]!;

    await Promise.all(
      [
        "dailyMinutes=4&studyDays=1",
        "dailyMinutes=30&studyDays=1,1",
        "dailyMinutes=30&studyDays=7",
        "dailyMinutes=30&studyDays=1&targetDate=not-a-date",
      ].map(async (query) => {
        const response = await anonymous.get(`/v1/courses/${course.id}/estimate?${query}`);
        expect(response.status()).toBe(400);
      }),
    );

    await anonymous.dispose();
  });

  test("course starts keep a supplied date or an explicit no-date answer", async () => {
    await Promise.all(
      ["2027-03-01", null].map(async (targetDate) => {
        const [{ apiContext }, { course }] = await Promise.all([
          createAuthenticatedApiContext({ baseURL, prefix: "course-date" }),
          createOutlinedCourse(),
        ]);

        const goal = await readBody({
          response: await apiContext.post(`/v1/courses/${course.id}/goals`, {
            data: { level: "basic", targetDate, timeZone: "UTC" },
          }),
          schema: goalSchema,
          status: 201,
        });

        expect(goal.targetDate).toBe(targetDate);
        expect(goal.details.answered).toContain("targetDate");
        await apiContext.dispose();
      }),
    );
  });

  test("an unnamed whole-exam course defaults to its date and estimates the stored subject graph", async () => {
    const [{ apiContext }, { course, chapters }, subjectCourse, unwritten] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "exam-course-date" }),
      createOutlinedCourse(),
      courseFixture({ isPublished: true, visibility: "public" }),
      skillFixture(),
    ]);

    await prisma.course.update({ data: { format: "exam" }, where: { id: course.id } });

    const date = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);

    const blueprint = await examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          {
            citation: { passage: "Exam day", sourceId: "notice" },
            date,
            kind: "exam",
            label: "Exam",
          },
        ],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        year: Number(date.slice(0, 4)),
      },
    });

    const rows = await prisma.lessonSkill.findMany({
      include: { lesson: { include: { chapters: true } }, skill: true },
      where: {
        lesson: {
          chapters: { some: { chapterId: { in: chapters.map((chapter) => chapter.id) } } },
        },
      },
    });

    await itemFixture({ examBlueprintId: blueprint.id, skillId: rows[0]!.skillId });

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: {
          phases: [{ milestone: null, name: "Ready" }],
          skills: [
            ...rows.map((row) => ({
              area: row.lesson.chapters.some((entry) => entry.chapterId === chapters[0]?.id)
                ? "Math"
                : "Science",
              courseIds: [subjectCourse.id],
              lessons: 1,
              name: row.skill.name,
              phase: 0,
              skillId: row.skillId,
              weight: 1,
            })),
            {
              area: "Math",
              courseIds: [subjectCourse.id],
              lessons: 2,
              name: unwritten.name,
              phase: 0,
              skillId: unwritten.id,
              weight: 1,
            },
          ],
        },
        model: "fixture",
        primaryCourseId: subjectCourse.id,
        promptVersion: "fixture",
        runId: "fixture",
      },
    });

    const goal = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, {
        data: { level: "basic", timeZone: "UTC" },
      }),
      schema: goalSchema,
      status: 201,
    });

    expect(goal).toMatchObject({ examBlueprintId: blueprint.id, kind: "exam", targetDate: date });

    const onboarding = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/onboarding`),
      schema: onboardingResponseSchema,
    });

    expect(onboarding.steps).toContain("targetDate");
    expect(onboarding.goal.targetDate).toBe(date);

    const undated = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/onboarding/answers`, {
        data: { question: "targetDate", targetDate: null },
      }),
      schema: onboardingResponseSchema,
    });

    expect(undated.goal.targetDate).toBeNull();
    expect(undated.steps).not.toContain("targetDate");

    const estimate = await readBody({
      response: await apiContext.get(
        `/v1/courses/${course.id}/estimate?dailyMinutes=30&studyDays=1,2,3,4,5&targetDate=${date}`,
      ),
      schema: courseEstimateResponseSchema,
    });

    if (!estimate || !("areas" in estimate)) {
      throw new Error("Expected exam estimate");
    }

    expect(estimate.areas.map((area) => area.area)).toEqual(["Math", "Science"]);
    expect(estimate.areas.every((area) => area.plannedMinutes > 0)).toBe(true);
    await apiContext.dispose();
  });

  test("needs a session", async () => {
    const [anonymous, { course }] = await Promise.all([
      request.newContext({ baseURL }),
      createOutlinedCourse(),
    ]);

    const response = await anonymous.post(`/v1/courses/${course.id}/goals`, { data: {} });

    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });

  test("starts a course as a goal with its plan, and gives the same goal back after", async () => {
    const [{ apiContext, user }, { course }] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "course-goal" }),
      createOutlinedCourse({ everyBand: true }),
    ]);

    const created = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, {
        data: { dailyMinutes: 20, timeZone: "America/Sao_Paulo" },
      }),
      schema: goalSchema,
      status: 201,
    });

    expect(created).toMatchObject({
      dailyMinutes: 20,
      details: { courseStart: { chapterId: null } },
      kind: "learn",
      plan: { phaseCount: 3, ready: true },
      primaryCourseId: course.id,
      title: course.title,
    });

    // Its beginner chapters' four lessons and one in each later band.
    await expect(countPlanLessons(created.id)).resolves.toBe(6);

    const again = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, { data: {} }),
      schema: goalSchema,
    });

    expect(again.id).toBe(created.id);
    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
    await apiContext.dispose();
  });

  // A course one goal outlined only in part (its beginner band) would give the next learner a plan
  // without the levels the first one skipped: the goal's run plans it from its own graph.
  test("leaves a later learner's plan to the goal's run while the course misses a band", async () => {
    const [{ apiContext }, { course }] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "course-goal-partial" }),
      createOutlinedCourse(),
    ]);

    const created = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, { data: {} }),
      schema: goalSchema,
      status: 201,
    });

    expect(created).toMatchObject({ plan: { ready: false }, primaryCourseId: course.id });
    await expect(countPlanLessons(created.id)).resolves.toBe(0);
    await apiContext.dispose();
  });

  test("starts the plan at a chapter of the course", async () => {
    const [{ apiContext }, { chapters, course }, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "course-chapter" }),
      createOutlinedCourse(),
      createOutlinedCourse(),
    ]);

    const [, second] = chapters;

    const foreign = await apiContext.post(`/v1/courses/${course.id}/goals`, {
      data: { chapterId: other.chapters[0]?.id },
    });

    expect(foreign.status()).toBe(404);

    const started = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, {
        data: { chapterId: second?.id },
      }),
      schema: goalSchema,
      status: 201,
    });

    expect(started.details).toStrictEqual({ courseStart: { chapterId: second?.id } });
    await expect(countPlanLessons(started.id)).resolves.toBe(2);
    await apiContext.dispose();
  });

  test("hides courses the learner can't start and keeps the goal limits", async () => {
    const [{ apiContext, user }, { course }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "course-limits" }),
      createOutlinedCourse(),
      userFixture(),
    ]);

    const [privateCourse, publishedPrivateCourse] = await Promise.all([
      courseFixture({ userId: owner.id, visibility: "private" }),
      courseFixture({ isPublished: true, userId: owner.id, visibility: "private" }),
    ]);

    const [hidden, publishedHidden, unknown, invalid] = await Promise.all([
      apiContext.post(`/v1/courses/${privateCourse.id}/goals`, { data: {} }),
      apiContext.post(`/v1/courses/${publishedPrivateCourse.id}/goals`, {
        data: { level: "basic" },
      }),
      apiContext.post(`/v1/courses/${randomUUID()}/goals`, { data: {} }),
      apiContext.post(`/v1/courses/${course.id}/goals`, { data: { dailyMinutes: 1 } }),
    ]);

    expect([
      hidden.status(),
      publishedHidden.status(),
      unknown.status(),
      invalid.status(),
    ]).toStrictEqual([404, 404, 404, 400]);

    const unknownBody = await unknown.json();
    await expect(hidden.json()).resolves.toStrictEqual(unknownBody);
    await expect(publishedHidden.json()).resolves.toStrictEqual(unknownBody);
    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.plan.count({ where: { goal: { userId: user.id } } })).resolves.toBe(0);

    // The free plan follows one goal at a time.
    await goalFixture({ userId: user.id });

    const refused = await apiContext.post(`/v1/courses/${course.id}/goals`, { data: {} });

    expect(refused.status()).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: "GOAL_LIMIT_REACHED" } });
    await apiContext.dispose();
  });
});
