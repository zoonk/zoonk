import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { getRejectedAggregateError } from "@/workflows/_test-utils/rejected-error";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
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

  it("marks both course and suggestion as failed when courseId is provided", async () => {
    const [course, suggestion] = await Promise.all([
      courseFixture({
        generationRunId: "old-run",
        generationStatus: "running",
        organizationId,
        title: `Fail Course ${randomUUID()}`,
      }),
      courseSuggestionFixture({
        generationRunId: "old-run",
        generationStatus: "running",
        title: `Fail Suggestion ${randomUUID()}`,
      }),
    ]);

    await handleCourseFailureStep({ courseId: course.id, courseSuggestionId: suggestion.id });

    const [updatedCourse, updatedSuggestion] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("failed");
    expect(updatedCourse.generationRunId).toBeNull();
    expect(updatedSuggestion.generationStatus).toBe("failed");
    expect(updatedSuggestion.generationRunId).toBeNull();

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "workflowError" }),
    );
  });

  it("marks linked running suggestions as failed when the course run fails", async () => {
    const course = await courseFixture({
      generationRunId: "old-run",
      generationStatus: "running",
      organizationId,
      title: `Linked Fail Course ${randomUUID()}`,
    });

    const [primarySuggestion, linkedSuggestion] = await Promise.all([
      courseSuggestionFixture({
        courseId: course.id,
        generationRunId: "old-run",
        generationStatus: "running",
        title: `Primary Fail Suggestion ${randomUUID()}`,
      }),
      courseSuggestionFixture({
        courseId: course.id,
        generationRunId: "other-run",
        generationStatus: "running",
        title: `Linked Fail Suggestion ${randomUUID()}`,
      }),
    ]);

    await handleCourseFailureStep({
      courseId: course.id,
      courseSuggestionId: primarySuggestion.id,
    });

    const updatedLinkedSuggestion = await prisma.courseSuggestion.findUniqueOrThrow({
      where: { id: linkedSuggestion.id },
    });

    expect(updatedLinkedSuggestion.generationStatus).toBe("failed");
    expect(updatedLinkedSuggestion.generationRunId).toBeNull();
  });

  it("throws all status update failures", async () => {
    const promise = handleCourseFailureStep({
      courseId: randomUUID(),
      courseSuggestionId: randomUUID(),
    });

    const error = await getRejectedAggregateError(promise);

    expect(error.errors).toHaveLength(2);
  });

  it("marks only suggestion as failed when courseId is null", async () => {
    const suggestion = await courseSuggestionFixture({
      generationRunId: "old-run",
      generationStatus: "running",
      title: `No Course Fail ${randomUUID()}`,
    });

    await handleCourseFailureStep({ courseId: null, courseSuggestionId: suggestion.id });

    const updatedSuggestion = await prisma.courseSuggestion.findUniqueOrThrow({
      where: { id: suggestion.id },
    });

    expect(updatedSuggestion.generationStatus).toBe("failed");
    expect(updatedSuggestion.generationRunId).toBeNull();
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
