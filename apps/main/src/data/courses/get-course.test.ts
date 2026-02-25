import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getCourse } from "./get-course";

describe(getCourse, () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let schoolOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let schoolCourse: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    [brandOrg, schoolOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    [publishedCourse, draftCourse, schoolCourse] = await Promise.all([
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
        organizationId: schoolOrg.id,
      }),
    ]);

    await Promise.all([
      courseCategoryFixture({
        category: "tech",
        courseId: publishedCourse.id,
      }),
      courseCategoryFixture({
        category: "science",
        courseId: publishedCourse.id,
      }),
    ]);
  });

  test("returns course with organization and categories", async () => {
    const result = await getCourse({
      brandSlug: brandOrg.slug,
      courseSlug: publishedCourse.slug,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(publishedCourse.id);
    expect(result?.title).toBe(publishedCourse.title);
    expect(result?.description).toBe(publishedCourse.description);
    expect(result?.organization?.name).toBe(brandOrg.name);
    expect(result?.organization?.slug).toBe(brandOrg.slug);
    expect(result?.categories).toHaveLength(2);
    expect(result?.categories.map((item) => item.category)).toContain("tech");
    expect(result?.categories.map((item) => item.category)).toContain("science");
  });

  test("returns null for non-existent course", async () => {
    const result = await getCourse({
      brandSlug: brandOrg.slug,
      courseSlug: "non-existent-course",
    });

    expect(result).toBeNull();
  });

  test("returns null for unpublished course", async () => {
    const result = await getCourse({
      brandSlug: brandOrg.slug,
      courseSlug: draftCourse.slug,
    });

    expect(result).toBeNull();
  });

  test("returns null for course from non-brand org", async () => {
    const result = await getCourse({
      brandSlug: schoolOrg.slug,
      courseSlug: schoolCourse.slug,
    });

    expect(result).toBeNull();
  });

  test("returns null when brandSlug does not match", async () => {
    const otherBrandOrg = await organizationFixture({ kind: "brand" });

    const result = await getCourse({
      brandSlug: otherBrandOrg.slug,
      courseSlug: publishedCourse.slug,
    });

    expect(result).toBeNull();
  });

  test("finds courses with different language slugs independently", async () => {
    const baseSlug = `lang-test-${crypto.randomUUID()}`;

    const [enCourse, ptCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        slug: baseSlug,
      }),
      courseFixture({
        isPublished: true,
        language: "pt",
        organizationId: brandOrg.id,
        slug: `${baseSlug}-pt`,
      }),
    ]);

    const [enResult, ptResult] = await Promise.all([
      getCourse({ brandSlug: brandOrg.slug, courseSlug: baseSlug }),
      getCourse({ brandSlug: brandOrg.slug, courseSlug: `${baseSlug}-pt` }),
    ]);

    expect(enResult).not.toBeNull();
    expect(enResult?.id).toBe(enCourse.id);

    expect(ptResult).not.toBeNull();
    expect(ptResult?.id).toBe(ptCourse.id);
  });
});
