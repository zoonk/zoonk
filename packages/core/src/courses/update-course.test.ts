import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { updateCourse } from "./update-course";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await updateCourse({
      courseId: course.id,
      headers: new Headers(),
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });
  const headers = await signInAs(user.email, user.password);
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await updateCourse({
      courseId: course.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);
  const course = await courseFixture({ organizationId: organization.id });

  test("updates title successfully", async () => {
    const result = await updateCourse({
      courseId: course.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error).toBeNull();
    expect(result.data?.title).toBe("Updated Title");
  });

  test("updates description successfully", async () => {
    const result = await updateCourse({
      courseId: course.id,
      description: "Updated description",
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.description).toBe("Updated description");
  });

  test("updates slug successfully", async () => {
    const result = await updateCourse({
      courseId: course.id,
      headers,
      slug: "new-slug",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("new-slug");
  });

  test("normalizes slug", async () => {
    const result = await updateCourse({
      courseId: course.id,
      headers,
      slug: "My Updated Course!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("my-updated-course");
  });

  test("normalizes title for search", async () => {
    const result = await updateCourse({
      courseId: course.id,
      headers,
      title: "Ciência da Computação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.normalizedTitle).toBe("ciencia da computacao");
  });

  test("updates multiple fields at once", async () => {
    const result = await updateCourse({
      courseId: course.id,
      description: "New description",
      headers,
      slug: "new-slug-multi",
      title: "New Title",
    });

    expect(result.error).toBeNull();
    expect(result.data?.title).toBe("New Title");
    expect(result.data?.description).toBe("New description");
    expect(result.data?.slug).toBe("new-slug-multi");
  });

  test("returns Course not found", async () => {
    const result = await updateCourse({
      courseId: 999_999,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("don't allow to update course for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await updateCourse({
      courseId: otherCourse.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);

  test("updates course successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await updateCourse({
      courseId: course.id,
      headers,
      title: "Owner Updated Title",
    });

    expect(result.error).toBeNull();
    expect(result.data?.title).toBe("Owner Updated Title");
  });
});
