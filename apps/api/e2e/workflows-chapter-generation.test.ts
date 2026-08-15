import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { createAuthenticatedApiContext, createSubscribedApiContext } from "./helpers/auth";

/**
 * Creates two paid chapters in one isolated AI course so a single authenticated
 * client can verify authorization again after its subscription changes.
 */
async function subscriptionRefreshFixture(organizationId: string) {
  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Subscription Refresh ${uniqueId}`;

  const course = await prisma.course.create({
    data: {
      description: "Test course for fresh subscription authorization",
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(courseTitle),
      organizationId,
      slug: `e2e-subscription-refresh-${uniqueId}`,
      title: courseTitle,
    },
  });

  const [firstChapter, secondChapter] = await Promise.all([
    prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "First paid chapter",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`First Paid Chapter ${uniqueId}`),
        organizationId,
        position: 1,
        slug: `e2e-first-paid-${uniqueId}`,
        title: `First Paid Chapter ${uniqueId}`,
      },
    }),
    prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Second paid chapter",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`Second Paid Chapter ${uniqueId}`),
        organizationId,
        position: 2,
        slug: `e2e-second-paid-${uniqueId}`,
        title: `Second Paid Chapter ${uniqueId}`,
      },
    }),
  ]);

  return { firstChapter, secondChapter };
}

test.describe("Chapter Generation Workflow API", () => {
  let baseURL: string;
  let aiOrgId: string;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    const aiOrg = await getAiOrganization();
    aiOrgId = aiOrg.id;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication before generating the first chapter", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Chapter Public ${uniqueId}`;

    const course = await prisma.course.create({
      data: {
        description: "Test course for public first chapter generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: aiOrgId,
        slug: `e2e-chapter-public-${uniqueId}`,
        title: courseTitle,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test first chapter for public generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Chapter Public"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-chapter-public-${uniqueId}`,
        title: "Test Chapter Public",
      },
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: chapter.id, type: "chapter" } },
    });

    expect(response.status()).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    await expect(
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
    ).resolves.toMatchObject({ generationRunId: null, generationStatus: "pending" });

    await apiContext.dispose();
  });

  test("requires authentication before checking later-chapter subscriptions", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Chapter Paid ${uniqueId}`;

    const course = await prisma.course.create({
      data: {
        description: "Test course for paid chapter generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: aiOrgId,
        slug: `e2e-chapter-paid-${uniqueId}`,
        title: courseTitle,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Later chapter requires subscription",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Chapter Paid"),
        organizationId: aiOrgId,
        position: 1,
        slug: `e2e-chapter-paid-${uniqueId}`,
        title: "Test Chapter Paid",
      },
    });

    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: chapter.id, type: "chapter" } },
    });

    expect(response.status()).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    await expect(
      prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } }),
    ).resolves.toMatchObject({ generationRunId: null, generationStatus: "pending" });

    await apiContext.dispose();
  });

  test("returns validation error when chapterId is not a UUID", async () => {
    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "chapter-validation",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: "not-a-uuid", type: "chapter" } },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("returns 402 when user has no active subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Chapter Test ${uniqueId}`;

    // Create a course and chapter for testing
    const course = await prisma.course.create({
      data: {
        description: "Test course for chapter generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: aiOrgId,
        slug: `e2e-chapter-test-${uniqueId}`,
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
        position: 1,
        slug: `e2e-chapter-${uniqueId}`,
        title: "Test Chapter",
      },
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "chapter-no-subscription",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: chapter.id, type: "chapter" } },
    });

    // Non-first chapter without subscription should return 402
    expect(response.status()).toBe(402);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");
    expect(body.error.message).toBe("Active subscription required");

    // Cleanup
    await prisma.chapter.delete({ where: { id: chapter.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await apiContext.dispose();
  });

  test("allows signed-in first chapter generation without subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E First Chapter Free ${uniqueId}`;

    const course = await prisma.course.create({
      data: {
        description: "Test course for first chapter free generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: aiOrgId,
        slug: `e2e-first-ch-free-${uniqueId}`,
        title: courseTitle,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "First chapter - should be free",
        generationStatus: "completed",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("First Chapter Free"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-first-ch-free-${uniqueId}`,
        title: "First Chapter Free",
      },
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "chapter-first-free",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: chapter.id, type: "chapter" } },
    });

    expect(response.status()).toBe(202);

    const body = await response.json();

    expect(body).toStrictEqual({ id: expect.any(String), status: expect.any(String) });

    await apiContext.dispose();
  });

  test("returns 404 for chapters outside the AI organization", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();

    const course = await prisma.course.create({
      data: {
        description: "Non-AI course should not allow chapter generation",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`Non AI Chapter Test ${uniqueId}`),
        organizationId: org.id,
        slug: `non-ai-chapter-test-${uniqueId}`,
        title: `Non AI Chapter Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Non-AI first chapter",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Non AI First Chapter"),
        organizationId: org.id,
        position: 0,
        slug: `non-ai-first-chapter-${uniqueId}`,
        title: "Non AI First Chapter",
      },
    });

    const { apiContext } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "chapter-non-ai",
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: chapter.id, type: "chapter" } },
    });

    expect(response.status()).toBe(404);

    await apiContext.dispose();
  });

  test("returns validation error when the generation ID is empty", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/generations/%20/events");

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });

  test("starts workflow successfully with active subscription", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { apiContext } = await createSubscribedApiContext({ baseURL, prefix: "chapter-success" });

    // Create test course and chapter with unique slugs
    const course = await prisma.course.create({
      data: {
        description: "Test course for chapter generation with subscription",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(`E2E Chapter Success Test ${uniqueId}`),
        organizationId: aiOrgId,
        slug: `e2e-chapter-success-${uniqueId}`,
        title: `E2E Chapter Success Test ${uniqueId}`,
      },
    });

    const chapter = await prisma.chapter.create({
      data: {
        courseId: course.id,
        description: "Test chapter for workflow success",
        generationStatus: "completed",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Test Chapter Success"),
        organizationId: aiOrgId,
        position: 0,
        slug: `e2e-chapter-success-${uniqueId}`,
        title: "Test Chapter Success",
      },
    });

    const response = await apiContext.post("/v1/generations", {
      data: { target: { id: chapter.id, type: "chapter" } },
    });

    expect(response.status()).toBe(202);

    const body = await response.json();

    expect(body).toStrictEqual({ id: expect.any(String), status: expect.any(String) });

    await apiContext.dispose();
  });

  test("rechecks subscription access before each workflow start", async () => {
    const { apiContext, user } = await createSubscribedApiContext({
      baseURL,
      prefix: "chapter-subscription-refresh",
    });

    const { firstChapter, secondChapter } = await subscriptionRefreshFixture(aiOrgId);

    const firstResponse = await apiContext.post("/v1/generations", {
      data: { target: { id: firstChapter.id, type: "chapter" } },
    });

    expect(firstResponse.status()).toBe(202);

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    const secondResponse = await apiContext.post("/v1/generations", {
      data: { target: { id: secondChapter.id, type: "chapter" } },
    });

    expect(secondResponse.status()).toBe(402);

    await apiContext.dispose();
  });
});
