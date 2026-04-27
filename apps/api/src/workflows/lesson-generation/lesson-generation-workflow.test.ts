import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateLessonCoreActivities } from "@zoonk/ai/tasks/lessons/core-activities";
import { generateLessonCustomActivities } from "@zoonk/ai/tasks/lessons/custom-activities";
import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { lessonGenerationWorkflow } from "./lesson-generation-workflow";

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({
  generateLessonKind: vi.fn().mockResolvedValue({
    data: { kind: "core" },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/core-activities", () => ({
  generateLessonCoreActivities: vi.fn().mockResolvedValue({
    data: {
      activities: [
        {
          goal: "spot the repeated pattern before turning it into a reusable rule",
          title: "Reading the pattern",
        },
        {
          goal: "turn the pattern into a rule you can apply to new cases",
          title: "Turning it into a rule",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/custom-activities", () => ({
  generateLessonCustomActivities: vi.fn().mockResolvedValue({
    data: {
      activities: [
        { description: "Custom activity 1 description", title: "Custom Activity 1" },
        { description: "Custom activity 2 description", title: "Custom Activity 2" },
      ],
    },
  }),
}));

describe(lessonGenerationWorkflow, () => {
  let organizationId: string;
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

    test("streams completion when generationStatus is 'completed' and has activities", async () => {
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

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === "setLessonAsCompleted" && event.status === "completed",
      );
      expect(completionEvent).toBeDefined();
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
      expect(dbLesson?.generationRunId).toBeNull();
      expect(generateLessonKind).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    test("marks lesson as 'failed' when AI generation throws after retries", async () => {
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
      expect(dbLesson?.generationRunId).toBe("test-run-id");

      const errorEvent = getStreamedEvents().find(
        (event) => event.status === "error" && event.step === "workflowError",
      );
      expect(errorEvent).toBeDefined();
    });

    test("marks lesson as 'failed' when custom activities generation throws", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "custom" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      vi.mocked(generateLessonCustomActivities).mockRejectedValueOnce(
        new Error("Activities generation failed"),
      );

      const title = `Custom Error Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(lessonGenerationWorkflow(lesson.id)).rejects.toThrow(
        "Activities generation failed",
      );

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("failed");
    });

    test("marks lesson as 'failed' when core activities generation throws", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "core" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      vi.mocked(generateLessonCoreActivities).mockRejectedValueOnce(
        new Error("Core activities generation failed"),
      );

      const title = `Core Error Lesson ${randomUUID()}`;
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        organizationId,
        title,
      });

      await expect(lessonGenerationWorkflow(lesson.id)).rejects.toThrow(
        "Core activities generation failed",
      );

      const dbLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
      });

      expect(dbLesson?.generationStatus).toBe("failed");
    });

    test("throws FatalError when lesson not found", async () => {
      const nonExistentId = randomUUID();

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

  describe("lesson kind storage", () => {
    test("updates the stored lesson kind during initial generation", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "custom" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "core",
        organizationId,
        title: `Kind Rewrite Lesson ${randomUUID()}`,
      });

      await lessonGenerationWorkflow(lesson.id);

      const updatedLesson = await prisma.lesson.findUniqueOrThrow({
        where: { id: lesson.id },
      });

      const activities = await prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: lesson.id },
      });

      expect(updatedLesson.kind).toBe("custom");
      expect(activities).toHaveLength(2);
      expect(activities.every((activity) => activity.kind === "custom")).toBe(true);
    });
  });

  describe("filtered lessons", () => {
    test("deletes invalid non-language lessons during initial generation in language courses", async () => {
      vi.mocked(generateLessonKind).mockResolvedValueOnce({
        data: { kind: "core" },
      } as Awaited<ReturnType<typeof generateLessonKind>>);

      const languageCourse = await courseFixture({
        organizationId,
        targetLanguage: "es",
      });

      const languageChapter = await chapterFixture({
        courseId: languageCourse.id,
        organizationId,
        title: `Filtered Language Chapter ${randomUUID()}`,
      });

      const lesson = await lessonFixture({
        chapterId: languageChapter.id,
        generationStatus: "pending",
        organizationId,
        title: `Filtered Language Lesson ${randomUUID()}`,
      });

      const result = await lessonGenerationWorkflow(lesson.id);

      const [deletedLesson, createdActivities] = await Promise.all([
        prisma.lesson.findUnique({ where: { id: lesson.id } }),
        prisma.activity.findMany({ where: { lessonId: lesson.id } }),
      ]);

      expect(result).toBe("filtered");
      expect(deletedLesson).toBeNull();
      expect(createdActivities).toHaveLength(0);
    });
  });
});
