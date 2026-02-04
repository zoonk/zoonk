import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateStepVisuals } from "@zoonk/ai/tasks/steps/visual";
import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/background", () => ({
  generateActivityBackground: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Step 1 text content", title: "Step 1" },
        { text: "Step 2 text content", title: "Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/visual", () => ({
  generateStepVisuals: vi.fn().mockResolvedValue({
    data: {
      visuals: [
        { kind: "image", prompt: "A visual prompt for step 1", stepIndex: 0 },
        { code: "const x = 1;", kind: "code", language: "typescript", stepIndex: 1 },
      ],
    },
  }),
}));

vi.mock("@zoonk/core/steps/visual-image", () => ({
  generateVisualStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/image.webp",
    error: null,
  }),
}));

vi.mock("@zoonk/core/cache/revalidate", () => ({
  revalidateMainApp: vi.fn().mockResolvedValue(null),
}));

describe(activityGenerationWorkflow, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Test Chapter ${randomUUID()}`,
    });
    lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Test Lesson ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("early returns", () => {
    test("returns early when generationStatus is 'running'", async () => {
      const activity = await activityFixture({
        generationStatus: "running",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title: `Running Activity ${randomUUID()}`,
      });

      await activityGenerationWorkflow(activity.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("running");
      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("returns early when generationStatus is 'completed' and has steps", async () => {
      const activity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title: `Completed Activity ${randomUUID()}`,
      });

      await stepFixture({
        activityId: activity.id,
        content: { text: "Existing step text", title: "Existing Step" },
      });

      await activityGenerationWorkflow(activity.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("completed");
      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("returns early when activity kind is not 'background'", async () => {
      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: lesson.id,
        organizationId,
        title: `Non-Background Activity ${randomUUID()}`,
      });

      await activityGenerationWorkflow(activity.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("pending");
      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("sets as completed and returns when activity has existing steps but status not completed", async () => {
      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title: `Activity with Steps ${randomUUID()}`,
      });

      await stepFixture({
        activityId: activity.id,
        content: { text: "Existing step text", title: "Existing Step" },
      });

      await activityGenerationWorkflow(activity.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("completed");
      expect(dbActivity?.generationRunId).toBe("test-run-id");
      expect(generateActivityBackground).not.toHaveBeenCalled();
    });
  });

  describe("background activity flow", () => {
    test("generates steps with visuals for background activity", async () => {
      const title = `Background Activity ${randomUUID()}`;
      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title,
      });

      await activityGenerationWorkflow(activity.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("completed");

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      });

      expect(steps).toHaveLength(2);
      expect(steps[0]?.kind).toBe("static");
      expect(steps[0]?.content).toEqual({ text: "Step 1 text content", title: "Step 1" });
      expect(steps[0]?.visualKind).toBe("image");
      expect(steps[0]?.visualContent).toEqual({
        prompt: "A visual prompt for step 1",
        url: "https://example.com/image.webp",
      });

      expect(steps[1]?.kind).toBe("static");
      expect(steps[1]?.content).toEqual({ text: "Step 2 text content", title: "Step 2" });
      expect(steps[1]?.visualKind).toBe("code");
      expect(steps[1]?.visualContent).toEqual({
        code: "const x = 1;",
        language: "typescript",
      });

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateStepVisuals).toHaveBeenCalledOnce();
      expect(generateVisualStepImage).toHaveBeenCalledOnce();
    });

    test("creates steps in database with correct content and visual mapping", async () => {
      vi.mocked(generateStepVisuals).mockResolvedValueOnce({
        data: {
          visuals: [
            {
              edges: [{ source: "1", target: "2" }],
              kind: "diagram",
              nodes: [
                { id: "1", label: "Node 1" },
                { id: "2", label: "Node 2" },
              ],
              stepIndex: 0,
            },
            { kind: "quote", quote: "A famous quote", source: "Author", stepIndex: 1 },
          ],
        },
      } as Awaited<ReturnType<typeof generateStepVisuals>>);

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title: `Activity with Diagram ${randomUUID()}`,
      });

      await activityGenerationWorkflow(activity.id);

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      });

      expect(steps[0]?.visualKind).toBe("diagram");
      expect(steps[0]?.visualContent).toEqual({
        edges: [{ source: "1", target: "2" }],
        nodes: [
          { id: "1", label: "Node 1" },
          { id: "2", label: "Node 2" },
        ],
      });

      expect(steps[1]?.visualKind).toBe("quote");
      expect(steps[1]?.visualContent).toEqual({
        quote: "A famous quote",
        source: "Author",
      });
    });
  });

  describe("error handling", () => {
    test("marks activity as 'failed' when AI generation throws", async () => {
      vi.mocked(generateActivityBackground).mockRejectedValueOnce(
        new Error("AI generation failed"),
      );

      const title = `Error Activity ${randomUUID()}`;
      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title,
      });

      await expect(activityGenerationWorkflow(activity.id)).rejects.toThrow("AI generation failed");

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("throws FatalError when activity not found", async () => {
      const nonExistentId = BigInt(999_999_999);

      await expect(activityGenerationWorkflow(nonExistentId)).rejects.toThrow("Activity not found");
    });

    test("continues without URL when image generation fails", async () => {
      vi.mocked(generateVisualStepImage).mockResolvedValueOnce({
        data: null,
        error: new Error("Image generation failed"),
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title: `Activity Image Fail ${randomUUID()}`,
      });

      await activityGenerationWorkflow(activity.id);

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });

      expect(dbActivity?.generationStatus).toBe("completed");

      const steps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      });

      expect(steps[0]?.visualKind).toBe("image");
      expect(steps[0]?.visualContent).toEqual({
        prompt: "A visual prompt for step 1",
      });
    });
  });

  describe("status transitions", () => {
    test("updates activity status: pending → running → completed", async () => {
      const title = `Status Transition Activity ${randomUUID()}`;
      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: lesson.id,
        organizationId,
        title,
      });

      const initialActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(initialActivity?.generationStatus).toBe("pending");

      await activityGenerationWorkflow(activity.id);

      const finalActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(finalActivity?.generationStatus).toBe("completed");
      expect(finalActivity?.generationRunId).toBe("test-run-id");
    });
  });
});
