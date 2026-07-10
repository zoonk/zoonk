import { randomUUID } from "node:crypto";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { generatableCoursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertGeneratableCoursePrompt } from "../steps/get-course-prompt-step";
import { type ExistingCourse } from "../steps/resolve-course-identity-step";
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
    const request = await generatableCoursePromptFixture({
      canonicalTitle: `New Course ${randomUUID()}`,
    });

    assertGeneratableCoursePrompt(request);

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse({
      coursePromptId: request.id,
      existingCourse: null,
      prompt: request,
      workflowRunId,
    });

    expect(result.status).toBe("ready");
    expect(result.course.courseTitle).toBe(request.canonicalTitle);
    expect(result.course.courseId).toStrictEqual(expect.any(String));

    expect(result.existing).toStrictEqual({
      chapterCount: 0,
      description: null,
      hasCategories: false,
      hasIntroductionLessons: false,
      hasMainCurriculum: false,
      imageUrl: null,
      landingPage: null,
    });

    const createdCourse = await prisma.course.findUniqueOrThrow({
      where: { id: result.course.courseId },
    });

    const updatedRequest = await prisma.coursePrompt.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(createdCourse.generationStatus).toBe("running");
    expect(updatedRequest.courseId).toBe(createdCourse.id);
  });

  it("returns the running course when creation loses an org slug race", async () => {
    const title = `Concurrent Course ${randomUUID()}`;
    const language = "en";
    const slug = getCourseSlugForTitle({ language, title });

    const winningWorkflowRunId = `winning-run-${randomUUID()}`;

    const existingCourse = await courseFixture({
      generationRunId: winningWorkflowRunId,
      generationStatus: "running",
      language,
      organizationId,
      slug,
      title,
    });

    const request = await generatableCoursePromptFixture({ canonicalTitle: title, language });
    assertGeneratableCoursePrompt(request);
    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse({
      coursePromptId: request.id,
      existingCourse: null,
      prompt: request,
      workflowRunId,
    });

    expect(result.status).toBe("running");
    expect(result.course.courseId).toBe(existingCourse.id);

    const [courses, updatedRequest] = await Promise.all([
      prisma.course.findMany({ where: { organizationId, slug } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(courses).toHaveLength(1);
    expect(updatedRequest.courseId).toBe(existingCourse.id);
    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(winningWorkflowRunId);
  });

  it("continues a running course owned by the same workflow run", async () => {
    const title = `Retried Course ${randomUUID()}`;
    const language = "en";
    const slug = getCourseSlugForTitle({ language, title });
    const workflowRunId = `run-${randomUUID()}`;

    const existingCourse = await courseFixture({
      generationRunId: workflowRunId,
      generationStatus: "running",
      language,
      organizationId,
      slug,
      title,
    });

    const request = await generatableCoursePromptFixture({ canonicalTitle: title, language });
    assertGeneratableCoursePrompt(request);

    const result = await getOrCreateCourse({
      coursePromptId: request.id,
      existingCourse: null,
      prompt: request,
      workflowRunId,
    });

    expect(result.status).toBe("ready");
    expect(result.course.courseId).toBe(existingCourse.id);

    const [courses, updatedRequest] = await Promise.all([
      prisma.course.findMany({ where: { organizationId, slug } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(courses).toHaveLength(1);
    expect(updatedRequest.courseId).toBe(existingCourse.id);
    expect(updatedRequest.generationRunId).toBe(workflowRunId);
  });

  it.each([
    { courseFormat: "core", courseLanguage: "en", courseTargetLanguage: null, mismatch: "format" },
    {
      courseFormat: "language",
      courseLanguage: "pt",
      courseTargetLanguage: "es",
      mismatch: "source language",
    },
    {
      courseFormat: "language",
      courseLanguage: "en",
      courseTargetLanguage: "fr",
      mismatch: "target language",
    },
  ] as const)(
    "rejects a recovered course with a different $mismatch",
    async ({ courseFormat, courseLanguage, courseTargetLanguage }) => {
      const title = `Conflicting Course ${randomUUID()}`;
      const language = "en";
      const slug = getCourseSlugForTitle({ language, title });

      await courseFixture({
        format: courseFormat,
        language: courseLanguage,
        organizationId,
        slug,
        targetLanguage: courseTargetLanguage,
        title,
      });

      const request = await generatableCoursePromptFixture({
        canonicalTitle: title,
        courseFormat: "language",
        language,
        targetLanguage: "es",
      });

      assertGeneratableCoursePrompt(request);

      await expect(
        getOrCreateCourse({
          coursePromptId: request.id,
          existingCourse: null,
          prompt: request,
          workflowRunId: `run-${randomUUID()}`,
        }),
      ).rejects.toThrow("Recovered course does not match the prompt identity");
    },
  );

  it("reuses existing course and marks it as running", async () => {
    const course = await courseFixture({
      description: "Existing description",
      generationStatus: "failed",
      imageUrl: "https://example.com/img.webp",
      organizationId,
      title: `Existing Course ${randomUUID()}`,
    });

    const request = await generatableCoursePromptFixture({ canonicalTitle: course.title });
    assertGeneratableCoursePrompt(request);

    const existingCourse: ExistingCourse = {
      ...course,
      _count: { categories: 1, chapters: 3 },
      chapters: [
        { _count: { lessons: 1 }, position: 0 },
        { _count: { lessons: 0 }, position: 1 },
        { _count: { lessons: 0 }, position: 2 },
      ],
    };

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse({
      coursePromptId: request.id,
      existingCourse,
      prompt: request,
      workflowRunId,
    });

    expect(result.status).toBe("ready");
    expect(result.course.courseId).toBe(course.id);

    expect(result.existing).toStrictEqual({
      chapterCount: 3,
      description: "Existing description",
      hasCategories: true,
      hasIntroductionLessons: true,
      hasMainCurriculum: true,
      imageUrl: "https://example.com/img.webp",
      landingPage: null,
    });

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedRequest.courseId).toBe(course.id);
    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(workflowRunId);
  });

  it.each(["failed", "pending"] as const)(
    "lets only one workflow resume the same %s course snapshot",
    async (generationStatus) => {
      const course = await courseFixture({
        generationRunId: null,
        generationStatus,
        organizationId,
        title: `Concurrent Resume ${randomUUID()}`,
      });

      const [firstPrompt, secondPrompt] = await Promise.all([
        generatableCoursePromptFixture({ canonicalTitle: course.title }),
        generatableCoursePromptFixture({ canonicalTitle: course.title }),
      ]);

      assertGeneratableCoursePrompt(firstPrompt);
      assertGeneratableCoursePrompt(secondPrompt);

      const existingCourse: ExistingCourse = {
        ...course,
        _count: { categories: 0, chapters: 0 },
        chapters: [],
      };

      const firstWorkflowRunId = `first-${randomUUID()}`;
      const secondWorkflowRunId = `second-${randomUUID()}`;

      const [firstResult, secondResult] = await Promise.all([
        getOrCreateCourse({
          coursePromptId: firstPrompt.id,
          existingCourse,
          prompt: firstPrompt,
          workflowRunId: firstWorkflowRunId,
        }),
        getOrCreateCourse({
          coursePromptId: secondPrompt.id,
          existingCourse,
          prompt: secondPrompt,
          workflowRunId: secondWorkflowRunId,
        }),
      ]);

      expect([firstResult.status, secondResult.status].toSorted()).toStrictEqual([
        "ready",
        "running",
      ]);

      const persistedCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

      const winningWorkflowRunId =
        firstResult.status === "ready" ? firstWorkflowRunId : secondWorkflowRunId;

      expect(persistedCourse.generationRunId).toBe(winningWorkflowRunId);
      expect(persistedCourse.generationStatus).toBe("running");
    },
  );
});
