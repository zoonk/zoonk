import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";

/**
 * Requests both public learner-state subresources for one course or chapter so
 * each access case proves that progress and next-learning use the same catalog
 * boundary.
 */
async function getScopedProgressResponses({
  apiContext,
  resourceId,
  resourceType,
}: {
  apiContext: Awaited<ReturnType<typeof request.newContext>>;
  resourceId: string;
  resourceType: "chapters" | "courses";
}) {
  return Promise.all([
    apiContext.get(`/v1/${resourceType}/${resourceId}/progress`),
    apiContext.get(`/v1/${resourceType}/${resourceId}/next-lesson`),
  ]);
}

test.describe("Progress resource access", () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("returns successful empty resources for published brand curriculum", async () => {
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const [courseResponses, chapterResponses] = await Promise.all([
      getScopedProgressResponses({ apiContext, resourceId: course.id, resourceType: "courses" }),
      getScopedProgressResponses({ apiContext, resourceId: chapter.id, resourceType: "chapters" }),
    ]);

    for (const response of [...courseResponses, ...chapterResponses]) {
      expect(response.status()).toBe(200);
    }

    expect(await courseResponses[0].json()).toEqual({ chapters: [], percentComplete: null });
    expect(await chapterResponses[0].json()).toEqual({ lessons: [], percentComplete: null });

    expect(await courseResponses[1].json()).toEqual({
      completed: false,
      hasStarted: false,
      type: "empty",
    });

    expect(await chapterResponses[1].json()).toEqual({
      completed: false,
      hasStarted: false,
      type: "empty",
    });

    await apiContext.dispose();
  });

  test("returns not found for unknown, unpublished, and non-brand resources", async () => {
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });

    const [brandOrganization, schoolOrganization] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const [unpublishedCourse, schoolCourse] = await Promise.all([
      courseFixture({ isPublished: false, organizationId: brandOrganization.id }),
      courseFixture({ isPublished: true, organizationId: schoolOrganization.id }),
    ]);

    const [unpublishedChapter, schoolChapter] = await Promise.all([
      chapterFixture({
        courseId: unpublishedCourse.id,
        isPublished: true,
        organizationId: brandOrganization.id,
      }),
      chapterFixture({
        courseId: schoolCourse.id,
        isPublished: true,
        organizationId: schoolOrganization.id,
      }),
    ]);

    const scopedResources = [
      { resourceId: randomUUID(), resourceType: "courses" as const },
      { resourceId: unpublishedCourse.id, resourceType: "courses" as const },
      { resourceId: schoolCourse.id, resourceType: "courses" as const },
      { resourceId: randomUUID(), resourceType: "chapters" as const },
      { resourceId: unpublishedChapter.id, resourceType: "chapters" as const },
      { resourceId: schoolChapter.id, resourceType: "chapters" as const },
    ];

    const responsePairs = await Promise.all(
      scopedResources.map(({ resourceId, resourceType }) =>
        getScopedProgressResponses({ apiContext, resourceId, resourceType }),
      ),
    );

    const responses = responsePairs.flat();
    const bodies = await Promise.all(responses.map((response) => response.json()));

    for (const [index, response] of responses.entries()) {
      expect(response.status()).toBe(404);
      expect(bodies[index]).toMatchObject({ error: { code: "NOT_FOUND" } });
    }

    await apiContext.dispose();
  });
});
