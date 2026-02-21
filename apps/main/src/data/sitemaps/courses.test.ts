import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { SITEMAP_BATCH_SIZE, countSitemapCourses, listSitemapCourses } from "./courses";

function lastPage(count: number): number {
  return Math.max(Math.ceil(count / SITEMAP_BATCH_SIZE) - 1, 0);
}

describe(countSitemapCourses, () => {
  test("returns a positive count", async () => {
    const count = await countSitemapCourses();
    expect(count).toBeGreaterThan(0);
  });
});

describe(listSitemapCourses, () => {
  test("returns published brand courses with correct fields", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "pt",
      organizationId: org.id,
    });

    const count = await countSitemapCourses();
    const courses = await listSitemapCourses(lastPage(count));
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toEqual({
      brandSlug: org.slug,
      courseSlug: course.slug,
      language: "pt",
      updatedAt: expect.any(Date),
    });
  });

  test("excludes unpublished courses", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: false,
      organizationId: org.id,
    });

    const count = await countSitemapCourses();
    const courses = await listSitemapCourses(lastPage(count));
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toBeUndefined();
  });

  test("excludes non-brand organization courses", async () => {
    const org = await organizationFixture({ kind: "personal" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
    });

    const count = await countSitemapCourses();
    const courses = await listSitemapCourses(lastPage(count));
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toBeUndefined();
  });

  test("excludes personal courses without an organization", async () => {
    const course = await courseFixture({
      isPublished: true,
      organizationId: null,
    });

    const count = await countSitemapCourses();
    const courses = await listSitemapCourses(lastPage(count));
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toBeUndefined();
  });

  test("includes courses from all languages", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const [enCourse, esCourse, ptCourse] = await Promise.all([
      courseFixture({ isPublished: true, language: "en", organizationId: org.id }),
      courseFixture({ isPublished: true, language: "es", organizationId: org.id }),
      courseFixture({ isPublished: true, language: "pt", organizationId: org.id }),
    ]);

    const count = await countSitemapCourses();
    const courses = await listSitemapCourses(lastPage(count));
    const slugs = courses.map((item) => item.courseSlug);

    expect(slugs).toContain(enCourse.slug);
    expect(slugs).toContain(esCourse.slug);
    expect(slugs).toContain(ptCourse.slug);
  });
});
