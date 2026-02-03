import { randomUUID } from "node:crypto";
import { generateLessonActivities } from "@zoonk/ai/tasks/lessons/activities";
import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { lessonGenerationWorkflow } from "./lesson-generation-workflow";

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

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({
  generateLessonKind: vi.fn().mockResolvedValue({
    data: { kind: "core" },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/activities", () => ({
  generateLessonActivities: vi.fn().mockResolvedValue({
    data: {
      activities: [
        { description: "Custom activity 1 description", title: "Custom Activity 1" },
        { description: "Custom activity 2 description", title: "Custom Activity 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/core/cache/revalidate", () => ({
  revalidateMainApp: vi.fn().mockResolvedValue(null),
}));

describe(lessonGenerationWorkflow, () => {
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
    test("returns early when generationStatus is 'running'", async () => {
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "running",
        organizationId,
        title: `Running Lesson ${randomUUID()}`,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("running");
      expect(generateLessonKind).not.toHaveBeenCalled();
    });

    test("returns early when generationStatus is 'completed' and has activities", async () => {
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        organizationId,
        title: `Completed Lesson ${randomUUID()}`,
      });

      await activityFixture({
        lessonId: lesson.id,
        organizationId,
        title: `Existing Activity ${randomUUID()}`,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("completed");
      expect(generateLessonKind).not.toHaveBeenCalled();
    });

    test("sets as completed and returns when lesson has existing activities but status not completed", async () => {
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title: `Lesson with Activities ${randomUUID()}`,
      });

      await activityFixture({
        lessonId: lesson.id,
        organizationId,
        title: `Existing Activity ${randomUUID()}`,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("completed");
      expect(dbLesson?.generationRunId).toBe("test-run-id");
      expect(generateLessonKind).not.toHaveBeenCalled();
    });
  });

  describe("core lesson flow", () => {
    test("generates 8 fixed activities for core lesson", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "core" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const title = `Core Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("completed");
      expect(dbLesson?.kind).toBe("core");

      const activities = await prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: lesson.id },
      });

      expect(activities).toHaveLength(8);
      expect(activities.map((a) => a.kind)).toEqual([
        "background",
        "explanation",
        "quiz",
        "mechanics",
        "examples",
        "story",
        "challenge",
        "review",
      ]);

      for (const activity of activities) {
        expect(activity.generationStatus).toBe("pending");
        expect(activity.isPublished).toBeTruthy();
        expect(activity.title).toBeNull();
        expect(activity.description).toBeNull();
      }

      expect(generateLessonActivities).not.toHaveBeenCalled();
    });
  });

  describe("language lesson flow", () => {
    test("generates 5 fixed activities for language lesson", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "language" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const title = `Language Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("completed");
      expect(dbLesson?.kind).toBe("language");

      const activities = await prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: lesson.id },
      });

      expect(activities).toHaveLength(5);
      expect(activities.map((a) => a.kind)).toEqual([
        "vocabulary",
        "grammar",
        "reading",
        "listening",
        "review",
      ]);

      for (const activity of activities) {
        expect(activity.generationStatus).toBe("pending");
        expect(activity.isPublished).toBeTruthy();
        expect(activity.title).toBeNull();
        expect(activity.description).toBeNull();
      }

      expect(generateLessonActivities).not.toHaveBeenCalled();
    });
  });

  describe("custom lesson flow", () => {
    test("generates AI-generated activities for custom lesson", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "custom" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      vi.mocked(generateLessonActivities).mockResolvedValueOnce({
        data: {
          activities: [
            { description: "First custom activity", title: "Custom 1" },
            { description: "Second custom activity", title: "Custom 2" },
            { description: "Third custom activity", title: "Custom 3" },
          ],
        },
      } as Awaited<ReturnType<typeof generateLessonActivities>>);

      const title = `Custom Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await lessonGenerationWorkflow(lesson.id);

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("completed");
      expect(dbLesson?.kind).toBe("custom");

      const activities = await prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: lesson.id },
      });

      expect(activities).toHaveLength(3);
      expect(activities[0]?.kind).toBe("custom");
      expect(activities[0]?.title).toBe("Custom 1");
      expect(activities[0]?.description).toBe("First custom activity");
      expect(activities[1]?.title).toBe("Custom 2");
      expect(activities[2]?.title).toBe("Custom 3");

      for (const activity of activities) {
        expect(activity.generationStatus).toBe("pending");
        expect(activity.isPublished).toBeTruthy();
      }

      expect(generateLessonActivities).toHaveBeenCalledOnce();
    });
  });

  describe("error handling", () => {
    test("marks lesson as 'failed' when AI generation throws", async () => {
      vi.mocked(generateLessonKind).mockRejectedValueOnce(new Error("AI generation failed"));

      const title = `Error Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(lessonGenerationWorkflow(lesson.id)).rejects.toThrow("AI generation failed");

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("failed");
    });

    test("throws FatalError when lesson not found", async () => {
      const nonExistentId = 999_999_999;

      await expect(lessonGenerationWorkflow(nonExistentId)).rejects.toThrow("Lesson not found");
    });
  });

  describe("status transitions", () => {
    test("updates lesson status: pending → running → completed", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "core" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const title = `Status Transition Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      const initialLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });
      expect(initialLesson?.generationStatus).toBe("pending");

      await lessonGenerationWorkflow(lesson.id);

      const finalLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });
      expect(finalLesson?.generationStatus).toBe("completed");
      expect(finalLesson?.generationRunId).toBe("test-run-id");
    });
  });
});
