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

// Store for hook data to simulate workflow coordination
const hookStore = new Map<string, { steps: { text: string; title: string }[] }>();

vi.mock("workflow", () => ({
  defineHook: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockImplementation(({ token }: { token: string }) => {
      let checkInterval: ReturnType<typeof setInterval>;
      return new Promise((resolve) => {
        // Timeout after 1 second to prevent hanging tests
        const timeoutId = setTimeout(() => {
          clearInterval(checkInterval);
          resolve({ steps: [] });
        }, 1000);
        checkInterval = setInterval(() => {
          const data = hookStore.get(token);
          if (data) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            resolve(data);
          }
        }, 10);
      });
    }),
    resume: vi.fn().mockImplementation((token: string, data: unknown) => {
      hookStore.set(token, data as { steps: { text: string; title: string }[] });
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
    hookStore.clear();
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
        content: { text: "No hook step", title: "No Hook" },
        position: 0,
      });

      const activities = await getLessonActivities(testLesson.id);

      await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      // Hook store should remain empty since hook was not used
      expect(hookStore.size).toBe(0);
    });
  });

  describe("dependency not ready (hook path)", () => {
    test("creates hook and waits when dependency not completed", async () => {
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

      // Simulate background workflow completing after a delay
      const expectedSteps = [
        { text: "Async step 1", title: "Async Title 1" },
        { text: "Async step 2", title: "Async Title 2" },
      ];

      setTimeout(() => {
        hookStore.set(`activity:content:background:${testLesson.id}`, {
          steps: expectedSteps,
        });
      }, 50);

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

      // Pre-populate hook store (simulating hook.resume was called)
      hookStore.set(`activity:content:background:${testLesson.id}`, {
        steps: resumedSteps,
      });

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

      // Should wait for hook since steps count is 0 (edge case)
      // Simulate hook resume with empty steps
      setTimeout(() => {
        hookStore.set(`activity:content:background:${testLesson.id}`, {
          steps: [],
        });
      }, 50);

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual([]);
    });

    test("handles failed dependency by waiting for hook", async () => {
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

      // Failed activity waits for hook (in case it's retried)
      setTimeout(() => {
        hookStore.set(`activity:content:background:${testLesson.id}`, {
          steps: [{ text: "Retried content", title: "Retried" }],
        });
      }, 50);

      const result = await getDependencyContentStep({
        activities,
        dependencyKind: "background",
        lessonId: testLesson.id,
      });

      expect(result).toEqual([{ text: "Retried content", title: "Retried" }]);
    });
  });
});
