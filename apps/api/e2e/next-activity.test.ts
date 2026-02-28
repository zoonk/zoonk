import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Next Activity API", () => {
  let baseURL: string;
  let brandOrgId: number;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    const org = await prisma.organization.create({
      data: {
        kind: "brand",
        name: "E2E Next Activity Org",
        slug: `e2e-next-activity-${randomUUID()}`,
      },
    });

    brandOrgId = org.id;
  });

  test("returns 400 when no scope param provided", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/progress/next-activity");

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns 400 when multiple scope params provided", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/progress/next-activity?courseId=1&chapterId=2");

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns first activity for unauthenticated user (course scope)", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const course = await prisma.course.create({
      data: {
        description: "E2E test course",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e next activity ${uniqueId}`,
        organizationId: brandOrgId,
        slug: `e2e-na-${uniqueId}`,
        title: `E2E Next Activity ${uniqueId}`,
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
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e lesson ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-l-${uniqueId}`,
        title: `E2E Lesson ${uniqueId}`,
      },
    });

    await prisma.activity.create({
      data: {
        isPublished: true,
        kind: "background",
        language: "en",
        lessonId: lesson.id,
        organizationId: brandOrgId,
        position: 0,
        title: `E2E Activity ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/progress/next-activity?courseId=${course.id}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.hasStarted).toBe(false);
    expect(body.completed).toBe(false);
    expect(body.courseSlug).toBe(course.slug);
    expect(body.chapterSlug).toBe(chapter.slug);
    expect(body.lessonSlug).toBe(lesson.slug);
    expect(body.activityPosition).toBe(0);

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
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e lesson ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-chs-l-${uniqueId}`,
        title: `E2E Lesson ${uniqueId}`,
      },
    });

    await prisma.activity.create({
      data: {
        isPublished: true,
        kind: "background",
        language: "en",
        lessonId: lesson.id,
        organizationId: brandOrgId,
        position: 0,
        title: `E2E Activity ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/progress/next-activity?chapterId=${chapter.id}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.chapterSlug).toBe(chapter.slug);
    expect(body.lessonSlug).toBe(lesson.slug);

    await apiContext.dispose();
  });

  test("returns 200 with slug fields for lesson scope", async () => {
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
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e lesson ${uniqueId}`,
        organizationId: brandOrgId,
        position: 0,
        slug: `e2e-ls-l-${uniqueId}`,
        title: `E2E Lesson ${uniqueId}`,
      },
    });

    await prisma.activity.create({
      data: {
        isPublished: true,
        kind: "background",
        language: "en",
        lessonId: lesson.id,
        organizationId: brandOrgId,
        position: 0,
        title: `E2E Activity ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/progress/next-activity?lessonId=${lesson.id}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.lessonSlug).toBe(lesson.slug);
    expect(body.activityPosition).toBe(0);

    await apiContext.dispose();
  });

  test("returns no slug fields when no published activities exist", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const course = await prisma.course.create({
      data: {
        description: "E2E test course",
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e no activities ${uniqueId}`,
        organizationId: brandOrgId,
        slug: `e2e-noact-${uniqueId}`,
        title: `E2E No Activities ${uniqueId}`,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/progress/next-activity?courseId=${course.id}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.hasStarted).toBe(false);
    expect(body.completed).toBe(false);
    expect(body.brandSlug).toBeUndefined();
    expect(body.courseSlug).toBeUndefined();

    await apiContext.dispose();
  });
});
