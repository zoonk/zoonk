import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  getCoursePromptGeneration,
  getCoursePromptGenerationResource,
} from "./get-course-prompt-generation";

describe(getCoursePromptGeneration, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("returns the persisted request while a course has not been linked", async () => {
    const prompt = await coursePromptFixture({
      canonicalTitle: `Pending generation ${randomUUID()}`,
      courseFormat: "core",
      language: "en",
    });

    await expect(getCoursePromptGeneration({ coursePromptId: prompt.id })).resolves.toMatchObject({
      completionKind: "introductionLesson",
      coursePromptId: prompt.id,
      isLanguageCourse: false,
      linkedCourseSlug: null,
      status: "pending",
    });
  });

  it("targets the first published lesson as soon as a core course becomes useful", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Core generation ${randomUUID()}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId,
      position: 0,
      slug: `intro-${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId,
      position: 0,
      slug: `lesson-${randomUUID()}`,
    });

    const prompt = await coursePromptFixture({ courseFormat: "core", courseId: course.id });

    await expect(getCoursePromptGeneration({ coursePromptId: prompt.id })).resolves.toStrictEqual({
      status: "redirect",
      target: {
        chapterSlug: chapter.slug,
        courseSlug: course.slug,
        kind: "lesson",
        lessonSlug: lesson.slug,
      },
    });
  });

  it("falls back to a completed core course when no intro lesson exists", async () => {
    const course = await courseFixture({
      generationStatus: "completed",
      organizationId,
      title: `Completed core generation ${randomUUID()}`,
    });

    const prompt = await coursePromptFixture({ courseFormat: "core", courseId: course.id });

    await expect(getCoursePromptGeneration({ coursePromptId: prompt.id })).resolves.toStrictEqual({
      status: "redirect",
      target: { courseSlug: course.slug, kind: "course" },
    });
  });

  it("waits for language courses to complete before targeting the course", async () => {
    const course = await courseFixture({
      format: "language",
      generationStatus: "running",
      organizationId,
      title: `Language generation ${randomUUID()}`,
    });

    const prompt = await coursePromptFixture({ courseFormat: "language", courseId: course.id });

    await expect(getCoursePromptGeneration({ coursePromptId: prompt.id })).resolves.toMatchObject({
      completionKind: "course",
      coursePromptId: prompt.id,
      isLanguageCourse: true,
      linkedCourseSlug: course.slug,
      status: "pending",
    });
  });

  it("targets a completed language course", async () => {
    const course = await courseFixture({
      format: "language",
      generationStatus: "completed",
      organizationId,
      title: `Completed language generation ${randomUUID()}`,
    });

    const prompt = await coursePromptFixture({ courseFormat: "language", courseId: course.id });

    await expect(getCoursePromptGeneration({ coursePromptId: prompt.id })).resolves.toStrictEqual({
      status: "redirect",
      target: { courseSlug: course.slug, kind: "course" },
    });
  });

  it("hides malformed and incomplete prompt resources", async () => {
    const prompt = await coursePromptFixture({ canonicalTitle: null, generationStatus: null });

    await expect(getCoursePromptGeneration({ coursePromptId: prompt.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      getCoursePromptGeneration({ coursePromptId: "invalid-id" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("hides an incomplete API resource without a classified course format", async () => {
    const prompt = await coursePromptFixture({
      canonicalTitle: `Unclassified prompt ${randomUUID()}`,
      courseFormat: null,
      generationStatus: "pending",
    });

    await expect(
      getCoursePromptGenerationResource({ coursePromptId: prompt.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
