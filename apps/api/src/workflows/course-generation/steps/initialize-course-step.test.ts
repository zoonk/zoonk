import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { generatableCourseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeCourseStep } from "./initialize-course-step";

describe(initializeCourseStep, () => {
  beforeAll(async () => {
    await aiOrganizationFixture();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws without streaming error when request update fails", async () => {
    const request = await generatableCourseStartRequestFixture({
      canonicalTitle: `Missing Request ${randomUUID()}`,
    });

    const fakeRequest = { ...request, canonicalTitle: "Nonexistent", id: randomUUID() };

    await expect(
      initializeCourseStep({ request: fakeRequest, workflowRunId: "run-id" }),
    ).rejects.toThrow();

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "initializeCourse" }),
    );
  });

  it("creates a course and marks request as running", async () => {
    const request = await generatableCourseStartRequestFixture({
      canonicalTitle: `Init Course ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    const result = await initializeCourseStep({ request, workflowRunId });

    expect(result.course.courseTitle).toBe(request.canonicalTitle);
    expect(result.course.language).toBe(request.language);
    expect(result.course.courseId).toStrictEqual(expect.any(String));
    expect(result.existing).toBeNull();
    expect(result.generationStatus).toBe("running");

    const [updatedRequest, createdCourse] = await Promise.all([
      prisma.courseStartRequest.findUniqueOrThrow({ where: { id: request.id } }),
      prisma.course.findUniqueOrThrow({ where: { id: result.course.courseId } }),
    ]);

    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(workflowRunId);
    expect(updatedRequest.courseId).toBe(result.course.courseId);
    expect(createdCourse.generationStatus).toBe("running");
    expect(createdCourse.isPublished).toBe(true);
    expect(createdCourse.title).toBe(request.canonicalTitle);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "initializeCourse" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "initializeCourse" }),
    );
  });

  it("sets targetLanguage on course when request has one", async () => {
    const request = await generatableCourseStartRequestFixture({
      canonicalTitle: `Language Course ${randomUUID()}`,
      targetLanguage: "es",
    });

    const result = await initializeCourseStep({ request, workflowRunId: `run-${randomUUID()}` });

    expect(result.course.targetLanguage).toBe("es");

    const course = await prisma.course.findUniqueOrThrow({ where: { id: result.course.courseId } });

    expect(course.targetLanguage).toBe("es");
  });
});
