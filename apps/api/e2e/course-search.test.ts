import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { normalizeString } from "@zoonk/utils/string";

test.describe("Course Search API", () => {
  let baseURL: string;
  let brandOrgId: number;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL ?? "";

    // Create a brand organization for tests
    const org = await prisma.organization.create({
      data: {
        kind: "brand",
        name: "E2E Test Organization",
        slug: `e2e-test-org-${randomUUID()}`,
      },
    });

    brandOrgId = org.id;
  });

  test.afterAll(async () => {
    // Clean up test data
    await prisma.course.deleteMany({
      where: { organizationId: brandOrgId },
    });

    await prisma.organization.delete({
      where: { id: brandOrgId },
    });

    await prisma.$disconnect();
  });

  test("returns courses matching search query", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Search Test ${uniqueId}`;

    await prisma.course.create({
      data: {
        description: "Test course for e2e search",
        imageUrl: "https://example.com/image.jpg",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: brandOrgId,
        slug: `e2e-search-test-${uniqueId}`,
        title: courseTitle,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(uniqueId)}&language=en`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe(courseTitle);
    expect(body.data[0].organization).toBeDefined();
    expect(body.data[0].organization.id).toBe(brandOrgId);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.hasMore).toBe(false);
    expect(body.pagination.nextCursor).toBeNull();

    await apiContext.dispose();
  });

  test("returns empty data array when no matches found", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(
      "/v1/courses/search?query=nonexistentcourse999xyz&language=en",
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data).toHaveLength(0);
    expect(body.pagination.hasMore).toBe(false);
    expect(body.pagination.nextCursor).toBeNull();

    await apiContext.dispose();
  });

  test("returns all languages but sorts user's language first", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const enTitle = `E2E Language EN ${uniqueId}`;
    const ptTitle = `E2E Language PT ${uniqueId}`;

    await Promise.all([
      prisma.course.create({
        data: {
          description: "English course",
          isPublished: true,
          language: "en",
          normalizedTitle: normalizeString(enTitle),
          organizationId: brandOrgId,
          slug: `e2e-lang-en-${uniqueId}`,
          title: enTitle,
        },
      }),
      prisma.course.create({
        data: {
          description: "Portuguese course",
          isPublished: true,
          language: "pt",
          normalizedTitle: normalizeString(ptTitle),
          organizationId: brandOrgId,
          slug: `e2e-lang-pt-${uniqueId}`,
          title: ptTitle,
        },
      }),
    ]);

    const apiContext = await request.newContext({ baseURL });

    const enResponse = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(uniqueId)}&language=en`,
    );
    const ptResponse = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(uniqueId)}&language=pt`,
    );

    expect(enResponse.status()).toBe(200);
    expect(ptResponse.status()).toBe(200);

    const enBody = await enResponse.json();
    const ptBody = await ptResponse.json();

    // Both responses return courses from all languages
    expect(enBody.data).toHaveLength(2);
    expect(ptBody.data).toHaveLength(2);

    // User's language is sorted first
    expect(enBody.data[0].language).toBe("en");
    expect(ptBody.data[0].language).toBe("pt");

    await apiContext.dispose();
  });

  test("supports pagination with cursor", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    // Create 5 courses
    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        description: `Pagination test course ${index}`,
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e pagination ${uniqueId} course ${index}`,
        organizationId: brandOrgId,
        slug: `e2e-pagination-${uniqueId}-${index}`,
        title: `E2E Pagination ${uniqueId} Course ${index}`,
      })),
    });

    const apiContext = await request.newContext({ baseURL });

    // First page - limit 2
    const firstResponse = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(`pagination ${uniqueId}`)}&language=en&limit=2`,
    );

    expect(firstResponse.status()).toBe(200);

    const firstBody = await firstResponse.json();

    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.pagination.hasMore).toBe(true);
    expect(firstBody.pagination.nextCursor).not.toBeNull();

    // Second page using cursor
    const secondResponse = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(`pagination ${uniqueId}`)}&language=en&limit=2&cursor=${firstBody.pagination.nextCursor}`,
    );

    expect(secondResponse.status()).toBe(200);

    const secondBody = await secondResponse.json();

    expect(secondBody.data).toHaveLength(2);
    expect(secondBody.pagination.hasMore).toBe(true);

    // Third page - should have 1 item left
    const thirdResponse = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(`pagination ${uniqueId}`)}&language=en&limit=2&cursor=${secondBody.pagination.nextCursor}`,
    );

    expect(thirdResponse.status()).toBe(200);

    const thirdBody = await thirdResponse.json();

    expect(thirdBody.data).toHaveLength(1);
    expect(thirdBody.pagination.hasMore).toBe(false);
    expect(thirdBody.pagination.nextCursor).toBeNull();

    // Verify all courses are unique across pages
    const allIds = [
      ...firstBody.data.map((course: { id: number }) => course.id),
      ...secondBody.data.map((course: { id: number }) => course.id),
      ...thirdBody.data.map((course: { id: number }) => course.id),
    ];
    const uniqueIds = new Set(allIds);

    expect(uniqueIds.size).toBe(5);

    await apiContext.dispose();
  });

  test("returns validation error when query is missing", async () => {
    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get("/v1/courses/search?language=en");

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();

    await apiContext.dispose();
  });

  test("returns results without language parameter", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E No Lang ${uniqueId}`;

    await prisma.course.create({
      data: {
        description: "Course without language param",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: brandOrgId,
        slug: `e2e-no-lang-${uniqueId}`,
        title: courseTitle,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(uniqueId)}`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe(courseTitle);

    await apiContext.dispose();
  });

  test("respects custom limit parameter", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    // Create 10 courses
    await prisma.course.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        description: `Limit test course ${index}`,
        isPublished: true,
        language: "en",
        normalizedTitle: `e2e limit ${uniqueId} course ${index}`,
        organizationId: brandOrgId,
        slug: `e2e-limit-${uniqueId}-${index}`,
        title: `E2E Limit ${uniqueId} Course ${index}`,
      })),
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(`limit ${uniqueId}`)}&language=en&limit=5`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data).toHaveLength(5);
    expect(body.pagination.hasMore).toBe(true);

    await apiContext.dispose();
  });

  test("excludes unpublished courses", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    await Promise.all([
      prisma.course.create({
        data: {
          description: "Published course",
          isPublished: true,
          language: "en",
          normalizedTitle: `e2e published ${uniqueId}`,
          organizationId: brandOrgId,
          slug: `e2e-published-${uniqueId}`,
          title: `E2E Published ${uniqueId}`,
        },
      }),
      prisma.course.create({
        data: {
          description: "Unpublished course",
          isPublished: false,
          language: "en",
          normalizedTitle: `e2e unpublished ${uniqueId}`,
          organizationId: brandOrgId,
          slug: `e2e-unpublished-${uniqueId}`,
          title: `E2E Unpublished ${uniqueId}`,
        },
      }),
    ]);

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(uniqueId)}&language=en`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toContain("Published");

    await apiContext.dispose();
  });

  test("excludes courses from school organizations", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const schoolOrg = await prisma.organization.create({
      data: {
        kind: "school",
        name: "E2E School Organization",
        slug: `e2e-school-${uniqueId}`,
      },
    });

    await Promise.all([
      prisma.course.create({
        data: {
          description: "Brand course",
          isPublished: true,
          language: "en",
          normalizedTitle: `e2e brand org ${uniqueId}`,
          organizationId: brandOrgId,
          slug: `e2e-brand-${uniqueId}`,
          title: `E2E Brand Org ${uniqueId}`,
        },
      }),
      prisma.course.create({
        data: {
          description: "School course",
          isPublished: true,
          language: "en",
          normalizedTitle: `e2e school org ${uniqueId}`,
          organizationId: schoolOrg.id,
          slug: `e2e-school-course-${uniqueId}`,
          title: `E2E School Org ${uniqueId}`,
        },
      }),
    ]);

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(uniqueId)}&language=en`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toContain("Brand");

    // Cleanup school org
    await prisma.course.deleteMany({ where: { organizationId: schoolOrg.id } });
    await prisma.organization.delete({ where: { id: schoolOrg.id } });

    await apiContext.dispose();
  });

  test("returns course with organization details", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Org Details ${uniqueId}`;

    await prisma.course.create({
      data: {
        description: "Course with org details",
        imageUrl: "https://example.com/course.jpg",
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(courseTitle),
        organizationId: brandOrgId,
        slug: `e2e-org-details-${uniqueId}`,
        title: courseTitle,
      },
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(
      `/v1/courses/search?query=${encodeURIComponent(uniqueId)}&language=en`,
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    const course = body.data[0];

    expect(course.id).toBeDefined();
    expect(course.slug).toBe(`e2e-org-details-${uniqueId}`);
    expect(course.title).toBe(courseTitle);
    expect(course.description).toBe("Course with org details");
    expect(course.imageUrl).toBe("https://example.com/course.jpg");
    expect(course.language).toBe("en");
    expect(course.organization.id).toBe(brandOrgId);
    expect(course.organization.slug).toBeDefined();
    expect(course.organization.name).toBe("E2E Test Organization");

    await apiContext.dispose();
  });
});
