import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "../get-lesson-activities-step";
import { getDependencyContentStep } from "./get-dependency-content-step";

// Mutable state for hook data - using object wrapper to avoid require-hook lint error
const hookState = {
  data: {} as Record<string, { steps: { text: string; title: string }[] }>,
};

vi.mock("workflow", () => ({
  defineHook: vi.fn().mockImplementation(() => ({
    create: vi
      .fn()
      .mockImplementation(({ token }: { token: string }) =>
        Promise.resolve(hookState.data[token] ?? { steps: [] }),
      ),
    resume: vi.fn().mockImplementation((token: string, data: unknown) => {
      hookState.data[token] = data as { steps: { text: string; title: string }[] };
      return Promise.resolve();
    }),
  })),
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
}));

async function getLessonActivities(lessonId: number): Promise<LessonActivity[]> {
  return prisma.activity.findMany({
    orderBy: { position: "asc" },
    select: {
      _count: { select: { steps: true } },
      generationStatus: true,
      id: true,
      kind: true,
      language: true,
      lesson: {
        select: {
          chapter: {
            select: {
              course: {
                select: {
                  organization: { select: { slug: true } },
                  title: true,
                },
              },
              title: true,
            },
          },
          description: true,
          title: true,
        },
      },
    },
    where: { lessonId },
  });
}

describe(getDependencyContentStep, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Dependency Content Test Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hookState.data = {};
  });

  describe("dependency already completed (DB path)", () => {
    test("returns steps from DB when dependency completed with steps > 0", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `DB Path Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Background ${randomUUID()}`,
      });

      // Create steps in DB
      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Background step 1 text", title: "Background Step 1" },
        position: 0,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Background step 2 text", title: "Background Step 2" },
        position: 1,
      });

      const activities = await getLessonActivities(testLesson.id);

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual([
        { text: "Background step 1 text", title: "Background Step 1" },
        { text: "Background step 2 text", title: "Background Step 2" },
      ]);
    });

    test("does NOT use hook when dependency already completed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Hook Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `No Hook Background ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "DB step content", title: "DB Step" },
        position: 0,
      });

      const activities = await getLessonActivities(testLesson.id);

      // Pre-populate hook with DIFFERENT data - if hook is used, this would be returned
      hookState.data[`activity:content:background:${testLesson.id}`] = {
        steps: [{ text: "Hook step content", title: "Hook Step" }],
      };

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      // Should return DB data, not hook data - proving DB path was taken
      expect(result).toEqual([{ text: "DB step content", title: "DB Step" }]);
    });
  });

  describe("dependency not ready (hook path)", () => {
    test("returns hook data when dependency not completed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Hook Path Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Pending Background ${randomUUID()}`,
      });

      const activities = await getLessonActivities(testLesson.id);

      // Pre-populate hook data (simulating resume was called by another workflow)
      const expectedSteps = [
        { text: "Hook step 1", title: "Hook Title 1" },
        { text: "Hook step 2", title: "Hook Title 2" },
      ];

      hookState.data[`activity:content:background:${testLesson.id}`] = {
        steps: expectedSteps,
      };

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual(expectedSteps);
    });

    test("returns steps when hook is resumed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Resume Hook Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "running",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Running Background ${randomUUID()}`,
      });

      const activities = await getLessonActivities(testLesson.id);

      const resumedSteps = [{ text: "Resumed content", title: "Resumed" }];

      // Pre-populate hook data (simulating hook.resume was called)
      hookState.data[`activity:content:background:${testLesson.id}`] = {
        steps: resumedSteps,
      };

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual(resumedSteps);
    });
  });

  describe("dependency does not exist", () => {
    test("returns empty array when dependency activity not in lesson", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Dependency Lesson ${randomUUID()}`,
      });

      // Only create explanation, no background
      await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Only Explanation ${randomUUID()}`,
      });

      const activities = await getLessonActivities(testLesson.id);

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual([]);
    });

    test("returns empty array for activity with no expected dependencies", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Expected Deps Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background No Deps ${randomUUID()}`,
      });

      const activities = await getLessonActivities(testLesson.id);

      // Background has no dependencies, so asking for a non-existent dependency returns empty
      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "explanation", // Not in activities, not expected dep for background
        lessonId: testLesson.id,
      });

      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    test("returns empty when dependency completed but has 0 steps", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Zero Steps Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Zero Steps Background ${randomUUID()}`,
      });

      // No steps created - activity is "completed" but has 0 steps

      const activities = await getLessonActivities(testLesson.id);

      // Hook returns empty steps (no data available)
      // hookData is empty, so create() returns { steps: [] }

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual([]);
    });

    test("handles failed dependency by returning hook data", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Failed Dependency Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "failed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Failed Background ${randomUUID()}`,
      });

      const activities = await getLessonActivities(testLesson.id);

      // Pre-populate hook data (simulating dependency was retried and completed)
      hookState.data[`activity:content:background:${testLesson.id}`] = {
        steps: [{ text: "Retried content", title: "Retried" }],
      };

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual([{ text: "Retried content", title: "Retried" }]);
    });
  });
});
