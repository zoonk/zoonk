import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { getRejectedAggregateError } from "@/workflows/_test-utils/rejected-error";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handleChapterFailureStep, handleCourseFailureStep } from "./handle-failure-step";

describe(handleCourseFailureStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks both course and request as failed when courseId is provided", async () => {
    const [course, request] = await Promise.all([
      courseFixture({
        generationRunId: "old-run",
        generationStatus: "running",
        organizationId,
        title: `Fail Course ${randomUUID()}`,
      }),
      courseStartRequestFixture({
        canonicalTitle: `Fail Request ${randomUUID()}`,
        generationRunId: "old-run",
        generationStatus: "running",
      }),
    ]);

    await handleCourseFailureStep({ courseId: course.id, courseStartRequestId: request.id });

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseStartRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("failed");
    expect(updatedCourse.generationRunId).toBeNull();
    expect(updatedRequest.generationStatus).toBe("failed");
    expect(updatedRequest.generationRunId).toBeNull();

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "workflowError" }),
    );
  });

  it("marks linked running requests as failed when the course run fails", async () => {
    const course = await courseFixture({
      generationRunId: "old-run",
      generationStatus: "running",
      organizationId,
      title: `Linked Fail Course ${randomUUID()}`,
    });

    const [primaryRequest, linkedRequest] = await Promise.all([
      courseStartRequestFixture({
        canonicalTitle: `Primary Fail Request ${randomUUID()}`,
        courseId: course.id,
        generationRunId: "old-run",
        generationStatus: "running",
      }),
      courseStartRequestFixture({
        canonicalTitle: `Linked Fail Request ${randomUUID()}`,
        courseId: course.id,
        generationRunId: "other-run",
        generationStatus: "running",
      }),
    ]);

    await handleCourseFailureStep({ courseId: course.id, courseStartRequestId: primaryRequest.id });

    const updatedLinkedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
      where: { id: linkedRequest.id },
    });

    expect(updatedLinkedRequest.generationStatus).toBe("failed");
    expect(updatedLinkedRequest.generationRunId).toBeNull();
  });

  it("throws all status update failures", async () => {
    const promise = handleCourseFailureStep({
      courseId: randomUUID(),
      courseStartRequestId: randomUUID(),
    });

    const error = await getRejectedAggregateError(promise);

    expect(error.errors).toHaveLength(2);
  });

  it("marks only request as failed when courseId is null", async () => {
    const request = await courseStartRequestFixture({
      canonicalTitle: `No Course Fail ${randomUUID()}`,
      generationRunId: "old-run",
      generationStatus: "running",
    });

    await handleCourseFailureStep({ courseId: null, courseStartRequestId: request.id });

    const updatedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(updatedRequest.generationStatus).toBe("failed");
    expect(updatedRequest.generationRunId).toBeNull();
  });
});

describe(handleChapterFailureStep, () => {
  let organizationId: string;
  let courseId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    courseId = course.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks chapter as failed and clears run ID", async () => {
    const chapter = await chapterFixture({
      courseId,
      generationRunId: "old-run",
      generationStatus: "running",
      organizationId,
      title: `Fail Chapter ${randomUUID()}`,
    });

    await handleChapterFailureStep({ chapterId: chapter.id });

    const updated = await prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } });

    expect(updated.generationStatus).toBe("failed");
    expect(updated.generationRunId).toBeNull();

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "workflowError" }),
    );
  });
});
