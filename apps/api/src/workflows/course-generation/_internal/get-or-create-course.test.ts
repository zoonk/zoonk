import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type ExistingCourse } from "../steps/resolve-course-identity-step";
import { getCourseSlugForTitle } from "./course-slug";
import { getOrCreateCourse } from "./get-or-create-course";

describe(getOrCreateCourse, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new course when no existing course is found", async () => {
    const suggestion = await courseSuggestionFixture({ title: `New Course ${randomUUID()}` });

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(null, suggestion, suggestion.id, workflowRunId);

    expect(result.status).toBe("ready");
    expect(result.course.courseTitle).toBe(suggestion.title);
    expect(result.course.courseId).toStrictEqual(expect.any(String));

    expect(result.existing).toStrictEqual({
      description: null,
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
    });

    const createdCourse = await prisma.course.findUniqueOrThrow({
      where: { id: result.course.courseId },
    });

    const updatedSuggestion = await prisma.courseSuggestion.findUniqueOrThrow({
      where: { id: suggestion.id },
    });

    expect(createdCourse.generationStatus).toBe("running");
    expect(updatedSuggestion.courseId).toBe(createdCourse.id);
  });

  it("returns the running course when creation loses an org slug race", async () => {
    const title = `Concurrent Course ${randomUUID()}`;
    const language = "en";
    const slug = getCourseSlugForTitle({ language, title });

    const existingCourse = await courseFixture({
      generationStatus: "running",
      language,
      organizationId,
      slug,
      title,
    });

    const suggestion = await courseSuggestionFixture({ language, title });
    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(null, suggestion, suggestion.id, workflowRunId);

    expect(result.status).toBe("running");
    expect(result.course.courseId).toBe(existingCourse.id);

    const [courses, updatedSuggestion] = await Promise.all([
      prisma.course.findMany({ where: { organizationId, slug } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(courses).toHaveLength(1);
    expect(updatedSuggestion.courseId).toBe(existingCourse.id);
    expect(updatedSuggestion.generationStatus).toBe("running");
    expect(updatedSuggestion.generationRunId).toBe(workflowRunId);
  });

  it("reuses existing course and marks it as running", async () => {
    const course = await courseFixture({
      description: "Existing description",
      generationStatus: "failed",
      imageUrl: "https://example.com/img.webp",
      organizationId,
      title: `Existing Course ${randomUUID()}`,
    });

    const suggestion = await courseSuggestionFixture({ title: course.title });

    const existingCourse: ExistingCourse = { ...course, _count: { categories: 1, chapters: 3 } };

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(
      existingCourse,
      suggestion,
      suggestion.id,
      workflowRunId,
    );

    expect(result.status).toBe("ready");
    expect(result.course.courseId).toBe(course.id);

    expect(result.existing).toStrictEqual({
      description: "Existing description",
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/img.webp",
    });

    const [updatedCourse, updatedSuggestion] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedSuggestion.courseId).toBe(course.id);
    expect(updatedSuggestion.generationStatus).toBe("running");
    expect(updatedSuggestion.generationRunId).toBe(workflowRunId);
  });
});
