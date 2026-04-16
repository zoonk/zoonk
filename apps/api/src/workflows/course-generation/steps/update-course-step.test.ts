import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type CourseContext } from "./initialize-course-step";
import { updateCourseStep } from "./update-course-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(updateCourseStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when course does not exist", async () => {
    const brokenContext: CourseContext = {
      courseId: 999_999_999,
      courseSlug: "broken",
      courseTitle: "Broken",
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await expect(
      updateCourseStep({
        course: brokenContext,
        description: "desc",
        imageUrl: null,
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "updateCourse" }),
    );
  });

  test("updates course description, image, and generation status", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Update Course ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await updateCourseStep({
      course: courseContext,
      description: "Updated description",
      imageUrl: "https://example.com/image.webp",
    });

    const updated = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(updated.description).toBe("Updated description");
    expect(updated.imageUrl).toBe("https://example.com/image.webp");
    expect(updated.generationStatus).toBe("completed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "updateCourse" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "updateCourse" }),
    );
  });

  test("does not update imageUrl when it is null", async () => {
    const course = await courseFixture({
      imageUrl: "https://example.com/existing.webp",
      organizationId,
      title: `Update No Image ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await updateCourseStep({
      course: courseContext,
      description: "Updated description",
      imageUrl: null,
    });

    const updated = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(updated.description).toBe("Updated description");
    expect(updated.imageUrl).toBe("https://example.com/existing.webp");
  });
});
