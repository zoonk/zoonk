import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

test.describe("Activity Generation Workflow API", () => {
  let baseURL: string;
  let aiOrgId: number;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    const aiOrg = await prisma.organization.findUnique({
      where: { slug: AI_ORG_SLUG },
    });

    if (!aiOrg) {
      throw new Error("AI organization not found");
    }

    aiOrgId = aiOrg.id;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("returns validation error when activityId is missing", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/activity-generation/trigger", {
      data: {},
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when activityId is invalid type", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/activity-generation/trigger", {
      data: { activityId: "invalid" },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns validation error when activityId is negative", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/activity-generation/trigger", {
      data: { activityId: -1 },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns 402 when user has no active subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Activity Test ${uniqueId}`;

    const course = await prisma.course.create({
      data: {
        description: "Test course for activity generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: aiOrgId,
        slug: `e2e-activity-test-${uniqueId}`,
        title: courseTitle,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter description",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Chapter"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-activity-chapter-${uniqueId}`,
        title: "Test Chapter",
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        description: "Test lesson description",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Lesson"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-activity-lesson-${uniqueId}`,
        title: "Test Lesson",
      },
    });

    const activity = await prisma.activity.create({
      data: {
        description: "Test activity description",
        isPublished: true,
        kind: "background",
        language: "en",
        lessonId: lesson.id,
        organizationId: aiOrgId,
        position: 0,
        title: "Test Activity",
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.post("/v1/workflows/activity-generation/trigger", {
      data: { activityId: Number(activity.id) },
    });

    expect(response.status()).toBe(402);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");
    expect(body.error.message).toBe("Active subscription required");

    await prisma.activity.delete({ where: { id: activity.id } });
    await prisma.lesson.delete({ where: { id: lesson.id } });
    await prisma.chapter.delete({ where: { id: chapter.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await apiContext.dispose();
  });

  test("returns validation error for status endpoint when runId is missing", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/workflows/activity-generation/status");

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("starts workflow successfully with active subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const email = `e2e-activity-${uniqueId}@zoonk.test`;
    const password = "password123";

    const signupContext = await request.newContext({ baseURL });
    const signupResponse = await signupContext.post("/v1/auth/sign-up/email", {
      data: { email, name: `E2E User ${uniqueId}`, password },
    });

    expect(signupResponse.ok()).toBe(true);
    await signupContext.dispose();

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.subscription.create({
      data: {
        plan: "hobby",
        referenceId: String(user.id),
        status: "active",
        stripeCustomerId: `cus_test_${uniqueId}`,
        stripeSubscriptionId: `sub_test_${uniqueId}`,
      },
    });

    const course = await prisma.course.create({
      data: {
        description: "Test course for activity generation with subscription",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`E2E Activity Success Test ${uniqueId}`),
        organizationId: aiOrgId,
        slug: `e2e-activity-success-${uniqueId}`,
        title: `E2E Activity Success Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter for workflow success",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Chapter Success"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-activity-chapter-success-${uniqueId}`,
        title: "Test Chapter Success",
      },
    });

    const lesson = await prisma.lesson.create({
      data: {
        chapterId: chapter.id,
        description: "Test lesson for workflow success",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Lesson Success"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-activity-lesson-success-${uniqueId}`,
        title: "Test Lesson Success",
      },
    });

    const activity = await prisma.activity.create({
      data: {
        description: "Test activity for workflow success",
        isPublished: true,
        kind: "background",
        language: "en",
        lessonId: lesson.id,
        organizationId: aiOrgId,
        position: 0,
        title: "Test Activity Success",
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const signInResponse = await apiContext.post("/v1/auth/sign-in/email", {
      data: { email, password },
    });

    expect(signInResponse.ok()).toBe(true);

    const response = await apiContext.post("/v1/workflows/activity-generation/trigger", {
      data: { activityId: Number(activity.id) },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Workflow started");
    expect(body.runId).toBeDefined();
    expect(typeof body.runId).toBe("string");

    await apiContext.dispose();
  });
});
