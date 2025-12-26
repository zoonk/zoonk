import { signInAs } from "@zoonk/testing/fixtures/auth";
import {
  chapterFixture,
  courseChapterFixture,
} from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { searchOrgChapters } from "./search-org-chapters";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    const result = await searchOrgChapters({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "test",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "test",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("searches all chapters in organization by title", async () => {
    await Promise.all([
      chapterFixture({
        organizationId: organization.id,
        title: "Learn JavaScript Basics",
      }),
      chapterFixture({
        organizationId: organization.id,
        title: "Advanced Python Techniques",
      }),
      chapterFixture({
        organizationId: organization.id,
        title: "JavaScript Functions",
      }),
    ]);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(2);
  });

  test("searches with normalized title (removes accents)", async () => {
    await chapterFixture({
      organizationId: organization.id,
      title: "Introdução à Programação",
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(
      result.data.some((c) => c.title === "Introdução à Programação"),
    ).toBe(true);
  });

  test("returns empty array when no matches", async () => {
    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "xyznonexistentxyz",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("only returns chapters from the specified organization", async () => {
    const otherOrg = await organizationFixture();

    await Promise.all([
      chapterFixture({
        organizationId: otherOrg.id,
        title: "Other Org Unique Chapter",
      }),
      chapterFixture({
        organizationId: organization.id,
        title: "My Org Unique Chapter",
      }),
    ]);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Unique Chapter",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.title).toBe("My Org Unique Chapter");
  });

  test("returns Forbidden for different organization", async () => {
    const otherOrg = await organizationFixture();

    const result = await searchOrgChapters({
      headers,
      orgSlug: otherOrg.slug,
      title: "test",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns courses array with slug and language for linked chapters", async () => {
    const chapter = await chapterFixture({
      organizationId: organization.id,
      title: "Chapter With Courses Linked",
    });

    const [course1, course2] = await Promise.all([
      courseFixture({
        language: "en",
        organizationId: organization.id,
        slug: "english-course",
      }),
      courseFixture({
        language: "pt",
        organizationId: organization.id,
        slug: "portuguese-course",
      }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter.id,
        courseId: course1.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter.id,
        courseId: course2.id,
        position: 0,
      }),
    ]);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Chapter With Courses Linked",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.courses).toHaveLength(2);

    const courseSlugs = result.data[0]?.courses.map((c) => c.slug);

    expect(courseSlugs).toContain("english-course");
    expect(courseSlugs).toContain("portuguese-course");

    const enCourse = result.data[0]?.courses.find(
      (c) => c.slug === "english-course",
    );

    const ptCourse = result.data[0]?.courses.find(
      (c) => c.slug === "portuguese-course",
    );

    expect(enCourse?.language).toBe("en");
    expect(ptCourse?.language).toBe("pt");
  });

  test("returns empty courses array for chapters not linked to any course", async () => {
    await chapterFixture({
      organizationId: organization.id,
      title: "Standalone Chapter No Course",
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Standalone Chapter No Course",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.courses).toEqual([]);
  });

  test("returns chapter linked to single course", async () => {
    const chapter = await chapterFixture({
      organizationId: organization.id,
      title: "Single Course Chapter Link",
    });

    const course = await courseFixture({
      language: "es",
      organizationId: organization.id,
      slug: "spanish-only-course",
    });

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Single Course Chapter Link",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.courses).toHaveLength(1);
    expect(result.data[0]?.courses[0]?.slug).toBe("spanish-only-course");
    expect(result.data[0]?.courses[0]?.language).toBe("es");
  });
});
