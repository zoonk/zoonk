import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { renameCourseForAdmin } from "./rename-course";

function mockAdminSession(userId: string) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

async function brandCourse() {
  const organization = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    isPublished: true,
    organizationId: organization.id,
    slug: `course-${randomUUID().slice(0, 8)}`,
  });

  return { course, organization };
}

describe(renameCourseForAdmin, () => {
  it("renames only for an admin", async () => {
    const [{ course }, learner] = await Promise.all([brandCourse(), userFixture()]);
    const input = { courseId: course.id, slug: "new-address", title: "New title" };

    mockSession(null);
    await expect(renameCourseForAdmin(input)).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(learner.id);
    await expect(renameCourseForAdmin(input)).resolves.toStrictEqual({ status: "forbidden" });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ slug: course.slug, title: course.title });
  });

  it("saves the title, its search title and the slug, and expires both addresses and the course", async () => {
    const [{ course, organization }, admin] = await Promise.all([
      brandCourse(),
      userFixture({ role: "admin" }),
    ]);

    mockAdminSession(admin.id);
    const slug = `${course.slug}-renamed`;

    await expect(
      renameCourseForAdmin({ courseId: course.id, slug: ` ${slug.toUpperCase()} `, title: "Ação" }),
    ).resolves.toStrictEqual({ slug, status: "renamed", title: "Ação" });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ normalizedTitle: "acao", slug, title: "Ação" });

    for (const tag of [
      getCourseCacheTag(course.id),
      COURSE_LIST_CACHE_TAG,
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: course.slug }),
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: slug }),
    ]) {
      expect(revalidateTag).toHaveBeenCalledWith(tag, { expire: 0 });
    }
  });

  it("keeps an unchanged slug byte for byte and refuses one another course of the owner uses", async () => {
    const [{ course, organization }, admin] = await Promise.all([
      brandCourse(),
      userFixture({ role: "admin" }),
    ]);

    const other = await courseFixture({
      organizationId: organization.id,
      slug: `other-${randomUUID().slice(0, 8)}`,
    });

    mockAdminSession(admin.id);

    await expect(
      renameCourseForAdmin({ courseId: course.id, slug: course.slug, title: "Same address" }),
    ).resolves.toMatchObject({ slug: course.slug, status: "renamed" });

    await expect(
      renameCourseForAdmin({ courseId: course.id, slug: other.slug, title: "Taken" }),
    ).resolves.toStrictEqual({ status: "slugTaken" });

    await expect(
      renameCourseForAdmin({ courseId: course.id, slug: "!!!", title: "No letters" }),
    ).resolves.toStrictEqual({ status: "invalidSlug" });

    await expect(
      renameCourseForAdmin({ courseId: randomUUID(), slug: "anything", title: "Missing" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
