import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { cacheTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { getCourse } from "./get-course-by-slug";

describe(getCourse, () => {
  it("returns a published brand course with its organization and categories", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: organization.id,
    });

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: course.id }),
      courseCategoryFixture({ category: "science", courseId: course.id }),
    ]);

    const result = await getCourse({ brandSlug: organization.slug, courseSlug: course.slug });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(course.id);
    expect(result?.title).toBe(course.title);
    expect(result?.description).toBe(course.description);
    expect(result?.organization?.name).toBe(organization.name);
    expect(result?.organization?.slug).toBe(organization.slug);
    expect(result?.categories).toHaveLength(2);

    expect(result?.categories.map((item) => item.category)).toStrictEqual(
      expect.arrayContaining(["tech", "science"]),
    );

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: course.slug }),
    );

    expect(cacheTag).toHaveBeenCalledWith(getCourseCacheTag(course.id));
  });

  it("normalizes an encoded Unicode slug before reading and caching the route", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "pt-BR",
      organizationId: organization.id,
      slug: `japones-${crypto.randomUUID()}-日本語`,
    });

    const result = await getCourse({
      brandSlug: organization.slug,
      courseSlug: encodeURIComponent(course.slug),
    });

    expect(result?.id).toBe(course.id);

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: course.slug }),
    );
  });

  it("keeps malformed route segments as not-found inputs", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    await expect(
      getCourse({ brandSlug: organization.slug, courseSlug: "%broken" }),
    ).resolves.toBeNull();

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: "%broken" }),
    );
  });

  it("returns null when the course does not exist", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const result = await getCourse({
      brandSlug: organization.slug,
      courseSlug: `missing-${crypto.randomUUID()}`,
    });

    expect(result).toBeNull();
  });

  it("returns null when the course is unpublished", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: false, organizationId: organization.id });

    const result = await getCourse({ brandSlug: organization.slug, courseSlug: course.slug });

    expect(result).toBeNull();
  });

  it("returns null when the course belongs to a non-brand organization", async () => {
    const organization = await organizationFixture({ kind: "school" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const result = await getCourse({ brandSlug: organization.slug, courseSlug: course.slug });

    expect(result).toBeNull();
  });

  it("returns null when the brand slug does not match", async () => {
    const [courseOrganization, requestedOrganization] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({
      isPublished: true,
      organizationId: courseOrganization.id,
    });

    const result = await getCourse({
      brandSlug: requestedOrganization.slug,
      courseSlug: course.slug,
    });

    expect(result).toBeNull();
  });

  it("resolves different localized slugs independently", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const baseSlug = `localized-${crypto.randomUUID()}`;

    const [englishCourse, portugueseCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: organization.id,
        slug: baseSlug,
      }),
      courseFixture({
        isPublished: true,
        language: "pt",
        organizationId: organization.id,
        slug: `${baseSlug}-pt`,
      }),
    ]);

    const [englishResult, portugueseResult] = await Promise.all([
      getCourse({ brandSlug: organization.slug, courseSlug: englishCourse.slug }),
      getCourse({ brandSlug: organization.slug, courseSlug: portugueseCourse.slug }),
    ]);

    expect(englishResult?.id).toBe(englishCourse.id);
    expect(portugueseResult?.id).toBe(portugueseCourse.id);
  });
});
