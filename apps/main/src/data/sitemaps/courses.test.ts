import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { SITEMAP_BATCH_SIZE, countSitemapCourses, listSitemapCourses } from "./courses";

/** UUID fixtures can appear on any sitemap page in the shared test database. */
async function listAllSitemapCourses() {
  const count = await countSitemapCourses();
  const pageCount = Math.ceil(count / SITEMAP_BATCH_SIZE);

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, page) => listSitemapCourses(page)),
  );

  return pages.flat();
}

describe(countSitemapCourses, () => {
  it("returns a positive count", async () => {
    const count = await countSitemapCourses();
    expect(count).toBeGreaterThan(0);
  });
});

describe(listSitemapCourses, () => {
  it("returns published brand courses with correct fields", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "pt",
      organizationId: org.id,
    });

    const courses = await listAllSitemapCourses();
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toStrictEqual({
      brandSlug: org.slug,
      courseSlug: course.slug,
      language: "pt",
      updatedAt: expect.any(Date),
    });
  });

  it("excludes unpublished courses", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({ isPublished: false, organizationId: org.id });

    const courses = await listAllSitemapCourses();
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toBeUndefined();
  });

  it("excludes non-brand organization courses", async () => {
    const org = await organizationFixture({ kind: "personal" });

    const course = await courseFixture({ isPublished: true, organizationId: org.id });

    const courses = await listAllSitemapCourses();
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toBeUndefined();
  });

  it("excludes personal courses without an organization", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: null });

    const courses = await listAllSitemapCourses();
    const found = courses.find((item) => item.courseSlug === course.slug);

    expect(found).toBeUndefined();
  });

  it("includes courses from all languages", async () => {
    const org = await organizationFixture({ kind: "brand" });

    const [enCourse, esCourse, ptCourse] = await Promise.all([
      courseFixture({ isPublished: true, language: "en", organizationId: org.id }),
      courseFixture({ isPublished: true, language: "es", organizationId: org.id }),
      courseFixture({ isPublished: true, language: "pt", organizationId: org.id }),
    ]);

    const courses = await listAllSitemapCourses();
    const slugs = courses.map((item) => item.courseSlug);

    expect(slugs).toContain(enCourse.slug);
    expect(slugs).toContain(esCourse.slug);
    expect(slugs).toContain(ptCourse.slug);
  });
});
