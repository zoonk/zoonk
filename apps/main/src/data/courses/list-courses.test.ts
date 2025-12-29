import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  courseCategoryFixture,
  courseFixture,
  courseUserFixture,
} from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { listCourses } from "./list-courses";

describe("listCourses", () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let privateOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let privateCourse: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    [brandOrg, privateOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    [publishedCourse, draftCourse, privateCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
      }),
      courseFixture({
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: privateOrg.id,
      }),
    ]);
  });

  test("returns only published courses from brand orgs", async () => {
    const result = await listCourses({ language: "en", limit: 100 });
    const ids = result.map((c) => c.id);

    expect(ids).toContain(publishedCourse.id);
    expect(ids).not.toContain(draftCourse.id);
    expect(ids).not.toContain(privateCourse.id);
  });

  test("filters by language", async () => {
    const ptCourse = await courseFixture({
      isPublished: true,
      language: "pt",
      organizationId: brandOrg.id,
    });

    const enResult = await listCourses({ language: "en", limit: 100 });
    const ptResult = await listCourses({ language: "pt", limit: 100 });

    const enIds = enResult.map((c) => c.id);
    const ptIds = ptResult.map((c) => c.id);

    expect(enIds).not.toContain(ptCourse.id);
    expect(ptIds).toContain(ptCourse.id);
    expect(ptIds).not.toContain(publishedCourse.id);
  });

  test("filters by category", async () => {
    const techCourse = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

    await courseCategoryFixture({
      category: "tech",
      courseId: techCourse.id,
    });

    const result = await listCourses({ category: "tech", language: "en" });

    const ids = result.map((c) => c.id);

    expect(ids).toContain(techCourse.id);
    expect(ids).not.toContain(publishedCourse.id);
  });

  test("limits results to specified amount", async () => {
    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        description: `Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        isPublished: true,
        language: "en",
        normalizedTitle: `test course ${i}`,
        organizationId: brandOrg.id,
        slug: `test-course-${randomUUID()}-${i}`,
        title: `Test Course ${i}`,
      })),
    });

    const result = await listCourses({ language: "en", limit: 3 });

    expect(result).toHaveLength(3);
  });

  test("sorts by popularity (more users first)", async () => {
    const [user1, user2, user3] = await Promise.all([
      userFixture(),
      userFixture(),
      userFixture(),
    ]);

    const [popularCourse, lessPopularCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        slug: `popular-course-${randomUUID()}`,
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        slug: `less-popular-course-${randomUUID()}`,
      }),
    ]);

    await Promise.all([
      courseUserFixture({
        courseId: popularCourse.id,
        userId: Number(user1.id),
      }),
      courseUserFixture({
        courseId: popularCourse.id,
        userId: Number(user2.id),
      }),
      courseUserFixture({
        courseId: popularCourse.id,
        userId: Number(user3.id),
      }),
      courseUserFixture({
        courseId: lessPopularCourse.id,
        userId: Number(user1.id),
      }),
    ]);

    const result = await listCourses({ language: "en" });

    const popularIndex = result.findIndex((c) => c.id === popularCourse.id);

    const lessPopularIndex = result.findIndex(
      (c) => c.id === lessPopularCourse.id,
    );

    expect(popularIndex).toBeLessThan(lessPopularIndex);
  });

  test("sorts by createdAt as tiebreaker for same popularity", async () => {
    const [org, user1, user2, user3, user4] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      userFixture(),
      userFixture(),
      userFixture(),
      userFixture(),
    ]);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const olderCourse = await courseFixture({
      createdAt: oneHourAgo,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const newerCourse = await courseFixture({
      createdAt: now,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    await Promise.all([
      courseUserFixture({
        courseId: olderCourse.id,
        userId: Number(user1.id),
      }),
      courseUserFixture({
        courseId: olderCourse.id,
        userId: Number(user2.id),
      }),
      courseUserFixture({
        courseId: olderCourse.id,
        userId: Number(user3.id),
      }),
      courseUserFixture({
        courseId: olderCourse.id,
        userId: Number(user4.id),
      }),
      courseUserFixture({
        courseId: newerCourse.id,
        userId: Number(user1.id),
      }),
      courseUserFixture({
        courseId: newerCourse.id,
        userId: Number(user2.id),
      }),
      courseUserFixture({
        courseId: newerCourse.id,
        userId: Number(user3.id),
      }),
      courseUserFixture({
        courseId: newerCourse.id,
        userId: Number(user4.id),
      }),
    ]);

    const result = await listCourses({ language: "en" });

    const newerIndex = result.findIndex((c) => c.id === newerCourse.id);
    const olderIndex = result.findIndex((c) => c.id === olderCourse.id);

    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeGreaterThanOrEqual(0);
    expect(newerIndex).toBeLessThan(olderIndex);
  });
});
