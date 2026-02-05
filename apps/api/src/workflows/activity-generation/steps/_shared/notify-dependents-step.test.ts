import { randomUUID } from "node:crypto";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { notifyDependentsStep } from "./notify-dependents-step";

// Track hook resume calls
const hookResumeCalls: { token: string; data: unknown }[] = [];

vi.mock("workflow", () => ({
  defineHook: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ steps: [] }),
    resume: vi.fn().mockImplementation((token: string, data: unknown) => {
      hookResumeCalls.push({ data, token });
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

describe(notifyDependentsStep, () => {
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
      title: `Notify Dependents Test Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hookResumeCalls.length = 0;
  });

  describe("steps provided in params", () => {
    test("uses provided steps directly (does not fetch from DB)", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Provided Steps Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background With Provided ${randomUUID()}`,
      });

      // Create different steps in DB (to verify they're NOT fetched)
      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "DB step text", title: "DB Step" },
        position: 0,
      });

      const providedSteps = [
        { text: "Provided step 1 text", title: "Provided Step 1" },
        { text: "Provided step 2 text", title: "Provided Step 2" },
      ];

      await notifyDependentsStep({
        activityId: backgroundActivity.id,
        activityKind: "background",
        lessonId: testLesson.id,
        steps: providedSteps,
      });

      expect(hookResumeCalls).toHaveLength(1);
      expect(hookResumeCalls[0]).toEqual({
        data: {
          activityId: backgroundActivity.id,
          activityKind: "background",
          lessonId: testLesson.id,
          steps: providedSteps,
        },
        token: `activity:content:background:${testLesson.id}`,
      });
    });

    test("calls hook.resume with correct token and payload", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Token Payload Lesson ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "completed",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Explanation Token ${randomUUID()}`,
      });

      const steps = [{ text: "Explanation content", title: "Explanation Title" }];

      await notifyDependentsStep({
        activityId: explanationActivity.id,
        activityKind: "explanation",
        lessonId: testLesson.id,
        steps,
      });

      expect(hookResumeCalls[0]?.token).toBe(`activity:content:explanation:${testLesson.id}`);
      expect(hookResumeCalls[0]?.data).toMatchObject({
        activityId: explanationActivity.id,
        activityKind: "explanation",
        lessonId: testLesson.id,
        steps,
      });
    });
  });

  describe("steps not provided", () => {
    test("fetches steps from DB when not provided in params", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Fetch DB Steps Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background Fetch DB ${randomUUID()}`,
      });

      // Create steps in DB
      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "DB step 1 text", title: "DB Step 1" },
        position: 0,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "DB step 2 text", title: "DB Step 2" },
        position: 1,
      });

      // Call without providing steps
      await notifyDependentsStep({
        activityId: backgroundActivity.id,
        activityKind: "background",
        lessonId: testLesson.id,
      });

      expect(hookResumeCalls).toHaveLength(1);
      expect(hookResumeCalls[0]?.data).toMatchObject({
        steps: [
          { text: "DB step 1 text", title: "DB Step 1" },
          { text: "DB step 2 text", title: "DB Step 2" },
        ],
      });
    });
  });

  describe("no waiting workflows", () => {
    test("completes without error when hook.resume fails", async () => {
      // Override mock to simulate hook not found
      const { defineHook } = await import("workflow");
      vi.mocked(defineHook).mockImplementationOnce(() => ({
        create: vi.fn().mockResolvedValue({ steps: [] }),
        resume: vi.fn().mockRejectedValue(new Error("Hook not found")),
      }));

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `No Waiting Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background No Waiting ${randomUUID()}`,
      });

      // Should not throw - safeAsync handles the error
      await expect(
        notifyDependentsStep({
          activityId: backgroundActivity.id,
          activityKind: "background",
          lessonId: testLesson.id,
          steps: [{ text: "Content", title: "Title" }],
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("empty steps notification", () => {
    test("notifies with empty steps array", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty Notify Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Empty Background ${randomUUID()}`,
      });

      await notifyDependentsStep({
        activityId: backgroundActivity.id,
        activityKind: "background",
        lessonId: testLesson.id,
        steps: [],
      });

      expect(hookResumeCalls).toHaveLength(1);
      expect(hookResumeCalls[0]?.data).toMatchObject({
        steps: [],
      });
    });
  });
});
