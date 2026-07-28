import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Next Lesson API", () => {
  let baseURL: string;
  let brandOrgId: string;
  let brandOrgSlug: string;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    const org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        kind: "brand",
        name: "E2E Next Lesson Org",
        slug: `e2e-next-lesson-${randomUUID()}`,
      },
    });

    brandOrgId = org.id;
    brandOrgSlug = org.slug;
  });

  test("returns first lesson for unauthenticated user (course scope)", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const course = await prisma.course.create({
      data: {
        description: "E2E test course",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e next lesson ${uniqueId}`,
        organizationId: brandOrgId,
        slug: `e2e-na-${uniqueId}`,
        title: `E2E Next Lesson ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "E2E test chapter",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e chapter ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-ch-${uniqueId}`,
        title: `E2E Chapter ${uniqueId}`,
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        description: "E2E test lesson",
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        language: "en",
        normalizedTitle: `e2e lesson ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-l-${uniqueId}`,
        title: `E2E Lesson ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/courses/${course.id}/next-lesson`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.hasStarted).toBe(false);
    expect(body.completed).toBe(false);
    expect(body.courseSlug).toBe(course.slug);
    expect(body.chapterSlug).toBe(chapter.slug);
    expect(body.lessonSlug).toBe(lesson.slug);
    expect(body.lessonPosition).toBe(0);
    expect(body.organizationSlug).toBe(brandOrgSlug);
    expect(body.type).toBe("lesson");
    expect(body).not.toHaveProperty("brandSlug");

    await apiContext.dispose();
  });

  test("returns 200 with slug fields for chapter scope", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const course = await prisma.course.create({
      data: {
        description: "E2E test course",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e ch scope ${uniqueId}`,
        organizationId: brandOrgId,
        slug: `e2e-chs-${uniqueId}`,
        title: `E2E Ch Scope ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "E2E test chapter",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e chapter ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-chs-ch-${uniqueId}`,
        title: `E2E Chapter ${uniqueId}`,
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        description: "E2E test lesson",
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        language: "en",
        normalizedTitle: `e2e lesson ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-chs-l-${uniqueId}`,
        title: `E2E Lesson ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/chapters/${chapter.id}/next-lesson`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.chapterSlug).toBe(chapter.slug);
    expect(body.lessonSlug).toBe(lesson.slug);
    expect(body.type).toBe("lesson");

    await apiContext.dispose();
  });

  test("returns no structural successor for the final lesson", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const course = await prisma.course.create({
      data: {
        description: "E2E test course",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e ls scope ${uniqueId}`,
        organizationId: brandOrgId,
        slug: `e2e-ls-${uniqueId}`,
        title: `E2E Ls Scope ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "E2E test chapter",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e chapter ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-ls-ch-${uniqueId}`,
        title: `E2E Chapter ${uniqueId}`,
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        description: "E2E test lesson",
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        language: "en",
        normalizedTitle: `e2e lesson ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-ls-l-${uniqueId}`,
        title: `E2E Lesson ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/lessons/${lesson.id}/next-lesson`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.lesson).toBeNull();

    await apiContext.dispose();
  });

  test("returns no slug fields when no published lessons exist", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const course = await prisma.course.create({
      data: {
        description: "E2E test course",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e no lessons ${uniqueId}`,
        organizationId: brandOrgId,
        slug: `e2e-noact-${uniqueId}`,
        title: `E2E No Lessons ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/courses/${course.id}/next-lesson`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.hasStarted).toBe(false);
    expect(body.completed).toBe(false);
    expect(body.type).toBe("empty");
    expect(body.organizationSlug).toBeUndefined();
    expect(body.courseSlug).toBeUndefined();

    await apiContext.dispose();
  });
});
