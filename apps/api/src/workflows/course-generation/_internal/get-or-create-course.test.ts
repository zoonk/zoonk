import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type ExistingCourse } from "../steps/check-existing-course-step";
import { getOrCreateCourse } from "./get-or-create-course";

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

describe(getOrCreateCourse, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates a new course when no existing course is found", async () => {
    const suggestion = await courseSuggestionFixture({
      title: `New Course ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(null, suggestion, suggestion.id, workflowRunId);

    expect(result.course.courseTitle).toBe(suggestion.title);
    expect(result.course.courseId).toEqual(expect.any(String));

    expect(result.existing).toEqual({
      description: null,
      hasAlternativeTitles: false,
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
    });

    const createdCourse = await prisma.course.findUniqueOrThrow({
      where: { id: result.course.courseId },
    });

    expect(createdCourse.generationStatus).toBe("running");
  });

  test("reuses existing course and marks it as running", async () => {
    const course = await courseFixture({
      description: "Existing description",
      imageUrl: "https://example.com/img.webp",
      organizationId,
      title: `Existing Course ${randomUUID()}`,
    });

    const suggestion = await courseSuggestionFixture({
      title: course.title,
    });

    const existingCourse: ExistingCourse = {
      ...course,
      _count: { alternativeTitles: 2, categories: 1, chapters: 3 },
    };

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(
      existingCourse,
      suggestion,
      suggestion.id,
      workflowRunId,
    );

    expect(result.course.courseId).toBe(course.id);

    expect(result.existing).toEqual({
      description: "Existing description",
      hasAlternativeTitles: true,
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/img.webp",
    });

    const [updatedCourse, updatedSuggestion] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedSuggestion.generationStatus).toBe("running");
    expect(updatedSuggestion.generationRunId).toBe(workflowRunId);
  });
});
