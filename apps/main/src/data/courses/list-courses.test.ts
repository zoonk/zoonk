import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listCourses } from "./list-courses";

describe("listCourses", () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let privateOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let privateCourse: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    [brandOrg, privateOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    [draftCourse, privateCourse] = await Promise.all([
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

  test("excludes draft courses and non-brand orgs", async () => {
    const result = await listCourses({ language: "en", limit: 100 });
    const ids = result.map((c) => c.id);

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
    const result = await listCourses({ language: "en" });

    expect(result.length).toBeGreaterThan(1);

    const userCounts = await Promise.all(
      result.map((course) =>
        prisma.courseUser.count({ where: { courseId: course.id } }),
      ),
    );

    for (let i = 0; i < userCounts.length - 1; i++) {
      const current = userCounts[i] ?? 0;
      const next = userCounts[i + 1] ?? 0;
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});
