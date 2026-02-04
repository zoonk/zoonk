import { randomUUID } from "node:crypto";
import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
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
        { text: "Background step 1 text", title: "Background Step 1" },
        { text: "Background step 2 text", title: "Background Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Explanation step 1 text", title: "Explanation Step 1" },
        { text: "Explanation step 2 text", title: "Explanation Step 2" },
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

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Test Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("early returns", () => {
    test("throws when no activities found for lesson", async () => {
      const emptyLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Empty Lesson ${randomUUID()}`,
      });

      await expect(activityGenerationWorkflow(emptyLesson.id)).rejects.toThrow(
        "No activities found for lesson",
      );
    });

    test("skips background generation when status is 'running'", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Running Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "running",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Running Background ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
    });

    test("reuses existing steps when background is completed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Completed BG Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "completed",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Completed Background ${randomUUID()}`,
      });

      await stepFixture({
        activityId: backgroundActivity.id,
        content: { text: "Existing background text", title: "Existing Background" },
        position: 0,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Pending Explanation ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityExplanation).toHaveBeenCalledOnce();

      const explanationSteps = await prisma.step.findMany({
        where: { activityId: explanationActivity.id },
      });
      expect(explanationSteps).toHaveLength(2);
    });
  });

  describe("background + explanation generation", () => {
    test("generates both background and explanation activities", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Full Gen Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Explanation ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbBackground = await prisma.activity.findUnique({
        where: { id: backgroundActivity.id },
      });
      expect(dbBackground?.generationStatus).toBe("completed");

      const dbExplanation = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(dbExplanation?.generationStatus).toBe("completed");

      const backgroundSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: backgroundActivity.id },
      });
      expect(backgroundSteps).toHaveLength(2);
      expect(backgroundSteps[0]?.content).toEqual({
        text: "Background step 1 text",
        title: "Background Step 1",
      });

      const explanationSteps = await prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: explanationActivity.id },
      });
      expect(explanationSteps).toHaveLength(2);
      expect(explanationSteps[0]?.content).toEqual({
        text: "Explanation step 1 text",
        title: "Explanation Step 1",
      });

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundSteps: [
            { text: "Background step 1 text", title: "Background Step 1" },
            { text: "Background step 2 text", title: "Background Step 2" },
          ],
        }),
      );
      expect(generateStepVisuals).toHaveBeenCalledTimes(2);
    });

    test("generates only background when no explanation activity exists", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `BG Only Lesson ${randomUUID()}`,
      });

      const backgroundActivity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background Only ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      const dbBackground = await prisma.activity.findUnique({
        where: { id: backgroundActivity.id },
      });
      expect(dbBackground?.generationStatus).toBe("completed");

      expect(generateActivityBackground).toHaveBeenCalledOnce();
      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });

    test("creates steps with correct visuals mapping", async () => {
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
            { kind: "quote", quote: "A quote", source: "Author", stepIndex: 1 },
          ],
        },
      } as Awaited<ReturnType<typeof generateStepVisuals>>);

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Visual Mapping Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Visual Mapping ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

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
        quote: "A quote",
        source: "Author",
      });
    });
  });

  describe("error handling", () => {
    test("marks background as 'failed' when AI generation throws", async () => {
      vi.mocked(generateActivityBackground).mockRejectedValueOnce(
        new Error("AI generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Error Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Error Activity ${randomUUID()}`,
      });

      await expect(activityGenerationWorkflow(testLesson.id)).rejects.toThrow(
        "AI generation failed",
      );

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("marks explanation as 'failed' when explanation generation throws", async () => {
      vi.mocked(generateActivityExplanation).mockRejectedValueOnce(
        new Error("Explanation generation failed"),
      );

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Exp Error Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Background ${randomUUID()}`,
      });

      const explanationActivity = await activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        lessonId: testLesson.id,
        organizationId,
        title: `Error Explanation ${randomUUID()}`,
      });

      await expect(activityGenerationWorkflow(testLesson.id)).rejects.toThrow(
        "Explanation generation failed",
      );

      const dbActivity = await prisma.activity.findUnique({
        where: { id: explanationActivity.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });

    test("continues without URL when image generation fails", async () => {
      vi.mocked(generateVisualStepImage).mockResolvedValueOnce({
        data: null,
        error: new Error("Image generation failed"),
      });

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Image Fail Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Image Fail ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

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

    test("marks activity as 'failed' when visual generation throws", async () => {
      vi.mocked(generateStepVisuals).mockRejectedValueOnce(new Error("Visual generation failed"));

      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Visual Error Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Visual Fail ${randomUUID()}`,
      });

      await expect(activityGenerationWorkflow(testLesson.id)).rejects.toThrow(
        "Visual generation failed",
      );

      const dbActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(dbActivity?.generationStatus).toBe("failed");
    });
  });

  describe("status transitions", () => {
    test("updates activity status: pending → running → completed", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Status Transition Lesson ${randomUUID()}`,
      });

      const activity = await activityFixture({
        generationStatus: "pending",
        kind: "background",
        lessonId: testLesson.id,
        organizationId,
        title: `Status Transition ${randomUUID()}`,
      });

      const initialActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(initialActivity?.generationStatus).toBe("pending");

      await activityGenerationWorkflow(testLesson.id);

      const finalActivity = await prisma.activity.findUnique({
        where: { id: activity.id },
      });
      expect(finalActivity?.generationStatus).toBe("completed");
      expect(finalActivity?.generationRunId).toBe("test-run-id");
    });
  });

  describe("skipping non-supported activity kinds", () => {
    test("skips activities that are not background or explanation", async () => {
      const testLesson = await lessonFixture({
        chapterId: chapter.id,
        organizationId,
        title: `Unsupported Kind Lesson ${randomUUID()}`,
      });

      await activityFixture({
        generationStatus: "pending",
        kind: "quiz",
        lessonId: testLesson.id,
        organizationId,
        title: `Quiz Activity ${randomUUID()}`,
      });

      await activityGenerationWorkflow(testLesson.id);

      expect(generateActivityBackground).not.toHaveBeenCalled();
      expect(generateActivityExplanation).not.toHaveBeenCalled();
    });
  });
});
